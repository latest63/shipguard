// One-off cleanup: reconcile Supabase `raises` with the chain.
//  1. Maps id -> total_deposited (wei) + deadline + creator from get_all_vaults
//  2. Updates every existing row's `raised` from the chain value
//  3. Deletes rows whose id has no matching vault on-chain
const { createClient } = require("genlayer-js");
const { studioDevnet } = require("genlayer-js/chains");
const { createClient: createSupabase } = require("@supabase/supabase-js");
const fs = require("fs");

const env = fs.readFileSync(__dirname + "/../.env.local", "utf8");
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1] || "";

const RPC = get("NEXT_PUBLIC_GENLAYER_RPC_URL") || "https://studio-next.genlayer.com/api";
const VAULT = get("NEXT_PUBLIC_VAULT_CONTRACT");
const SUPA_URL = get("NEXT_PUBLIC_SUPABASE_URL");
const SUPA_KEY = get("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY") || get("NEXT_PUBLIC_SUPABASE_ANON_KEY");

(async () => {
  const chain = { ...studioDevnet, rpcUrls: { default: { http: [RPC] } } };
  const client = createClient({ chain, endpoint: RPC });
  const raw = await client.readContract({ address: VAULT, functionName: "get_all_vaults" });
  const parsed = JSON.parse(JSON.stringify(raw, (k, x) => (typeof x === "bigint" ? String(x) : x)));
  const list = Array.isArray(parsed) ? parsed : Object.values(parsed || {});

  const onChain = new Map();
  for (const v of list) {
    if (v && typeof v === "object" && v.id) onChain.set(v.id, v);
  }
  console.log(`chain: ${onChain.size} vaults`);

  const supa = createSupabase(SUPA_URL, SUPA_KEY);
  const { data: rows, error } = await supa.from("raises").select("id, raised");
  if (error) throw error;
  console.log(`supabase: ${rows.length} raise rows`);

  let updated = 0, deleted = 0, unchanged = 0, zeroed = 0;
  for (const row of rows) {
    const vault = onChain.get(row.id);
    if (!vault) {
      const { error: e } = await supa.from("raises").delete().eq("id", row.id);
      if (e) console.error(`delete ${row.id}: ${e.message}`);
      else { deleted++; console.log(`DELETED (not on chain): ${row.id}`); }
      continue;
    }
    const wei = BigInt(vault.total_deposited || "0");
    // Store GEN with up to 6 decimals, matching the new chain-backed total.
    let genStr;
    if (wei === 0n) genStr = "0";
    else {
      const whole = wei / 10n ** 18n;
      const frac = ((wei % 10n ** 18n) / 10n ** 12n).toString().padStart(6, "0").replace(/0+$/, "");
      genStr = frac ? `${whole}.${frac}` : whole.toString();
    }
    if (genStr === "0") zeroed++;
    if (row.raised === genStr) { unchanged++; continue; }
    const { error: e } = await supa.from("raises").update({ raised: genStr }).eq("id", row.id);
    if (e) console.error(`update ${row.id}: ${e.message}`);
    else { updated++; console.log(`UPDATED ${row.id}: "${row.raised}" -> "${genStr}"`); }
  }

  // Backfill: vaults on-chain with no raises row at all
  const existingIds = new Set(rows.map((r) => r.id));
  let missing = 0;
  for (const [id] of onChain) {
    if (!existingIds.has(id)) missing++;
  }

  console.log(`\ndone: ${updated} updated, ${deleted} deleted, ${unchanged} already accurate`);
  console.log(`rows now at 0 GEN: ${zeroed} | on-chain vaults missing a row: ${missing}`);
  if (missing) console.log(`  (run GET /api/raise/sync to backfill them with full metadata)`);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });