"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { fetchRaises, parseRaised, formatTotal, type ShippingRaise } from "@/lib/raises";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { Loader2, Coins, Gavel, ShieldCheck, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ExplorePage() {
  const [raises, setRaises] = useState<ShippingRaise[]>([]);
  const [filter, setFilter] = useState<"all" | "live" | "ended">("all");
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
  // Browsing the page never requires a connection.
  const handleBack = () => {
    if (!isConnected) {
      openConnectModal?.();
    }
    // Once connected, this is where the actual deposit transaction goes.
  };

  // Derive stats from table data
  const totalRaised = formatTotal(raises.reduce((sum, r) => sum + parseRaised(r.raised), 0));
  const verifiedCount = raises.filter((r) => r.verified).length;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow pt-24 pb-20">
        <div className="shell">
          {/* ── Header with Live badge ───────────────────────────────────── */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              {/* Live badge — stylish */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[11px] font-semibold tracking-wide uppercase">
                <Zap className="w-3 h-3" />
                Live
              </span>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Open Raises
              </h1>
            </div>
            <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
              Every raise is escrowed — funds are locked until the condition is
              verified by AI at the close date. Backers can always claim a
              refund after settlement.
            </p>
          </div>

          {/* ── Filter tabs: All / Live / Ended ─────────────────────────── */}
          <div className="flex gap-1.5 mb-6 bg-background border border-border rounded-lg p-1 w-fit">
            {(["all", "live", "ended"] as const).map((f) => {
              const active = filter === f;
              const count =
                f === "all" ? raises.length : f === "live" ? liveRaises.length : endedRaises.length;
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
              icon={Clock}
              label="Open rounds"
              value={String(raises.length)}
              sub="actively funding"
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
              value={String(verifiedCount)}
              sub={`of ${raises.length} passes AI check`}
            />
            <MetricCard
              icon={Gavel}
              label="Settlement"
              value="Auto"
              sub="release or refund at deadline"
            />
          </div>

          {/* ── Loading / List ───────────────────────────────────────────── */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Loading open raises...
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
                  : "No open raises yet"}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Raises will appear here once they are launched on-chain.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleRaises.map((raise) => (
                <RaiseRow key={raise.id} raise={raise} onBack={handleBack} />
              ))}
            </div>
          )}
        </div>
      </main>
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

/* ── Raise row ────────────────────────────────────────────────────────────── */

function RaiseRow({ raise, onBack }: { raise: ShippingRaise; onBack: () => void }) {
  const [imgError, setImgError] = useState(false);
  const closes = new Date(raise.closes_on);
  const closesLabel = closes.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  // Logo or initials badge
  const logo = raise.logo_url && !imgError ? (
    <img
      src={raise.logo_url}
      alt={`${raise.company} logo`}
      className="w-10 h-10 object-contain"
      onError={() => setImgError(true)}
    />
  ) : null;

  const initialsBadge = `data:image/svg+xml;base64,${btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="45" fill="${raise.tint}" />
      <text x="50" y="58" font-family="Arial" font-size="32" font-weight="600" fill="#000" text-anchor="middle">${raise.initials}</text>
    </svg>`
  )}`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 p-4 sm:p-5 bg-background border border-border rounded-lg hover:border-border/80 transition-colors duration-150">
      {/* Company mark */}
      <div className="flex items-center gap-3 sm:w-56 shrink-0">
        <div className="flex items-center justify-center w-10 h-10 bg-background border border-border rounded shrink-0">
          {logo ?? (
            <img
              src={initialsBadge}
              alt={`${raise.initials} fallback`}
              className="w-10 h-10 object-contain rounded"
              draggable={false}
            />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">
            {raise.company}
          </p>
          <p className="text-xs text-muted-foreground leading-tight truncate">
            {raise.tagline}
          </p>
        </div>
      </div>

      {/* Progress bar (hidden on mobile — shown below) */}
      <div className="hidden sm:flex flex-1 items-center gap-4 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="raise-bar mb-1.5" role="presentation">
            <span style={{ width: `${raise.progress}%` }} />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="tabular-nums">{raise.progress}% of target</span>
            <span>Closes {closesLabel}</span>
          </div>
        </div>
      </div>

      {/* Raised amount + verified badge + Back button */}
      <div className="flex items-center gap-3 sm:gap-4 sm:ml-auto sm:w-auto w-full sm:w-auto">
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold tabular-nums tracking-tight">
            {raise.raised}
          </span>
          <span className="text-[11px] text-muted-foreground">GEN</span>
        </div>
        {raise.verified && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium border border-primary/20"
            title="Condition verified"
          >
            <ShieldCheck className="w-3 h-3" />
            Verified
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="ml-auto sm:ml-0 shrink-0 border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 hover:text-primary"
        >
          <Coins className="w-3.5 h-3.5 mr-1" />
          Back
        </Button>
      </div>

      {/* Mobile-only progress */}
      <div className="sm:hidden">
        <div className="raise-bar mb-1.5" role="presentation">
          <span style={{ width: `${raise.progress}%` }} />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="tabular-nums">{raise.progress}% of target</span>
          <span>Closes {closesLabel}</span>
        </div>
      </div>
    </div>
  );
}
