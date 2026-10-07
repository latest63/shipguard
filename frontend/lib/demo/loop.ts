import { createClient, createAccount, isSuccessful } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { execFileSync } from "child_process";
import path from "path";
import fs from "fs";

// ── Demo loop: recurring raises + poll decisions + settlement ────────────────
// Runs from instrumentation.ts (node runtime) on a 60s tick:
//   1. ensureRaise      — a fresh real on-chain raise every CREATE_INTERVAL
//   2. decideDuePolls   — at T-DECISION_OFFSET: majority commit → real commit
//                         pushed to the watched repo; otherwise no commit
//   3. settleClosed     — after close: evaluate() on-chain, then release
//                         (success) / refund (failure)
//
// All money movement stays on-chain. The poll (raise_votes) is off-chain by
// design — it only decides whether the demo commit happens.

// ── Config ──────────────────────────────────────────────────────────────────
const num = (k: string, d: number) => {
  const v = parseInt(process.env[k] || "", 10);
  return Number.isFinite(v) && v > 0 ? v : d;
};
const DURATION_SEC = num("DEMO_RAISE_DURATION_SEC", 5 * 3600); // window length
const DECISION_OFFSET_SEC = num("DEMO_DECISION_OFFSET_SEC", 30 * 60); // T-30min
const CREATE_INTERVAL_SEC = num("DEMO_CREATE_INTERVAL_SEC", 60 * 60); // new raise cadence
const CHECK_URL =
  process.env.DEMO_CHECK_URL || "https://github.com/latest63/shipguard/commits/main.atom";
const REPO_DIR = process.env.DEMO_REPO_DIR || path.join(process.cwd(), "..");
const MAX_EVAL_ATTEMPTS = 5;

const RPC_URL: string =
  process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio-next.genlayer.com/api";
const SIGNER_KEY: string | undefined = process.env.GITHUB_VERIFY_SIGNER_KEY?.trim();
const VAULT_CONTRACT = process.env.NEXT_PUBLIC_VAULT_CONTRACT;
const CONDITION_CONTRACT = process.env.NEXT_PUBLIC_CONDITION_CONTRACT;

const j = (v: unknown) =>
  JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  return createSupabase(url, key);
}

function chainClient() {
  if (!SIGNER_KEY) throw new Error("GITHUB_VERIFY_SIGNER_KEY missing");
  const chain = { ...studioDevnet, rpcUrls: { default: { http: [RPC_URL] } } };
  return createClient({
    chain,
    endpoint: RPC_URL,
    account: createAccount(SIGNER_KEY as `0x${string}`),
  });
}

// ── Demo project identities (rotate per raise) ──────────────────────────────
const DEMO_PROJECTS = [
  { name: "Nova Freight", tagline: "On-chain logistics for West Africa", tint: "#7c5cff" },
  { name: "Kola Labs", tagline: "Open-source payments toolkit", tint: "#0ea5e9" },
  { name: "Atlas Grid", tagline: "Community solar monitoring", tint: "#22c55e" },
  { name: "Riverbank AI", tagline: "Credit scoring for co-ops", tint: "#f59e0b" },
  { name: "Oja OS", tagline: "Marketplace infrastructure", tint: "#ec4899" },
];

