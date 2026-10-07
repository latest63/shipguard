// One-off: wipe the raises table (all rows are test/probe vaults on Studio devnet).
const { createClient: createSupabase } = require("@supabase/supabase-js");
const fs = require("fs");
const env = fs.readFileSync(__dirname + "/../.env.local", "utf8");
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1] || "";
const supa = createSupabase(
  get("NEXT_PUBLIC_SUPABASE_URL"),
  get("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY") || get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
);
(async () => {
  const { data: rows, error: selErr } = await supa.from("raises").select("id");
  if (selErr) throw selErr;
  console.log(`rows before: ${rows.length}`);
  rows.forEach((r) => console.log(`  deleting: ${r.id}`));
  const { error } = await supa.from("raises").delete().neq("id", "__none__");
  if (error) throw error;
  const { count } = await supa.from("raises").select("id", { count: "exact", head: true });
  console.log(`rows after: ${count}`);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
