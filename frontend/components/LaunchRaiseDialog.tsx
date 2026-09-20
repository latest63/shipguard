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
  GitBranch,
  Star,
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

/**
 * Launch a raise for a specific project, in a dialog.
 *
 * The form is written for a team raising from a community of investors, and
 * the fields are shaped around the on-chain validator:
 *   - Deliverable condition: a measurable deliverable, public on GitHub
 *     (commits are a great starting point).
 *   - Source of truth: because GitHub is verified, we fetch the user's own
 *     PUBLIC repos and let them pick which one the validator should check.
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
  const [condition, setCondition] = useState("");

  // Repo picker state
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoError, setRepoError] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [selectedBranch, setSelectedBranch] = useState("");

  const [errors, setErrors] = useState({
    teamAddress: "",
    deadline: "",
    condition: "",
    repo: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const deadlineTimestamp = useMemo(() => {
    if (!deadline) return "";
    return Math.floor(new Date(deadline).getTime() / 1000).toString();
  }, [deadline]);

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

  const validateForm = (): boolean => {
    const next = {
      teamAddress: "",
      deadline: "",
      condition: "",
      repo: "",
    };
    const team = useCustomTeam ? teamAddress.trim() : (address || "");
    if (!team) next.teamAddress = "Team wallet is required";
    else if (!/^0x[a-fA-F0-9]{40}$/.test(team))
      next.teamAddress = "Invalid wallet address";

    if (!deadline.trim()) next.deadline = "Close date is required";
    else if (new Date(deadline) <= new Date())
      next.deadline = "Close date must be in the future";

    if (!condition.trim()) next.condition = "Condition is required";
    else if (condition.trim().length < 12)
      next.condition =
        "Describe a measurable deliverable (e.g. 'at least 50 commits on the main branch')";

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

    // The source of truth is the selected repo's web URL. If a branch was
    // chosen, point at that branch's tree for a precise, reachable page.
    const branch = selectedBranch?.trim();
    const checkUrl = branch
      ? `${selectedRepo.html_url}/tree/${encodeURIComponent(branch)}`
      : selectedRepo.html_url;

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
          condition: condition.trim(),
          check_url: checkUrl,
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
    setCondition("");
    setRepos(null);
    setSelectedRepo(null);
    setSelectedBranch("");
    setRepoError("");
    setStep("form");
    setErrors({ teamAddress: "", deadline: "", condition: "", repo: "" });
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
            <p className="text-xs text-primary/90 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
              Raising as verified GitHub <strong>@{ghHandle}</strong>
              <Check className="w-3.5 h-3.5 inline" />
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
                <p className="text-muted-foreground">Deliverable condition:</p>
                <p className="mt-0.5">{condition}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Source of truth:</p>
                <p className="mt-0.5 break-all text-primary">{selectedRepo?.html_url}</p>
                {selectedBranch && (
                  <p className="text-[11px] text-muted-foreground">
                    Branch: {selectedBranch}
                  </p>
                )}
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

            {/* Condition */}
            <div className="space-y-2">
              <Label htmlFor="ra-condition" className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-primary" /> Deliverable condition
              </Label>
              <textarea
                id="ra-condition"
                rows={3}
                placeholder="e.g. The team ships at least 50 commits on the main branch of the selected repo"
                value={condition}
                onChange={(e) => {
                  setCondition(e.target.value);
                  setErrors({ ...errors, condition: "" });
                }}
                className={
                  "w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 resize-y " +
                  (errors.condition ? "border-destructive" : "")
                }
              />
              <div className="rounded-lg border border-border/40 bg-white/[0.02] p-3">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  State a <strong>measurable deliverable</strong> that is public on
                  GitHub and can be checked — for example, a minimum number of
                  commits on a branch, a released tag, or a merged PR count.
                  Commits are a strong starting point: they&apos;re permanent,
                  public, and easy to count. The AI releases funds only if this is
                  clearly met.
                </p>
              </div>
              {errors.condition && (
                <p className="text-xs text-destructive">{errors.condition}</p>
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
                    Selected source of truth
                  </p>
                  <p className="break-all text-sm">{selectedRepo.html_url}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <label className="text-[11px] text-muted-foreground shrink-0">
                      Branch
                    </label>
                    <input
                      type="text"
                      value={branchFor(selectedRepo)}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full bg-white/[0.03] border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:border-primary/50"
                    />
                  </div>
                </div>
              )}
              {errors.repo && (
                <p className="text-xs text-destructive">{errors.repo}</p>
              )}
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