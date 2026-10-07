import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── All poll tallies + states for the explore page, in one call ─────────────
// GET /api/raise/polls -> { [raise_id]: { yes, no, state, ... } }

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  if (!url || !key) return NextResponse.json({});
  const db = createClient(url, key);

  const [{ data: votes }, { data: polls }] = await Promise.all([
    db.from("raise_votes").select("raise_id, choice"),
    db.from("raise_polls").select("raise_id, state, decided_at, commit_sha, reason"),
  ]);

  const out: Record<string, any> = {};
  for (const p of polls || []) {
    out[p.raise_id] = {
      yes: 0,
      no: 0,
      state: p.state,
      decided_at: p.decided_at,
      commit_sha: p.commit_sha,
      reason: p.reason,
    };
  }
  for (const v of votes || []) {
    if (!out[v.raise_id]) out[v.raise_id] = { yes: 0, no: 0, state: "open" };
    if (v.choice === "commit") out[v.raise_id].yes++;
    else out[v.raise_id].no++;
  }
  return NextResponse.json(out);
}
