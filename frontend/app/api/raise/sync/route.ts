import { NextResponse } from "next/server";
import { createClient, createAccount } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

// ── On-chain → Supabase sync for the explore page ──────────────────────────
// The explore page reads the Supabase `raises` table. Launches write on-chain
// (vault + condition) and, in /api/raise/create, also index a row. This route
// is the self-maintaining backfill: it reads ALL vaults + conditions on-chain
// and inserts any that are missing from Supabase, so past raises that predate
// the indexing fix show up too. It is idempotent (upserts keyed by vault id).

const RPC_URL: string =
  process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio-next.genlayer.com/api";
const SIGNER_KEY: string | undefined =
  process.env.GITHUB_VERIFY_SIGNER_KEY?.trim();
const VAULT_CONTRACT: string | undefined = process.env.NEXT_PUBLIC_VAULT_CONTRACT;
const CONDITION_CONTRACT: string | undefined =
  process.env.NEXT_PUBLIC_CONDITION_CONTRACT;

function getClient() {
  if (!SIGNER_KEY) {
    throw new Error("Signer not configured (GITHUB_VERIFY_SIGNER_KEY missing)");
  }
  const chain = { ...studioDevnet, rpcUrls: { default: { http: [RPC_URL] } } };
  return createClient({
    chain,
    endpoint: RPC_URL,
    account: createAccount(SIGNER_KEY as `0x${string}`),
  });
}

const j = (v: unknown) =>
  JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

// Derive display fields for the explore card from a vault + its condition.
function parseDeadline(raw: string): string {
  // Deadlines may be unix-seconds strings (form) or ISO datetimes (legacy).
  if (!raw) return "";
  const t = /^\d{1,13}$/.test(raw.trim())
    ? parseInt(raw.trim(), 10) * (raw.trim().length <= 10 ? 1000 : 1)
    : new Date(raw).getTime();
  if (!t || Number.isNaN(t)) return "";
  return new Date(t).toISOString();
}

function deriveDisplay(vault: any, condition: any) {
  const repoMatch =
    condition?.check_url?.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i) || [];
  const repoName = repoMatch[2] || vault.id || "";
  const owner = repoMatch[1] || "";
  // Prefer the repo name as the display company; fall back to a slug from the id.
  const displayName =
    (repoName.replace(/[-_]+/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())) ||
    (vault.id?.replace(/-/g, " ") || "Project");
  const initials =
    repoName.slice(0, 2).toUpperCase() ||
    (vault.id?.slice(0, 2).toUpperCase() || "RG");
  const tints = ["#7c5cff", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6"];
  let tint = tints[0];
  const seed = repoName || vault.id || "";
  if (seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    tint = tints[h % tints.length];
  }
  // tagline: the condition string, truncated for the card.
  const tagline =
    (condition?.success_condition?.slice(0, 120) || "")
    + (condition?.success_condition?.length > 120 ? "…" : "");
  return {
    company: displayName,
    tagline: tagline || `Escrowed raise${owner ? " by " + owner : ""}`,
    initials,
    tint,
    logo_url: "",
    deadline: vault.deadline || "",
    status: vault.status || "active",
    total_deposited: vault.total_deposited || "0",
  };
}

export async function GET(req: Request) {
  if (!VAULT_CONTRACT || !CONDITION_CONTRACT) {
    return NextResponse.json(
      { error: "Vault/Condition contracts not configured on server" },
      { status: 500 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  try {
    const client = getClient();

    // 1. Read on-chain vaults + conditions.
    const [vaultsRaw, conditionsRaw] = await Promise.all([
      client.readContract({
        address: VAULT_CONTRACT as `0x${string}`,
        functionName: "get_all_vaults",
      }),
      client.readContract({
        address: CONDITION_CONTRACT as `0x${string}`,
        functionName: "get_all_conditions",
      }),
    ]);

    const vaults = (j(vaultsRaw) ? JSON.parse(j(vaultsRaw)) : []) as any[];
    const conditions = (j(conditionsRaw) ? JSON.parse(j(conditionsRaw)) : []) as any[];
    const conditionByVault = new Map(
      (conditions || []).map((c: any) => [c.vault_id, c])
    );

    if (!vaults.length) {
      return NextResponse.json({ synced: 0, total: 0 });
    }

    // 2. Fetch existing Supabase rows to avoid duplicate ids.
    const { createClient: createSupabase } = await import("@supabase/supabase-js");
    const supabase = createSupabase(supabaseUrl, supabaseKey);
    const { data: existingRows } = await supabase
      .from("raises")
      .select("id");
    const existingIds = new Set((existingRows || []).map((r: any) => r.id));

    // 3. Insert any vault not already present.
    let inserted = 0;
    for (const vault of vaults) {
      if (existingIds.has(vault.id)) continue;
      const condition = conditionByVault.get(vault.id) || {};
      const d = deriveDisplay(vault, condition);
      // closes_on: vault deadline (unix-seconds or ISO) → ISO date column.
      const closesOn = parseDeadline(d.deadline || "");
      const { error } = await supabase.from("raises").insert({
        id: vault.id,
        company: d.company,
        tagline: d.tagline,
        initials: d.initials,
        tint: d.tint,
        logo_url: d.logo_url || null,
        raised: "0",
        progress: 0,
        closes_on: closesOn || null,
        verified: false,
      });
      if (!error) inserted++;
    }

    return NextResponse.json({ synced: inserted, total: vaults.length });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Sync failed" },
      { status: 502 }
    );
  }
}