// ── 1. Create a recurring raise ─────────────────────────────────────────────
async function createDemoRaise(): Promise<string> {
  if (!VAULT_CONTRACT || !CONDITION_CONTRACT) throw new Error("contracts not configured");
  const client = chainClient();
  const team = createAccount((SIGNER_KEY as string) as `0x${string}`).address;

  const nowSec = Math.floor(Date.now() / 1000);
  const deadline = nowSec + DURATION_SEC;
  const id = `raise-demo-${nowSec}-${Math.random().toString(36).slice(2, 6)}`;
  const openedAt = new Date(nowSec * 1000).toISOString();
  const closesAt = new Date(deadline * 1000).toISOString();

  const condition =
    `CHECK URL is an Atom feed of commits where each <entry> has an absolute ` +
    `<updated> timestamp (ISO 8601). SUCCESS if at least one commit entry has ` +
    `an <updated> timestamp strictly between the raise window open ` +
    `(${openedAt}) and close (${closesAt}). If every entry falls outside that ` +
    `window, the condition is NOT met.`;

  const regFees = await client.estimateTransactionFees({});
  const regTx = await client.writeContract({
    address: CONDITION_CONTRACT as `0x${string}`,
    functionName: "register_condition",
    args: [id, CHECK_URL, condition, team],
    fees: regFees,
  });
  const regReceipt = await client.waitForTransactionReceipt({
    hash: regTx, waitUntil: "finalized", retries: 400, interval: 5000,
  });
  if (!isSuccessful(regReceipt)) throw new Error(`register_condition failed: ${j(regReceipt)}`);

  const cvFees = await client.estimateTransactionFees({});
  const cvTx = await client.writeContract({
    address: VAULT_CONTRACT as `0x${string}`,
    functionName: "create_vault",
    args: [id, team, String(deadline), condition, CONDITION_CONTRACT],
    fees: cvFees,
  });
  const cvReceipt = await client.waitForTransactionReceipt({
    hash: cvTx, waitUntil: "finalized", retries: 400, interval: 5000,
  });
  if (!isSuccessful(cvReceipt)) throw new Error(`create_vault failed: ${j(cvReceipt)}`);

  // Display row + poll row (best-effort, chain is the source of truth).
  const proj = DEMO_PROJECTS[Math.floor(Date.now() / 1000 / CREATE_INTERVAL_SEC) % DEMO_PROJECTS.length];
  const initials = proj.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const { error: rowErr } = await db().from("raises").insert({
    id,
    company: proj.name,
    tagline: proj.tagline,
    initials,
    tint: proj.tint,
    raised: "0",
    progress: 0,
    closes_on: new Date(deadline * 1000).toISOString(),
    verified: true,
    github_handle: "latest63",
    repo_url: CHECK_URL.replace(/\/commits\/.*$/, ""),
    creator: team,
  });
  if (rowErr) console.error("[demo-loop] raise row insert failed:", rowErr.message);
  await db().from("raise_polls").upsert({ raise_id: id, state: "open" }, { onConflict: "raise_id" });

  console.log(`[demo-loop] created raise ${id} (closes ${closesAt})`);
  return id;
}

async function ensureRaise() {
  const now = Date.now();
  const { data: rows } = await db()
    .from("raises")
    .select("id, closes_on")
    .order("closes_on", { ascending: false })
    .limit(200);
  const all = rows || [];
  const live = all.filter((r) => r.closes_on && new Date(r.closes_on).getTime() > now);
  // Time since the most recent raise opened (= closes_on - duration).
  let sinceLastCreate = Infinity;
  for (const r of all) {
    if (!r.closes_on) continue;
    const openedAt = new Date(r.closes_on).getTime() - DURATION_SEC * 1000;
    sinceLastCreate = Math.min(sinceLastCreate, now - openedAt);
  }
  if (live.length === 0 || sinceLastCreate >= CREATE_INTERVAL_SEC * 1000) {
    await createDemoRaise();
  }
}

// ── 2. Decide polls at T-DECISION_OFFSET ────────────────────────────────────
function pushCommit(raiseId: string): string {
  const file = path.join(REPO_DIR, "demo", "raise-commits.md");
  const line = `- ${new Date().toISOString()} — ${raiseId}: community voted YES, milestone commit`;
  execFileSync("mkdir", ["-p", path.dirname(file)]);
  fs.appendFileSync(file, line + "\n");
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: REPO_DIR, encoding: "utf8" });
  git("add", "demo/raise-commits.md");
  try {
    git("commit", "-m", `demo(raise): ${raiseId} poll passed — milestone commit`);
  } catch {
    // nothing to commit (shouldn't happen — the file always changes)
  }
  try {
    git("pull", "--rebase", "--autostash", "origin", "main");
  } catch (e) {
    console.error("[demo-loop] pull --rebase failed:", (e as Error).message);
  }
  git("push", "origin", "main");
  const sha = git("rev-parse", "HEAD").trim();
  return sha;
}

