import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── Poll voting (off-chain by design) ────────────────────────────────────────
// POST /api/raise/vote  { raise_id, voter, choice: "commit" | "no_commit" }
// GET  /api/raise/vote?id=<raise_id>  -> tally + poll state
// One vote per wallet per raise; re-voting changes the previous choice.

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  return createClient(url, key);
}

async function tallyFor(db: ReturnType<typeof supa>, raiseId: string) {
  const { data: votes } = await db
    .from("raise_votes")
    .select("voter, choice")
    .eq("raise_id", raiseId);
  let yes = 0;
  let no = 0;
  for (const v of votes || []) {
    if (v.choice === "commit") yes++;
    else no++;
  }
  const { data: poll } = await db
    .from("raise_polls")
    .select("state, decided_at, commit_sha, reason")
    .eq("raise_id", raiseId)
    .maybeSingle();
  return {
    yes,
    no,
    state: poll?.state || "open",
    decided_at: poll?.decided_at || null,
    commit_sha: poll?.commit_sha || null,
    reason: poll?.reason || null,
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const raiseId = String(body?.raise_id || "");
  const voter = String(body?.voter || "").toLowerCase().trim();
  const choice = String(body?.choice || "");
  if (!raiseId || !voter || !["commit", "no_commit"].includes(choice)) {
    return NextResponse.json(
      { error: "raise_id, voter and valid choice are required" },
      { status: 400 }
    );
  }
  if (!/^0x[a-f0-9]{40}$/.test(voter)) {
    return NextResponse.json({ error: "voter must be a wallet address" }, { status: 400 });
  }

  const db = supa();
  const { data: raise } = await db
    .from("raises")
    .select("id, closes_on")
    .eq("id", raiseId)
    .maybeSingle();
  if (!raise) return NextResponse.json({ error: "raise not found" }, { status: 404 });
  if (raise.closes_on && new Date(raise.closes_on).getTime() <= Date.now()) {
    return NextResponse.json({ error: "raise is closed" }, { status: 409 });
  }

  const tally = await tallyFor(db, raiseId);
  if (tally.state !== "open") {
    return NextResponse.json({ error: "poll is decided" }, { status: 409 });
  }

  const { error } = await db
    .from("raise_votes")
    .upsert({ raise_id: raiseId, voter, choice }, { onConflict: "raise_id,voter" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(await tallyFor(db, raiseId));
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  return NextResponse.json(await tallyFor(supa(), id));
}
