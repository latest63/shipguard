"use client";

import { useEffect, useCallback, useMemo, useState, type ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { fetchRaises, parseRaised, formatTotal, type ShippingRaise } from "@/lib/raises";
import { useWallet } from "@/lib/genlayer/wallet";
import { useDeposit } from "@/lib/hooks/useVault";
import { Loader2, Coins, Gavel, ShieldCheck, Zap, Github, Globe, Twitter, Send, MessageCircle, ExternalLink, Layers, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCountdown, type CountdownParts } from "@/lib/useCountdown";
import { success } from "@/lib/utils/toast";

type PollInfo = {
  yes: number;
  no: number;
  state: "open" | "decided_commit" | "decided_no_commit" | string;
  decided_at?: string | null;
  commit_sha?: string | null;
  reason?: string | null;
};

export default function ExplorePage() {
  const [raises, setRaises] = useState<ShippingRaise[]>([]);
  const [filter, setFilter] = useState<"all" | "live" | "ended">("all");
  const [selected, setSelected] = useState<ShippingRaise | null>(null);
  const [loading, setLoading] = useState(true);
  // Live "GEN raised" total (micro-GEN, i.e. GEN * 1e6) read from the chain.
  const [raisedMicro, setRaisedMicro] = useState<number | null>(null);
  // Poll tallies + states per raise (off-chain vote, see /api/raise/polls).
  const [polls, setPolls] = useState<Record<string, PollInfo>>({});
  // "How to" walkthrough dialog.
  const [showGuide, setShowGuide] = useState(false);

  const fetchPolls = useCallback(() => {
    fetch("/api/raise/polls")
      .then((r) => r.json())
      .then((d) => setPolls(d && typeof d === "object" ? d : {}))
      .catch(() => {});
  }, []);

  // Read the genuine on-chain total (sum of every vault's total_deposited).
  const fetchChainTotal = useCallback(() => {
    fetch("/api/raise/total")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.totalMicroGen === "number") setRaisedMicro(d.totalMicroGen);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Self-maintaining sync: pull any on-chain vaults missing from Supabase
    // (e.g. past raises that predate the indexing fix), then load the list.
    fetch("/api/raise/sync")
      .catch(() => {})
      .then(() => fetchRaises())
      .then(setRaises)
      .catch(() => {})
      .finally(() => setLoading(false));
    fetchChainTotal();
    fetchPolls();
  }, [fetchChainTotal, fetchPolls]);

  // Filter raises: Live = close date in the future; Ended = close date passed.
  const now = Date.now();
  const liveRaises = raises.filter(
    (r) => r.closes_on && new Date(r.closes_on).getTime() > now
  );
  const endedRaises = raises.filter(
    (r) => !r.closes_on || new Date(r.closes_on).getTime() <= now
  );
  const visibleRaises =
    filter === "live" ? liveRaises : filter === "ended" ? endedRaises : raises;

  // After a live deposit succeeds, refetch so the "raised" figures refresh.
  const refreshRaises = useCallback(() => {
    // Re-run the on-chain sync first: it rewrites each card's `raised` from
    // vault.total_deposited, so the figures move as soon as funds land.
    fetch("/api/raise/sync")
      .catch(() => {})
      .then(() => fetchRaises())
      .then(setRaises)
      .catch(() => {});
    fetchChainTotal();
    fetchPolls();
  }, [fetchChainTotal, fetchPolls]);

  // Keep everything live while the tab stays open — the demo loop pushes
  // commits and settles raises in the background, so a page that never
  // refetches shows stale zeros.
  useEffect(() => {
    const id = setInterval(() => refreshRaises(), 20000);
    return () => clearInterval(id);
  }, [refreshRaises]);

  // Genuine on-chain total: sum of every vault's total_deposited (wei → GEN).
  const totalRaised =
    raisedMicro === null
      ? "—"
      : (() => {
          const gen = raisedMicro / 1e6;
          if (gen >= 1e3) return formatTotal(gen); // K/M/B for large totals
          if (gen === 0) return "0";
          return gen.toLocaleString(undefined, { maximumFractionDigits: 4 });
        })();
  const liveCount = liveRaises.length;
  const endedCount = endedRaises.length;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow pt-24 pb-20">
        <div className="shell">
        {/* ── Header: board masthead ──────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-2 font-mono text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 font-semibold tracking-widest text-ok">
                  <span className="live-dot" aria-hidden="true" />
                  LIVE
                </span>
                <span>GEN · STUDIO NEXT · 61997</span>
              </div>
              <h1 className="font-display text-[34px] md:text-[44px] uppercase leading-none tracking-tight">
                Explore <span className="text-primary">Raises</span>
              </h1>
            </div>
            <button
              onClick={() => setShowGuide(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm border border-border bg-card font-mono text-xs text-foreground hover:border-primary/50 hover:text-primary transition-colors shrink-0"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              How to
            </button>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
            Every raise is escrowed and stems from a project. Funds are locked
            until the condition is verified by AI at the close date — the team
            shows the verified project GitHub that backs each raise.
          </p>
        </div>

        {/* ── Metric cards: the board's four facts ────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <MetricTile
            label="Projects raising"
            value={String(new Set(raises.map((r) => r.project_id || r.company)).size)}
            sub="across all rounds"
          />
          <MetricTile
            label="GEN escrowed on-chain"
            value={totalRaised}
            sub="live Vault balance"
          />
          <MetricTile
            label="Verified repos"
            value={String(raises.filter((r) => r.github_handle).length)}
            sub="project GitHub checked"
          />
          <MetricTile
            label="Live rounds"
            value={String(liveCount)}
            sub={endedCount ? `+${endedCount} ended` : "funding now"}
          />
        </div>

        {/* ── Filter tabs: board switches ─────────────────────────────── */}
        <div className="flex w-fit mb-8">
          {([["all", "All"], ["live", "Live"], ["ended", "Ended"]] as const).map(
            ([f, label]) => {
              const active = filter === f;
              const count =
                f === "all" ? raises.length : f === "live" ? liveCount : endedCount;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={active}
                  className={`px-4 py-2 font-mono text-xs border border-border -ml-px first:ml-0 transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}{" "}
                  <span className="tabular-nums">{count}</span>
                </button>
              );
            }
          )}
        </div>

          {/* ── Loading / List ───────────────────────────────────────────── */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Loading raises...
              </p>
            </div>
          ) : visibleRaises.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
              <Gavel className="w-7 h-7 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">
                {filter === "live"
                  ? "No live raises right now"
                  : filter === "ended"
                  ? "No ended raises yet"
                  : "No raises yet"}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Raises appear here once a project launches them on-chain.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {visibleRaises.map((raise) => (
                <RaiseRow
                  key={raise.id}
                  raise={raise}
                  poll={polls[raise.id]}
                  onOpen={() => setSelected(raise)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Project detail dialog ───────────────────────────────────────── */}
      {selected && (
        <RaiseDetailDialog
          raise={selected}
          allRaises={raises}
          poll={polls[selected.id]}
          onClose={() => setSelected(null)}
          onDeposited={refreshRaises}
          onPollUpdate={fetchPolls}
        />
      )}
      {showGuide && <HowToDialog onClose={() => setShowGuide(false)} />}
    </div>
  );
}

/* ── Metric tile — one fact per card, mono figure ───────────────────────── */

function MetricTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-card border border-border rounded-sm px-4 py-3.5 flex flex-col gap-1 min-w-0">
      <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider truncate">
        {label}
      </span>
      <span className="font-mono text-2xl font-bold tabular-nums tracking-tight text-foreground leading-none">
        {value}
      </span>
      <span className="text-xs text-muted-foreground leading-tight">{sub}</span>
    </div>
  );
}

/* ── Metric strip (detail dialog only — the board's four facts live
      as one quiet line on the page itself) ─────────────────────────────── */

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="px-4 py-3 border border-border rounded-sm bg-card/50 min-w-0">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="font-mono text-xs uppercase tracking-wider truncate">
          {label}
        </span>
      </div>
      <span className="font-mono text-lg font-bold tabular-nums tracking-tight text-foreground">
        {value}
      </span>
      <span className="block text-xs text-muted-foreground leading-tight mt-0.5">
        {sub}
      </span>
    </div>
  );
}

/* ── Initials badge (SVG data URI) ────────────────────────────────────────── */

function initialsBadge(initials: string, tint: string, size = 10) {
  return `data:image/svg+xml;base64,${btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size * 10}" height="${size * 10}" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="45" fill="${tint}" />
      <text x="50" y="58" font-family="Arial" font-size="32" font-weight="600" fill="#000" text-anchor="middle">${initials}</text>
    </svg>`
  )}`;
}

/* ── Round row — a departure on the board ──────────────────────────────── */

function RaiseRow({
  raise,
  poll,
  onOpen,
}: {
  raise: ShippingRaise;
  poll?: PollInfo;
  onOpen: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const countdown = useCountdown(raise.closes_on);
  const verified = Boolean(raise.github_handle);
  const live = !countdown.ended;
  const decided = poll?.state === "decided_commit" || poll?.state === "decided_no_commit";
  const yes = poll?.yes ?? 0;
  const no = poll?.no ?? 0;
  const total = yes + no;
  const shortCode = raise.id.split("-").slice(-2).join("-").toUpperCase();
  // The decision window: last 30 minutes turn the clock to the signal colour.
  const urgent = live && countdown.total < 30 * 60 * 1000;
  const logo = raise.logo_url && !imgError ? (
    <img
      src={raise.logo_url}
      alt={`${raise.company} logo`}
      width={32}
      height={32}
      className="w-8 h-8 object-contain rounded-sm"
      onError={() => setImgError(true)}
    />
  ) : (
    <img
      src={initialsBadge(raise.initials || "RG", raise.tint || "#7c5cff")}
      alt=""
      width={32}
      height={32}
      className="w-8 h-8 object-contain rounded-sm"
      draggable={false}
    />
  );

  return (
    <button
      onClick={onOpen}
      className="w-full text-left border border-border rounded-sm overflow-hidden hover:border-primary/40 hover:bg-white/[0.02] transition-colors duration-150 cursor-pointer group min-w-0"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[168px_1fr_200px_220px] items-stretch">
        {/* Gate: status + round code */}
        <div className="flex lg:flex-col items-center lg:items-start gap-3 md:gap-1.5 px-4 py-4 lg:py-5 lg:border-r border-border font-mono text-xs">
          <span
            className={`inline-flex items-center gap-1.5 font-semibold tracking-widest ${
              live ? "text-ok" : "text-muted-foreground"
            }`}
          >
            {live ? (
              <span className="live-dot" aria-hidden="true" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" aria-hidden="true" />
            )}
            {live ? "LIVE" : "CLOSED"}
          </span>
          <span className="text-foreground font-semibold">
            {shortCode}
          </span>
          <span className="hidden lg:block text-muted-foreground">
            decision T−30 min
          </span>
        </div>

        {/* Manifest: who and what */}
        <div className="px-4 py-4 lg:py-5 min-w-0 lg:border-r border-border">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center justify-center w-8 h-8 rounded-sm bg-secondary border border-border overflow-hidden shrink-0">
              {logo}
            </span>
            <h3 className="font-display text-lg lg:text-xl uppercase tracking-tight truncate">
              {raise.company}
            </h3>
            {verified && (
              <span
                className="inline-flex items-center gap-1 font-mono text-xs text-ok shrink-0"
                title="Verified project GitHub"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> verified
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground leading-snug mt-1.5 line-clamp-2">
            {raise.tagline || "Escrowed AI-verified raise"}
          </p>
          <div className="flex items-center gap-3 mt-2 font-mono text-xs text-muted-foreground min-w-0">
            {raise.repo_url && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <Github className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[220px]">
                  {raise.repo_url.replace(/^https?:\/\/(www\.)?github\.com\//, "")}
                </span>
              </span>
            )}
            <span className="hidden lg:inline">
              {decided
                ? poll.state === "decided_commit"
                  ? "✓ commit found — releases to team"
                  : "✗ no commit — backers refunded"
                : total > 0
                ? `poll ${yes}–${no}`
                : "poll open · no votes yet"}
            </span>
          </div>
        </div>

        {/* Clock: the departure time */}
        <div className="px-4 py-3 lg:py-5 lg:border-r border-border flex lg:flex-col items-center lg:items-start justify-between gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {live ? "Closes in" : "Closed"}
          </span>
          {live ? (
            <span
              className={`font-mono font-bold tabular-nums text-2xl lg:text-[26px] leading-none ${
                urgent ? "text-primary" : "text-foreground"
              }`}
            >
              {countdown.days > 0 ? `${countdown.days}d ` : ""}
              {String(countdown.hours).padStart(2, "0")}:
              {String(countdown.minutes).padStart(2, "0")}:
              {String(countdown.seconds).padStart(2, "0")}
            </span>
          ) : (
            <span className="font-mono font-bold text-2xl lg:text-[26px] leading-none text-muted-foreground">
              —
            </span>
          )}
          <span className="font-mono text-xs text-muted-foreground">
            {new Date(raise.closes_on).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Load: escrow figure + poll tally instrument */}
        <div className="px-4 py-4 lg:py-5 bg-card lg:bg-transparent flex flex-col justify-center gap-2 border-t lg:border-t-0 border-border">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono font-bold tabular-nums text-xl text-foreground">
              {raise.raised}
            </span>
            <span className="font-mono text-xs text-muted-foreground">GEN escrowed</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden bg-border flex" aria-hidden="true">
            <div
              className="bg-primary transition-all duration-500"
              style={{ width: total ? `${Math.round((yes / total) * 100)}%` : "0%" }}
            />
          </div>
          <div className="font-mono text-xs text-muted-foreground">
            {decided ? (
              poll.state === "decided_commit" ? (
                <span className="text-ok font-semibold">released · settlement on-chain</span>
              ) : (
                <span className="text-destructive font-semibold">refunded to backers</span>
              )
            ) : total > 0 ? (
              <>
                <span className="text-foreground font-semibold">YES {yes}</span> · NO {no} ·{" "}
                {total} vote{total === 1 ? "" : "s"}
              </>
            ) : (
              "no votes yet"
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ── Countdown display ────────────────────────────────────────────────────── */

export function CountdownDisplay({
  parts,
  compact = false,
}: {
  parts: CountdownParts;
  compact?: boolean;
}) {
  if (parts.ended) {
    return (
      <span className={`inline-flex items-center gap-1.5 font-semibold ${compact ? "text-sm" : "text-base"} text-muted-foreground`}>
        <Zap className="w-3.5 h-3.5" /> Ended
      </span>
    );
  }
  const cells = [
    { v: parts.days, l: "days" },
    { v: parts.hours, l: "hrs" },
    { v: parts.minutes, l: "min" },
    { v: parts.seconds, l: "sec" },
  ];
  return (
    <div className={`flex items-center gap-1 ${compact ? "" : ""}`}>
      {cells.map((c, i) => (
        <div key={c.l} className="flex items-center gap-1">
          <div className={`flex flex-col items-center justify-center rounded-md bg-background border border-border ${compact ? "px-1 py-0.5 min-w-[26px]" : "px-2.5 py-1.5 min-w-[52px]"}`}>
            <span className={`font-mono font-bold tabular-nums ${compact ? "text-xs" : "text-xl"}`}>
              {String(c.v).padStart(2, "0")}
            </span>
          </div>
          {!compact && <span className="text-xs text-muted-foreground uppercase tracking-wide">{c.l}</span>}
          {i < cells.length - 1 && (
            <span className={`text-muted-foreground/40 font-bold ${compact ? "text-xs" : ""}`}>:</span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Community poll widget ────────────────────────────────────────────────── */

function PollWidget({
  raiseId,
  poll,
  address,
  closed,
  onVoted,
  repoUrl,
}: {
  raiseId: string;
  poll?: PollInfo;
  address?: string | null;
  closed: boolean;
  onVoted?: () => void;
  /** Repo the raise stems from — used to build the commit link. */
  repoUrl?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const yes = poll?.yes ?? 0;
  const no = poll?.no ?? 0;
  const total = yes + no;
  const state = poll?.state ?? "open";
  const pct = total ? Math.round((yes / total) * 100) : 50;
  const commitSha = poll?.commit_sha || "";
  const commitUrl = `${(repoUrl || "https://github.com/latest63/shipguard").replace(/\/+$/, "")}/commit/${commitSha}`;
  // The loop stores the settlement tx hash in the reason ("... · tx 0x…").
  const settleTx = (poll?.reason || "").match(/tx (0x[0-9a-fA-F]{64})/)?.[1] || "";
  const cleanReason = (poll?.reason || "").replace(/\s*·\s*tx 0x[0-9a-fA-F]+/, "");

  const vote = async (choice: "commit" | "no_commit") => {
    if (!address || busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/raise/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raise_id: raiseId, voter: address, choice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "vote failed");
      onVoted?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Community poll — should the team commit before close?
        </p>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
            state === "decided_commit"
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : state === "decided_no_commit"
              ? "border-red-500/30 bg-red-500/10 text-red-400"
              : "border-amber-500/30 bg-amber-500/10 text-amber-400"
          }`}
        >
          {state === "decided_commit"
            ? "Commit triggered ✓"
            : state === "decided_no_commit"
            ? "No commit ✗"
            : "Voting open"}
        </span>
      </div>

      {/* Tally bar */}
      <div className="h-2 rounded-full overflow-hidden bg-red-500/20 flex mb-1.5">
        <div className="bg-green-500 transition-all duration-500" style={{ width: `${total ? pct : 0}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs mb-3">
        <span className="text-green-400 font-semibold">Commit {yes}</span>
        <span className="text-muted-foreground">{total} vote{total === 1 ? "" : "s"}</span>
        <span className="text-red-400 font-semibold">{no} No commit</span>
      </div>

      {state === "open" && !closed ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => vote("commit")}
              disabled={!address || busy}
              className="px-3 py-2 rounded-md text-xs font-semibold border border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? "..." : "Yes — commit"}
            </button>
            <button
              onClick={() => vote("no_commit")}
              disabled={!address || busy}
              className="px-3 py-2 rounded-md text-xs font-semibold border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? "..." : "No — refund backers"}
            </button>
          </div>
          {!address && (
            <p className="text-xs text-muted-foreground mt-2">
              Connect your wallet to vote (no transaction needed).
            </p>
          )}
          {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {state === "decided_commit"
              ? `Decided: commit ${cleanReason}${commitSha ? ` (${commitSha.slice(0, 7)})` : ""} — the AI condition checks the repo at close.`
              : state === "decided_no_commit"
              ? `Decided: ${cleanReason || "no commit"} — funds refund to backers at close.`
              : "Voting is closed for this raise."}
          </p>
          {state === "decided_commit" && commitSha && (
            <a
              href={commitUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-400 hover:underline"
            >
              <Github className="w-3.5 h-3.5" />
              View commit {commitSha.slice(0, 7)} on GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {settleTx && (
            <a
              href={`https://explorer-studio-dev.genlayer.com/tx/${settleTx}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <Layers className="w-3.5 h-3.5" />
              View settlement on-chain {settleTx.slice(0, 10)}…
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Project detail dialog ────────────────────────────────────────────────── */

function RaiseDetailDialog({
  raise,
  allRaises,
  poll,
  onClose,
  onDeposited,
  onPollUpdate,
}: {
  raise: ShippingRaise;
  allRaises: ShippingRaise[];
  poll?: PollInfo;
  onClose: () => void;
  onDeposited?: () => void;
  onPollUpdate?: () => void;
}) {
  const countdown = useCountdown(raise.closes_on);
  const verified = Boolean(raise.github_handle);

  // ── Deposit wiring (live raises) ────────────────────────────────────────
  // The raise id IS the on-chain vault id, so backers deposit straight into
  // raise.id. Uses the same wallet + deposit hook as the VaultList component.
  const { address, isConnected, connectWallet } = useWallet();
  const deposit = useDeposit();
  const [amount, setAmount] = useState("");
  const [depositError, setDepositError] = useState("");

  const handleDeposit = async () => {
    setDepositError("");
    // Two-step connect: if not connected, connect first and wait for state to refresh
    // The button re-renders with isConnected/address only after a React update.
    if (!isConnected || !address) {
      try {
        await connectWallet();
        // Wait a tick for wagmi state to propagate to useWallet()
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch {
        return;
      }
      // After connect, re-check if wallet is actually connected (state may have updated)
      if (!isConnected || !address) {
        setDepositError("Failed to connect wallet. Please try again.");
        return;
      }
    }
    const gen = parseFloat(amount);
    if (!amount || Number.isNaN(gen) || gen <= 0) {
      setDepositError("Enter an amount greater than 0 to back this raise.");
      return;
    }
    const wei = BigInt(Math.round(gen * 1e18)).toString();
    try {
      await deposit.mutateAsync({ vault_id: raise.id, amount: wei });
      success(`Backed with ${gen} GEN`, {
        description: `Your deposit into ${raise.company} is confirmed on-chain.`,
      });
      setAmount("");
      onDeposited?.();
    } catch (e: any) {
      setDepositError(e?.message || "The deposit could not be submitted.");
    }
  };

  // Metric: number of raises launched by the same project.
  const projectKey = raise.project_id || raise.company;
  const projectRaises = allRaises.filter(
    (r) => (r.project_id || r.company) === projectKey
  );
  const projectRaiseCount = projectRaises.length;
  const projectTotalRaised = formatTotal(
    projectRaises.reduce((sum, r) => sum + parseRaised(r.raised), 0)
  );

  const socials: { href: string; icon: React.ComponentType<{ className?: string }>; label: string }[] = [];
  if (raise.project_link) socials.push({ href: normalizeUrl(raise.project_link), icon: Globe, label: "Website" });
  if (raise.repo_url) socials.push({ href: normalizeUrl(raise.repo_url), icon: Github, label: "GitHub" });
  if (raise.twitter) socials.push({ href: normalizeSocial(raise.twitter, "twitter"), icon: Twitter, label: "Twitter" });
  if (raise.telegram) socials.push({ href: normalizeSocial(raise.telegram, "telegram"), icon: Send, label: "Telegram" });
  if (raise.discord) socials.push({ href: normalizeSocial(raise.discord, "discord"), icon: MessageCircle, label: "Discord" });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border/60">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 overflow-hidden shrink-0">
              {raise.logo_url ? (
                <img src={raise.logo_url} alt={`${raise.company} logo`} className="w-full h-full object-contain" />
              ) : (
                <img src={initialsBadge(raise.initials || "RG", raise.tint || "#7c5cff")} alt="" className="w-16 h-16 object-contain" draggable={false} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-xl font-bold tracking-tight truncate">{raise.company}</h2>
                {verified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20 shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-[160px]">
                      Verified GitHub{raise.github_handle ? ` @${raise.github_handle}` : ""}
                    </span>
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1.5 break-words">
                {raise.description || raise.tagline || "Escrowed AI-verified raise."}
              </p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
              ✕
            </button>
          </div>

          {/* Bigger countdown */}
          <div className="mt-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              {countdown.ended ? "Raise has ended" : "Time remaining"}
            </p>
            <CountdownDisplay parts={countdown} />
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-3 p-6 border-b border-border/60">
          <MetricCard icon={Coins} label="GEN raised" value={raise.raised} sub="raised in this round" />
          <MetricCard icon={Layers} label="Raises by project" value={String(projectRaiseCount)} sub="launched on-chain" />
          <MetricCard icon={ShieldCheck} label="Status" value={countdown.ended ? "Ended" : "Live"} sub={verified ? "GitHub verified" : "not verified"} />
        </div>

        {/* Community poll: commit or not — decided before close */}
        <div className="p-6 border-b border-border/60">
          <PollWidget raiseId={raise.id} poll={poll} address={address} closed={countdown.ended} onVoted={onPollUpdate} repoUrl={raise.repo_url} />
        </div>

        {/* Raise-specific details */}
        <div className="p-6 space-y-4">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
              Deliverable condition
            </p>
            <p className="text-sm leading-relaxed bg-muted/40 border border-border rounded-lg p-3 break-words">
              {raise.description || raise.tagline || "AI-verified deliverable."}
            </p>
          </div>

          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
              Close date
            </p>
            <p className="text-sm">
              {new Date(raise.closes_on).toLocaleString(undefined, {
                weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>

          {/* Socials & links */}
          {socials.length > 0 && (
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Project links
              </p>
              <div className="flex flex-wrap gap-2">
                {socials.map((s) => {
                  const Icon = s.icon;
                  return (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-foreground/80 hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      <Icon className="w-4 h-4" /> {s.label} <ExternalLink className="w-3 h-3 opacity-50" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {countdown.ended ? (
            <>
              <Button variant="outline" size="lg" className="w-full gap-2 opacity-60 cursor-not-allowed" disabled>
                <Zap className="w-5 h-5" /> Raise has ended
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                This round is closed — no longer accepting deposits.
              </p>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="GEN amount"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setDepositError("");
                  }}
                  className="flex-1 min-w-0 rounded-lg border border-border bg-white/[0.02] px-3 py-2.5 text-sm tabular-nums outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                />
                <Button
                  variant="gradient"
                  size="lg"
                  className="gap-2 shrink-0"
                  onClick={handleDeposit}
                  disabled={deposit.isPending}
                >
                  {deposit.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Coins className="w-5 h-5" />
                  )}
                  {deposit.isPending ? "Depositing…" : isConnected ? "Back this raise" : "Connect & back"}
                </Button>
              </div>
              {depositError && (
                <p className="text-xs text-destructive break-words">{depositError}</p>
              )}
              <p className="text-center text-xs text-muted-foreground">
                Locks GEN into this raise's escrow — released to the team only
                if the condition passes verification.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── "How to" walkthrough ─────────────────────────────────────────────────── */

type GuideStep = { label: string; body: ReactNode };

const GUIDE_STEPS: GuideStep[] = [
  {
    label: "1 · Connect your wallet",
    body: (
      <>
        <b>Connect wallet</b> in the navbar, then approve the switch to{" "}
        <b>Studio Next (chain 61997)</b>. Use a normal browser window — in
        incognito or a plain mobile browser there&apos;s no wallet to approve.
      </>
    ),
  },
  {
    label: "2 · Pick a live raise",
    body: (
      <>
        Each round runs <b>5 hours</b> and a new one opens every hour. The
        countdown shows when it closes.
      </>
    ),
  },
  {
    label: "3 · Back the raise",
    body: (
      <>
        Open a round, enter an amount, press <b>Deposit</b> and approve it. Your
        GEN locks in the vault until the verdict.
      </>
    ),
  },
  {
    label: "4 · Vote in the community poll",
    body: (
      <>
        <b className="text-green-400">Yes — commit</b> asks the team to push the
        milestone commit; <b className="text-red-400">No — refund</b> ends the
        round with everyone paid back. One vote per wallet — instant, no gas.
      </>
    ),
  },
  {
    label: "5 · T‐30 min — the decision",
    body: (
      <>
        Thirty minutes before close, majority Yes → a real commit hits GitHub and
        the card flips to{" "}
        <b className="text-green-400">✓ Commit found</b> with a link to it.
      </>
    ),
  },
  {
    label: "6 · At close — AI verdict, money moves",
    body: (
      <>
        The AI checks the repo: commit found inside the window → escrow{" "}
        <b className="text-green-400">releases to the team</b>; none →{" "}
        <b className="text-red-400">everyone refunded</b>. The settlement tx link
        makes it verifiable.
      </>
    ),
  },
];

function HowToDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-4 border-b border-border/60 flex items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-semibold tracking-wide uppercase mb-2">
              <HelpCircle className="w-3 h-3" />
              Demo walkthrough
            </p>
            <h2 className="text-xl font-bold tracking-tight">How to try it</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Six steps, about two minutes — from connect to an on-chain payout.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-3">
          {GUIDE_STEPS.map((step) => (
            <div
              key={step.label}
              className="rounded-lg border border-border bg-muted/30 p-4"
            >
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary mb-1.5">
                {step.label}
              </p>
              <div className="text-sm leading-relaxed text-foreground/90">
                {step.body}
              </div>
            </div>
          ))}

          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-md bg-primary/15 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/25 transition-colors"
          >
            Got it — show me the raises
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── URL helpers ──────────────────────────────────────────────────────────── */

function normalizeUrl(u: string): string {
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

function normalizeSocial(value: string, kind: "twitter" | "telegram" | "discord"): string {
  const v = value.trim().replace(/^@/, "");
  if (/^https?:\/\//i.test(v)) return v;
  if (kind === "twitter") return `https://x.com/${v.replace(/^https?:\/\/(x|twitter)\.com\//i, "")}`;
  if (kind === "telegram") return `https://t.me/${v.replace(/^https?:\/\/t\.me\//i, "")}`;
  if (kind === "discord") return /^https?:\/\//i.test(v) || v.includes("discord.gg") ? (v.includes("discord.gg") ? `https://${v}` : v) : `https://discord.gg/${v}`;
  return v;
}