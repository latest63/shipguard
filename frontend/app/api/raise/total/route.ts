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
    let listedIds: Set<string> | null = null;
    if (supabaseUrl && supabaseKey) {
      const { createClient: createSupabase } = await import("@supabase/supabase-js");
      const supabase = createSupabase(supabaseUrl, supabaseKey);
      const { data: rows } = await supabase.from("raises").select("id");
      listedIds = new Set((rows || []).map((r: any) => r.id));
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

    let totalWei = 0n;
    let count = 0;
    for (const vault of list) {
      const v = (vault && typeof vault === "object" && "total_deposited" in vault)
        ? vault
        : null;
      if (!v) continue;
      // Skip vaults that aren't listed as raises on the page.
      if (listedIds && !listedIds.has(v.id)) continue;
      try {
        totalWei += BigInt(v.total_deposited || "0");
        count++;
      } catch {
        // skip malformed rows
      }
    }

    // GEN has 18 decimals; keep 6 decimal places of precision as an integer.
    const totalMicroGen = Number(totalWei / 10n ** 12n);

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
