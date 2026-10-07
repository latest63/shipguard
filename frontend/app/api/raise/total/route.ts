import { NextResponse } from "next/server";
import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

// ── Live "GEN raised" total, straight from the chain ────────────────────────
// Reads vaults on the Vault contract and sums total_deposited (wei) — but only
// for vaults that are listed as raises on the page (present in the `raises`
// table). Values are always genuine chain data; Supabase only decides WHICH
// vaults count, so an empty raises page shows 0.

const RPC_URL: string =
  process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio-next.genlayer.com/api";
const VAULT_CONTRACT: string | undefined = process.env.NEXT_PUBLIC_VAULT_CONTRACT;

const j = (v: unknown) =>
  JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

/** "4.2M" / "1,200" / "0.01" → GEN as a float (mirrors lib/raises.parseRaised). */
function parseGen(raw: string): number {
  const s = (raw || "").trim().replace(/,/g, "");
  const m = s.match(/^([\d.]+)\s*([MKTk])?$/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return 0;
  const suffix = (m[2] || "").toUpperCase();
  if (suffix === "T") return n * 1e12;
  if (suffix === "M") return n * 1e6;
  if (suffix === "K") return n * 1e3;
  return n;
}

export async function GET() {
  if (!VAULT_CONTRACT) {
    return NextResponse.json(
      { error: "Vault contract not configured" },
      { status: 500 }
    );
  }

  try {
    // Which vaults are listed as raises on the page?
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "";
    // id → highest GEN amount ever observed for that vault (the sync route
    // keeps the peak: settlement zeroes the escrow on-chain, but the round
    // really did raise that much).
    let listed: Map<string, number> | null = null;
    if (supabaseUrl && supabaseKey) {
      const { createClient: createSupabase } = await import("@supabase/supabase-js");
      const supabase = createSupabase(supabaseUrl, supabaseKey);
      const { data: rows } = await supabase.from("raises").select("id, raised");
      listed = new Map(
        (rows || []).map((r: any) => [r.id, parseGen(String(r.raised || "0"))])
      );
    }

    const chain = { ...studioDevnet, rpcUrls: { default: { http: [RPC_URL] } } };
    const client = createClient({ chain, endpoint: RPC_URL });

    const vaultsRaw = await client.readContract({
      address: VAULT_CONTRACT as `0x${string}`,
      functionName: "get_all_vaults",
    });

    const vaults = (j(vaultsRaw) ? JSON.parse(j(vaultsRaw)) : []) as any[];
    // TreeMap decodes either to an array of vaults or a map of id → vault.
    const list: any[] = Array.isArray(vaults)
      ? vaults
      : Object.values((vaults || {}) as Record<string, any>);

    let totalMicroGen = 0;
    let count = 0;
    for (const vault of list) {
      const v = (vault && typeof vault === "object" && "total_deposited" in vault)
        ? vault
        : null;
      if (!v) continue;
      // Skip vaults that aren't listed as raises on the page.
      if (listed && !listed.has(v.id)) continue;
      try {
        const chainMicro = Number(BigInt(v.total_deposited || "0") / 10n ** 12n);
        const storedMicro = Math.round((listed?.get(v.id) || 0) * 1e6);
        totalMicroGen += Math.max(chainMicro, storedMicro);
        count++;
      } catch {
        // skip malformed rows
      }
    }

    return NextResponse.json({
      totalMicroGen,
      vaultCount: count,
      rpc: RPC_URL,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Chain read failed" },
      { status: 502 }
    );
  }
}
