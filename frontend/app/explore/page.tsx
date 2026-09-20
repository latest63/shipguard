"use client";

import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { fetchRaises, parseRaised, formatTotal, type ShippingRaise } from "@/lib/raises";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { Loader2, Coins, Gavel, ShieldCheck, Clock, Zap, Github, Globe, Twitter, Send, MessageCircle, ExternalLink, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCountdown, type CountdownParts } from "@/lib/useCountdown";

export default function ExplorePage() {
  const [raises, setRaises] = useState<ShippingRaise[]>([]);
  const [filter, setFilter] = useState<"all" | "live" | "ended">("all");
  const [selected, setSelected] = useState<ShippingRaise | null>(null);
  const [loading, setLoading] = useState(true);
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  useEffect(() => {
    // Self-maintaining sync: pull any on-chain vaults missing from Supabase
    // (e.g. past raises that predate the indexing fix), then load the list.
    fetch("/api/raise/sync")
      .catch(() => {})
      .then(() => fetchRaises())
      .then(setRaises)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

  // Back a raise — only asks for wallet when actually clicking Back.
  const handleBack = (e: React.MouseEvent, raise: ShippingRaise) => {
    e.stopPropagation();
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    // Once connected, this is where the actual deposit transaction goes.
  };

  // Derive stats from table data
  const totalRaised = formatTotal(raises.reduce((sum, r) => sum + parseRaised(r.raised), 0));
  const liveCount = liveRaises.length;
  const endedCount = endedRaises.length;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow pt-24 pb-20">
        <div className="shell">
          {/* ── Header with Live badge ───────────────────────────────────── */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[11px] font-semibold tracking-wide uppercase">
                <Zap className="w-3 h-3" />
                Live
              </span>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Explore Raises
              </h1>
            </div>
            <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
              Every raise is escrowed and stems from a project. Funds are locked
              until the condition is verified by AI at the close date — the team
              shows the verified project GitHub that backs each raise.
            </p>
          </div>

          {/* ── Filter tabs: All / Live / Ended ─────────────────────────── */}
          <div className="flex gap-1.5 mb-6 bg-background border border-border rounded-lg p-1 w-fit">
            {(["all", "live", "ended"] as const).map((f) => {
              const active = filter === f;
              const count =
                f === "all" ? raises.length : f === "live" ? liveCount : endedCount;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                  <span className={`ml-1.5 text-xs tabular-nums ${active ? "text-primary/70" : "text-muted-foreground/60"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Metrics row ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
            <MetricCard
              icon={Layers}
              label="Projects raising"
              value={String(new Set(raises.map((r) => r.project_id || r.company)).size)}
              sub="across all rounds"
            />
            <MetricCard
              icon={Coins}
              label="GEN raised"
              value={totalRaised}
              sub="locked in escrow"
            />
            <MetricCard
              icon={ShieldCheck}
              label="Verified"
              value={String(raises.filter((r) => r.github_handle).length)}
              sub="with verified project GitHub"
            />
            <MetricCard
              icon={Gavel}
              label="Live rounds"
              value={String(liveCount)}
              sub={endedCount ? `+${endedCount} ended` : "still funding"}
            />
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
            <div className="grid md:grid-cols-2 gap-4">
              {visibleRaises.map((raise) => (
                <RaiseCard
                  key={raise.id}
                  raise={raise}
                  onOpen={() => setSelected(raise)}
                  onBack={(e) => handleBack(e, raise)}
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
          onClose={() => setSelected(null)}
          onBack={handleBack}
        />
      )}
    </div>
  );
}

/* ── Metric card ──────────────────────────────────────────────────────────── */

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
    <div className="bg-background border border-border rounded-lg p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[11px] font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <span className="text-xl font-bold tabular-nums tracking-tight text-foreground">
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground/70 leading-tight">
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

/* ── Raise card ───────────────────────────────────────────────────────────── */

function RaiseCard({
  raise,
  onOpen,
  onBack,
}: {
  raise: ShippingRaise;
  onOpen: () => void;
  onBack: (e: React.MouseEvent) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const countdown = useCountdown(raise.closes_on);
  const verified = Boolean(raise.github_handle);
  const logo = raise.logo_url && !imgError ? (
    <img
      src={raise.logo_url}
      alt={`${raise.company} logo`}
      className="w-12 h-12 object-contain rounded-lg"
      onError={() => setImgError(true)}
    />
  ) : null;

  return (
    <button
      onClick={onOpen}
      className="text-left bg-background border border-border rounded-xl p-5 hover:border-primary/40 hover:bg-white/[0.02] transition-all duration-150 flex flex-col gap-4 cursor-pointer group"
    >
      {/* Header: logo + name + verified */}
      <div className="flex items-start gap-3">
        <div className="relative flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 overflow-hidden shrink-0">
          {logo ?? (
            <img src={initialsBadge(raise.initials || "RG", raise.tint || "#7c5cff")} alt="" className="w-12 h-12 object-contain rounded-lg" draggable={false} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold tracking-tight truncate">{raise.company}</h3>
            {verified && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold border border-primary/20 shrink-0"
                title="Verified project GitHub"
              >
                <ShieldCheck className="w-3 h-3" /> Verified
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-snug line-clamp-2 mt-0.5">
            {raise.tagline || "Escrowed AI-verified raise"}
          </p>
        </div>
      </div>

      {/* Countdown */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-muted-foreground text-xs">Closes</span>
        </div>
        <CountdownDisplay parts={countdown} compact />
      </div>

      {/* Footer: raised + repo + click hint */}
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="text-lg font-bold tabular-nums tracking-tight">{raise.raised}</span>
          <span className="text-[11px] text-muted-foreground">GEN raised</span>
        </div>
        <div className="flex items-center gap-3 min-w-0">
          {raise.repo_url && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground min-w-0">
              <Github className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[150px]">
                {raise.repo_url.replace(/^https?:\/\/(www\.)?github\.com\//, "")}
              </span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            Details <ExternalLink className="w-3 h-3" />
          </span>
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
    <div className={`flex items-center gap-1.5 ${compact ? "" : ""}`}>
      {cells.map((c, i) => (
        <div key={c.l} className="flex items-center gap-1.5">
          <div className={`flex flex-col items-center justify-center rounded-md bg-background border border-border ${compact ? "px-1.5 py-0.5 min-w-[34px]" : "px-2.5 py-1.5 min-w-[52px]"}`}>
            <span className={`font-mono font-bold tabular-nums ${compact ? "text-sm" : "text-xl"}`}>
              {String(c.v).padStart(2, "0")}
            </span>
          </div>
          {!compact && <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{c.l}</span>}
          {i < cells.length - 1 && (
            <span className="text-muted-foreground/40 font-bold">:</span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Project detail dialog ────────────────────────────────────────────────── */

function RaiseDetailDialog({
  raise,
  allRaises,
  onClose,
  onBack,
}: {
  raise: ShippingRaise;
  allRaises: ShippingRaise[];
  onClose: () => void;
  onBack: (e: React.MouseEvent, raise: ShippingRaise) => void;
}) {
  const countdown = useCountdown(raise.closes_on);
  const verified = Boolean(raise.github_handle);

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
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold border border-primary/20 shrink-0">
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
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {countdown.ended ? "Raise has ended" : "Time remaining"}
            </p>
            <CountdownDisplay parts={countdown} />
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-3 p-6 border-b border-border/60">
          <MetricCard icon={Coins} label="GEN raised" value={raise.raised} sub="locked in this raise" />
          <MetricCard icon={Layers} label="Raises by project" value={String(projectRaiseCount)} sub="launched on-chain" />
          <MetricCard icon={ShieldCheck} label="Status" value={countdown.ended ? "Ended" : "Live"} sub={verified ? "GitHub verified" : "not verified"} />
        </div>

        {/* Raise-specific details */}
        <div className="p-6 space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Deliverable condition
            </p>
            <p className="text-sm leading-relaxed bg-muted/40 border border-border rounded-lg p-3 break-words">
              {raise.description || raise.tagline || "AI-verified deliverable."}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
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
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
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

          <Button
            variant="gradient"
            size="lg"
            className="w-full gap-2"
            onClick={(e) => onBack(e, raise)}
          >
            <Coins className="w-5 h-5" /> Back this raise
          </Button>
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