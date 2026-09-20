"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount } from "wagmi";
import {
  Rocket,
  Users,
  Calendar,
  ShieldCheck,
  Link,
  ArrowLeft,
  Loader2,
  Github,
  Check,
  GitCommitHorizontal,
  BookOpen,
  Star,
  Info,
  RefreshCw,
} from "lucide-react";
import { getGithubVerifyContractAddress } from "@/lib/genlayer/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { error, success } from "@/lib/utils/toast";
import type { Project } from "@/lib/projects";

const GITHUB_VERIFY_CONTRACT = getGithubVerifyContractAddress();

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

type Step = "form" | "review";

interface Repo {
  full_name: string;
  html_url: string;
  description: string | null;
  default_branch: string;
  pushed_at: string | null;
  stars: number;
}

// ── Source-of-truth guardrails (mirrors /raise/create) ──────────────────
// The deliverable condition is no longer free text. The user picks a
// *verifiable* check type and a threshold; we generate the exact plain-English
// condition the validator will judge, plus the GitHub API endpoint it should
// fetch (more reliable than the rendered HTML page — avoids false/inconclusive
// verdicts). Commit is the flagship, default and highlighted.
//
// The launch timestamp is embedded into commit conditions so the validator can
// compare commit dates against the raise period (launch → deadline).

type CheckType = "commit" | "readme" | "stars";

interface CheckOption {
  type: CheckType;
  label: string;
  icon: typeof GitCommitHorizontal;
  description: string;
}

const CHECK_OPTIONS: CheckOption[] = [
  {
    type: "commit",
    label: "Commit count",
    icon: GitCommitHorizontal,
    description: "Requires a minimum number of commits pushed during the raise period.",
  },
  {
    type: "readme",
    label: "README file",
    icon: BookOpen,
    description: "Requires a README on the default branch.",
  },
  {
    type: "stars",
    label: "Star count",
    icon: Star,
    description: "Requires the repo to reach a minimum star count.",
  },
];

const COMMIT_COUNTS = [1, 2, 3, 5, 10, 25];
const STAR_COUNTS = [1, 5, 10, 25, 50];

// GitHub API endpoint the validator fetches (source of truth), derived from
// the selected repo's full_name — far more reliably parseable than the page.
function apiUrlFor(fullName: string): string {
  return `https://api.github.com/repos/${fullName}`;
}

function buildCondition(
  type: CheckType,
  count: number,
  repoDisplay: string,
  launchTs: number,
): string {
  const launch = new Date(launchTs).toISOString();
  switch (type) {
    case "commit":
      return `The GitHub repository ${repoDisplay} must have at least ${count} commit${
        count === 1 ? "" : "s"
      } pushed after ${launch} (the raise launch time) and before the deadline. Base the count on the commits listed at the check URL.`;
    case "readme":
      return `The GitHub repository ${repoDisplay} must have a README file present on its default branch.`;
    case "stars":
      return `The GitHub repository ${repoDisplay} must have at least ${count} star${
        count === 1 ? "" : "s"
      }.`;
    default:
      return "";
  }
}

/**
 * Launch a raise for a specific project, in a dialog.
 *
 * The form is written for a team raising from a community of investors, and
 * the fields are shaped around the on-chain validator:
 *   - Deliverable condition: a measurable, verifiable type (commit default).
 *   - Source of truth: because GitHub is verified, we fetch the user's own
 *     PUBLIC repos and let them pick which one the validator should check.
 *   - Check URL: auto-derived to the GitHub API endpoint for reliable verdicts.
 */