async function decideDuePolls() {
  const now = Date.now();
  const { data: polls } = await db()
    .from("raise_polls")
    .select("raise_id, state")
    .eq("state", "open");
  if (!polls?.length) return;

  const { data: raises } = await db()
    .from("raises")
    .select("id, closes_on")
    .in("id", polls.map((p) => p.raise_id));
  const closesBy = new Map((raises || []).map((r) => [r.id, r.closes_on]));

  for (const p of polls) {
    const closes = closesBy.get(p.raise_id);
    if (!closes) continue;
    const decisionDueAt = new Date(closes).getTime() - DECISION_OFFSET_SEC * 1000;
    if (now < decisionDueAt) continue;

    const { data: votes } = await db()
      .from("raise_votes")
      .select("choice")
      .eq("raise_id", p.raise_id);
    let yes = 0;
    let no = 0;
    for (const v of votes || []) v.choice === "commit" ? yes++ : no++;

    if (yes > no) {
      try {
        const sha = pushCommit(p.raise_id);
        await db()
          .from("raise_polls")
          .update({ state: "decided_commit", decided_at: new Date().toISOString(), commit_sha: sha, reason: `majority commit (${yes}–${no})` })
          .eq("raise_id", p.raise_id);
        console.log(`[demo-loop] ${p.raise_id}: commit triggered (${yes}–${no}) -> ${sha.slice(0, 7)}`);
      } catch (e) {
        console.error(`[demo-loop] ${p.raise_id}: commit push failed:`, (e as Error).message);
        // stay open; retried next tick
      }
    } else {
      await db()
        .from("raise_polls")
        .update({ state: "decided_no_commit", decided_at: new Date().toISOString(), reason: yes === 0 && no === 0 ? "no votes — default no commit" : `majority no-commit (${yes}–${no})` })
        .eq("raise_id", p.raise_id);
      console.log(`[demo-loop] ${p.raise_id}: decided NO commit (${yes}–${no})`);
    }
  }
}

// ── 3. Settle closed raises: evaluate → release / refund ────────────────────
async function settleClosedRaises() {
  const now = Date.now();
  const { data: polls } = await db()
    .from("raise_polls")
    .select("raise_id, state, eval_attempts")
    .neq("state", "open")
    .is("settled_at", null);
  if (!polls?.length) return;

  const { data: raises } = await db()
    .from("raises")
    .select("id, closes_on")
    .in("id", polls.map((p) => p.raise_id));
  const closesBy = new Map((raises || []).map((r) => [r.id, r.closes_on]));

  const client = chainClient();
  let settledThisTick = 0;
  for (const p of polls) {
    if (settledThisTick >= 1) break; // one heavy settlement per tick — keeps RPC bursts down
    const closes = closesBy.get(p.raise_id);
    if (!closes || new Date(closes).getTime() > now) continue;
    settledThisTick++;

    try {
      const vault: any = JSON.parse(
        j(await client.readContract({
          address: VAULT_CONTRACT as `0x${string}`,
          functionName: "get_vault",
          args: [p.raise_id],
        }))
      );
      if (!vault || vault.status !== "active") {
        await db().from("raise_polls").update({ settled_at: new Date().toISOString(), reason: `already ${vault?.status || "missing"}` }).eq("raise_id", p.raise_id);
        continue;
      }

      // Ask the governor for an on-chain verdict (AI consensus on the repo).
      let verdict: any = null;
      let evalOk = false;
      try {
        const evalFees = await client.estimateTransactionFees({});
        const evalTx = await client.writeContract({
          address: CONDITION_CONTRACT as `0x${string}`,
          functionName: "evaluate",
          args: [p.raise_id],
          fees: evalFees,
        });
        const evalReceipt = await client.waitForTransactionReceipt({ hash: evalTx, waitUntil: "finalized", retries: 400, interval: 5000 });
        if (!isSuccessful(evalReceipt)) {
          console.error(`[demo-loop] ${p.raise_id}: evaluate tx failed: ${j((evalReceipt as any).txExecutionError ?? "")}`);
        } else {
          evalOk = true;
          verdict = JSON.parse(
            j(await client.readContract({
              address: CONDITION_CONTRACT as `0x${string}`,
              functionName: "get_verdict",
              args: [p.raise_id],
            }))
          );
        }
      } catch (e) {
        // Transient RPC failure — do NOT count it as an evaluation attempt.
        console.error(`[demo-loop] ${p.raise_id}: evaluate failed (will retry):`, (e as Error).message);
        continue;
      }

      const decision = verdict?.decision;
      if (decision !== "success" && decision !== "failure") {
        if (!evalOk) continue;
        console.log(`[demo-loop] ${p.raise_id}: verdict=${decision || "none"} (inconclusive) — attempt ${(p.eval_attempts || 0) + 1}/${MAX_EVAL_ATTEMPTS}`);
      }
      if (decision === "success" || decision === "failure") {
        const fn = decision === "success" ? "release" : "refund";
        const fees = await client.estimateTransactionFees({});
        const tx = await client.writeContract({
          address: VAULT_CONTRACT as `0x${string}`,
          functionName: fn,
          args: [p.raise_id],
          fees,
        });
        const receipt = await client.waitForTransactionReceipt({ hash: tx, waitUntil: "finalized", retries: 400, interval: 5000 });
        if (isSuccessful(receipt)) {
          await db().from("raise_polls")
            .update({ settled_at: new Date().toISOString(), reason: `${fn}: ${verdict?.reason || decision}` })
            .eq("raise_id", p.raise_id);
          console.log(`[demo-loop] ${p.raise_id}: settled -> ${fn}`);
        } else {
          console.error(`[demo-loop] ${p.raise_id}: ${fn} failed on-chain`);
        }
        continue;
      }

      // Inconclusive / no verdict — retry a few times, then refund (deadline
      // has passed so refund() is allowed with no verdict at all).
      const attempts = (p.eval_attempts || 0) + 1;
      if (attempts >= MAX_EVAL_ATTEMPTS) {
        const fees = await client.estimateTransactionFees({});
        const tx = await client.writeContract({
          address: VAULT_CONTRACT as `0x${string}`,
          functionName: "refund",
          args: [p.raise_id],
          fees,
        });
        await client.waitForTransactionReceipt({ hash: tx, waitUntil: "finalized", retries: 400, interval: 5000 });
        await db().from("raise_polls")
          .update({ settled_at: new Date().toISOString(), eval_attempts: attempts, reason: "refund: evaluation inconclusive after deadline" })
          .eq("raise_id", p.raise_id);
        console.log(`[demo-loop] ${p.raise_id}: refund fallback after ${attempts} inconclusive evals`);
      } else {
        await db().from("raise_polls").update({ eval_attempts: attempts }).eq("raise_id", p.raise_id);
      }
    } catch (e) {
      console.error(`[demo-loop] ${p.raise_id}: settle error:`, (e as Error).message);
    }
  }
}

// ── Tick ────────────────────────────────────────────────────────────────────
let running = false;
export async function tick() {
  if (running) return;
  running = true;
  try {
    // Each phase is isolated: a failure in one never skips the others.
    // Order matters: decisions first (light, time-sensitive), creation last
    // (heavy — chain receipts can take a minute and must not delay decisions).
    for (const step of [decideDuePolls, settleClosedRaises, ensureRaise]) {
      try {
        await step();
      } catch (e) {
        console.error(`[demo-loop] ${step.name} failed:`, (e as Error).message);
      }
    }
  } finally {
    running = false;
  }
}