export function LaunchRaiseDialog({
  open,
  onOpenChange,
  project,
  ghHandle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  ghHandle?: string;
}) {
  const { address, isConnected } = useAccount();

  const [step, setStep] = useState<Step>("form");
  const [teamAddress, setTeamAddress] = useState("");
  const [useCustomTeam, setUseCustomTeam] = useState(false);
  const [deadline, setDeadline] = useState("");

  // Guarded condition fields
  const [checkType, setCheckType] = useState<CheckType>("commit");
  const [threshold, setThreshold] = useState(1);

  // Repo picker state
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoError, setRepoError] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [selectedBranch, setSelectedBranch] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const deadlineTimestamp = useMemo(() => {
    if (!deadline) return "";
    return Math.floor(new Date(deadline).getTime() / 1000).toString();
  }, [deadline]);

  // Launch timestamp — embedded into commit conditions so the validator can
  // compare commit dates against the raise period.
  const launchTs = useMemo(() => Date.now(), []);

  // Load the verified user's public repos when the dialog opens.
  const loadRepos = async () => {
    if (!ghHandle) return;
    setRepoLoading(true);
    setRepoError("");
    try {
      const res = await fetch("/api/github-repos?handle=" + encodeURIComponent(ghHandle));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not load repos");
      const list: Repo[] = data?.repos || [];
      setRepos(list);
      // Auto-select the most recently pushed repo, with its default branch.
      if (list.length) {
        const first = list[0];
        setSelectedRepo(first);
        setSelectedBranch(first.default_branch || "");
      }
    } catch (e: any) {
      setRepoError(e?.message || "Could not load your repositories");
      setRepos([]);
    } finally {
      setRepoLoading(false);
    }
  };

  useEffect(() => {
    if (open && ghHandle) loadRepos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ghHandle]);

  const repoDisplay = selectedRepo?.full_name || "the selected repository";

  const generatedCondition = useMemo(
    () => buildCondition(checkType, threshold, repoDisplay, launchTs),
    [checkType, threshold, repoDisplay, launchTs],
  );

  // Check URL auto-derived to the GitHub API endpoint for reliable verdicts.
  const checkUrl = useMemo(
    () => (selectedRepo ? apiUrlFor(selectedRepo.full_name) : ""),
    [selectedRepo],
  );

  const countOptions = checkType === "stars" ? STAR_COUNTS : COMMIT_COUNTS;

  const validateForm = (): boolean => {
    const next: Record<string, string> = {};
    const team = useCustomTeam ? teamAddress.trim() : (address || "");
    if (!team) next.teamAddress = "Team wallet is required";
    else if (!/^0x[a-fA-F0-9]{40}$/.test(team))
      next.teamAddress = "Invalid wallet address";

    if (!deadline.trim()) next.deadline = "Close date is required";
    else if (new Date(deadline) <= new Date())
      next.deadline = "Close date must be in the future";

    if (!selectedRepo) next.repo = "Pick a public repo as the source of truth";

    setErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const createAndRegister = async () => {
    if (!address) {
      error("Please connect your wallet first");
      return;
    }
    if (!ghHandle) {
      error("Verify your GitHub first", {
        description:
          "You must verify your GitHub account before launching a raise.",
        action: { label: "Go to dashboard", onClick: () => onOpenChange(false) },
      });
      return;
    }
    if (!selectedRepo) {
      error("Pick a source of truth", {
        description: "Select a public repo the validator can check.",
      });
      return;
    }

    // Team wallet = connected wallet by default, or the custom one if switched.
    const team = useCustomTeam ? teamAddress.trim() : (address || "");
    if (!team) {
      error("Team wallet is required");
      return;
    }

    const projectSlug = (project?.name || "project")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "project";
    const id = `raise-${projectSlug}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    // Display fields for the explore page (Supabase `raises` table).
    const projectName = project?.name?.trim() || projectSlug;
    const projectTagline = (project?.profile_data?.description as string) || project?.link || "";
    const projectInitials = projectName.slice(0, 2).toUpperCase() || "RG";
    // Deterministic tint from the project name (for the explore initials badge).
    const tints = ["#7c5cff", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6"];
    let tint = tints[0];
    if (projectName) {
      let h = 0;
      for (let i = 0; i < projectName.length; i++) h = (h * 31 + projectName.charCodeAt(i)) >>> 0;
      tint = tints[h % tints.length];
    }
    const closesOn = deadline ? new Date(deadline).toISOString() : "";
    const extra = (project?.profile_data || {}) as Record<string, unknown>;

    setSubmitting(true);
    try {
      // Backend-signed (server holds the signer key) — same fix that made
      // GitHub verification work. No MetaMask write; no eth_sendTransaction.
      const res = await fetch("/api/raise/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          team_address: team,
          deadline: deadlineTimestamp,
          condition: generatedCondition,
          check_url: checkUrl,
          project_name: projectName,
          project_tagline: projectTagline,
          project_logo: project?.logo_url || "",
          project_initials: projectInitials,
          project_tint: tint,
          closes_on: closesOn,
          // Project-linkage (raise stems from the launching project).
          project_id: project?.id || undefined,
          project_wallet: project?.wallet_address || undefined,
          github_handle: ghHandle || undefined,
          project_link: project?.link || undefined,
          twitter: (extra.twitter as string) || undefined,
          telegram: (extra.telegram as string) || undefined,
          discord: (extra.discord as string) || undefined,
          description: (extra.description as string) || undefined,
          creator: address || undefined,
          repo_url: selectedRepo?.html_url || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Could not launch raise (HTTP ${res.status})`);

      success("Raise launched", {
        description: `Raise for ${project?.name || "your project"} is live. Backers can now deposit GEN into it.`,
      });
      resetForm();
      onOpenChange(false);
    } catch (e: any) {
      error("Could not launch raise", {
        description: e?.message || "The transaction could not be submitted.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTeamAddress("");
    setUseCustomTeam(false);
    setDeadline("");
    setCheckType("commit");
    setThreshold(1);
    setRepos(null);
    setSelectedRepo(null);
    setSelectedBranch("");
    setRepoError("");
    setStep("form");
    setErrors({});
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) {
      error("Connect your wallet", {
        description: "Please connect your wallet to launch a raise.",
      });
      return;
    }
    if (!validateForm()) return;
    setStep("review");
  };

  const branchFor = (repo: Repo) =>
    selectedRepo?.full_name === repo.full_name ? selectedBranch : repo.default_branch || "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="brand-card border-2 sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Rocket className="w-5 h-5" />
            Launch a raise
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {project?.name
              ? `Open an escrowed round for "${project.name}". Backers lock GEN — AI verifies you delivered against the condition before funds release.`
              : "Open an escrowed round. Backers lock GEN — AI verifies you delivered against the condition before funds release."}
          </DialogDescription>
        </DialogHeader>

        {/* GitHub gate */}
        {(ghHandle ? (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5">
            <p className="text-xs text-primary/90 flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">
                Raising as verified GitHub <strong>@{ghHandle}</strong>
              </span>
              <Check className="w-3.5 h-3.5 shrink-0" />
            </p>
            <Github className="w-4 h-4 text-primary shrink-0" />
          </div>
        ) : (
          GITHUB_VERIFY_CONTRACT && (
            <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm space-y-2">
              <div className="flex items-center gap-2 text-destructive font-medium">
                <Github className="w-4 h-4" /> GitHub verification required
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Verify your GitHub on your dashboard before launching a raise.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                <Github className="w-3.5 h-3.5 mr-1.5" /> Verify on dashboard
              </Button>
            </div>
          )
        ))}

        {step === "review" ? (
          <div className="mt-4 space-y-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setStep("form")}
              className="gap-2"
              disabled={submitting}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <div className="space-y-2.5 rounded-lg border border-border bg-muted/50 p-5 text-sm">
              <p className="eyebrow">Review</p>
              <p>
                <span className="text-muted-foreground">Project:</span>{" "}
                {project?.name || "Unnamed project"}
              </p>
              <p>
                <span className="text-muted-foreground">Team wallet:</span>{" "}
                <span className="break-all font-mono">
                  {useCustomTeam ? teamAddress : (address || "")}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Close date:</span>{" "}
                {new Date(deadline).toLocaleString()}
              </p>
              <div>
                <p className="text-muted-foreground">Source of truth (validator fetches):</p>
                <p className="mt-0.5 break-all text-primary">{checkUrl}</p>
              </div>
              <div className="pt-1 border-t border-border/40">
                <p className="eyebrow mt-2">Deliverable condition</p>
                <p className="leading-relaxed break-words">{generatedCondition}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Submits two transactions: the condition and source of truth are
              registered with the guardian, then the fund is opened. Both share
              one fund id.
            </p>
            <Button
              type="button"
              variant="gradient"
              className="w-full gap-2"
              onClick={createAndRegister}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Launching…
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" /> Confirm and launch
                </>
              )}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 mt-4">
            {/* Team wallet */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ra-team" className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" /> Team wallet
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomTeam((v) => !v);
                    setErrors({ ...errors, teamAddress: "" });
                  }}
                  className="inline-flex items-center gap-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="relative inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={useCustomTeam}
                      readOnly
                      className="sr-only"
                    />
                    <span
                      className={
                        "block h-4 w-7 rounded-full border transition-colors " +
                        (useCustomTeam
                          ? "bg-primary border-primary"
                          : "bg-white/10 border-border")
                      }
                    />
                    <span
                      className={
                        "absolute left-0.5 top-1/2 -translate-y-1/2 block h-3 w-3 rounded-full bg-white transition-transform " +
                        (useCustomTeam ? "translate-x-3" : "")
                      }
                    />
                  </span>
                  Use a different wallet
                </button>
              </div>

              {useCustomTeam ? (
                <>
                  <Input
                    id="ra-team"
                    type="text"
                    placeholder="0x… — where raise proceeds go"
                    value={teamAddress}
                    onChange={(e) => {
                      setTeamAddress(e.target.value);
                      setErrors({ ...errors, teamAddress: "" });
                    }}
                    className={errors.teamAddress ? "border-destructive" : ""}
                  />
                  {errors.teamAddress && (
                    <p className="text-xs text-destructive">{errors.teamAddress}</p>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-white/[0.02] px-3 py-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-foreground">Connected wallet (default)</p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                      {address ? shortAddr(address) : "Not connected"}
                    </p>
                  </div>
                  <Check className="w-4 h-4 text-primary shrink-0" />
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Where raise proceeds are released once the condition is met.
              </p>
            </div>

            {/* Close date */}
            <div className="space-y-2">
              <Label htmlFor="ra-deadline" className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" /> Close date
              </Label>
              <Input
                id="ra-deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => {
                  setDeadline(e.target.value);
                  setErrors({ ...errors, deadline: "" });
                }}
                className={errors.deadline ? "border-destructive" : ""}
              />
              <p className="text-[11px] text-muted-foreground">
                When the round closes and the condition is checked. Backers can
                deposit until this time.
              </p>
              {errors.deadline && (
                <p className="text-xs text-destructive">{errors.deadline}</p>
              )}
            </div>

            {/* Source of truth: public repo picker */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Link className="w-4 h-4 text-primary" /> Source of truth
              </Label>
              <p className="text-[11px] text-muted-foreground leading-relaxed -mt-1">
                Pick the <strong>public repo</strong> the validator will check to
                confirm delivery. These are your public repos under{" "}
                <strong>@{ghHandle}</strong>.
              </p>

              {repoLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading your repositories…
                </div>
              ) : repoError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{repoError}</p>
                  <button
                    type="button"
                    onClick={loadRepos}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                </div>
              ) : repos && repos.length > 0 ? (
                <div className="max-h-44 overflow-y-auto rounded-lg border border-border divide-y divide-border/60">
                  {repos.map((repo) => (
                    <button
                      type="button"
                      key={repo.full_name}
                      onClick={() => {
                        setSelectedRepo(repo);
                        setSelectedBranch(repo.default_branch || "");
                        setErrors({ ...errors, repo: "" });
                      }}
                      className={
                        "w-full flex flex-col items-start gap-1 px-3 py-2.5 text-left transition-colors " +
                        (selectedRepo?.full_name === repo.full_name
                          ? "bg-primary/10 border-l-2 border-primary"
                          : "hover:bg-white/[0.03]")
                      }
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Check
                          className={
                            "w-3.5 h-3.5 shrink-0 " +
                            (selectedRepo?.full_name === repo.full_name
                              ? "text-primary"
                              : "text-transparent")
                          }
                        />
                        <span className="text-sm font-medium truncate">
                          {repo.full_name}
                        </span>
                        {repo.stars > 0 && (
                          <span className="inline-flex items-center gap-1 ml-auto text-[11px] text-muted-foreground shrink-0">
                            <Star className="w-3 h-3" /> {repo.stars}
                          </span>
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 pl-5.5">
                          {repo.description}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-2">
                  No public repositories found under @{ghHandle}.
                </p>
              )}

              {selectedRepo && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
                  <p className="text-[11px] font-medium text-primary mb-1.5">
                    Validator will fetch
                  </p>
                  <p className="break-all text-sm">{checkUrl}</p>
                </div>
              )}
              {errors.repo && (
                <p className="text-xs text-destructive">{errors.repo}</p>
              )}
            </div>

            {/* Deliverable type selector */}
            <div className="space-y-2.5">
              <Label className="flex items-center gap-2">
                <GitCommitHorizontal className="w-4 h-4 text-primary" /> Deliverable
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {CHECK_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = checkType === opt.type;
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => setCheckType(opt.type)}
                      className={`text-left rounded-lg border p-3 transition-all duration-150 ${
                        active
                          ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
                          : "border-border/60 bg-background hover:border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`w-4 h-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-sm font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}>
                          {opt.label}
                        </span>
                        {opt.type === "commit" && (
                          <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-primary text-[9px] font-bold uppercase tracking-wide">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">{opt.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Threshold selector */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                {checkType === "commit" && <GitCommitHorizontal className="w-4 h-4 text-primary" />}
                {checkType === "readme" && <BookOpen className="w-4 h-4 text-primary" />}
                {checkType === "stars" && <Star className="w-4 h-4 text-primary" />}
                {checkType === "commit" && "Minimum commits"}
                {checkType === "readme" && "Requirement"}
                {checkType === "stars" && "Minimum stars"}
              </Label>
              <div className="flex flex-wrap gap-2">
                {countOptions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setThreshold(c)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-150 ${
                      threshold === c
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/60 bg-background text-muted-foreground hover:border-border"
                    }`}
                  >
                    {c}
                    {checkType === "commit" && c === 1 ? " commit" : " commits"}
                    {checkType === "stars" && (c === 1 ? " star" : " stars")}
                  </button>
                ))}
              </div>
              {checkType === "commit" && (
                <p className="text-[11px] text-muted-foreground">
                  Only commits pushed after {new Date(launchTs).toLocaleString()} count toward the target.
                </p>
              )}
            </div>

            {/* Generated condition preview */}
            <div className="rounded-lg border border-border/60 bg-muted/40 p-4 space-y-1.5">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                <Info className="w-3.5 h-3.5" /> Auto-generated condition
              </p>
              <p className="text-sm leading-relaxed text-foreground/90 break-words">{generatedCondition}</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="gradient"
                className="flex-1"
                disabled={!isConnected || repoLoading}
              >
                Continue
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}