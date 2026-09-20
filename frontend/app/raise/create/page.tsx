"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Globe,
  Star,
  Info,
} from "lucide-react";
import { createClient } from "genlayer-js";
import { useAccount } from "wagmi";
import {
  GENLAYER_CHAIN,
  getVaultContractAddress,
  getConditionContractAddress,
  getGithubVerifyContractAddress,
} from "@/lib/genlayer/client";
import { error, success } from "@/lib/utils/toast";

const GITHUB_VERIFY_CONTRACT = getGithubVerifyContractAddress();

// ── Source-of-truth guardrails ────────────────────────────────────────────
// Users can no longer type an arbitrary condition. They pick a *verifiable*
// check type, and we generate the exact plain-English condition string the
// validator will judge, plus the API endpoint it should fetch (more reliable
// than the rendered HTML page — avoids false/inconclusive verdicts).
//
// Commit is the flagship, highlighted and default-selected for the demo.
// The launch timestamp is embedded into the condition so the validator can
// compare commit dates against the raise period (launch → deadline).

type CheckType = "commit" | "readme" | "website" | "stars";

interface CheckOption {
  type: CheckType;
  label: string;
  icon: typeof GitCommitHorizontal;
  description: string;
  supported: boolean;
}

const CHECK_OPTIONS: CheckOption[] = [
  {
    type: "commit",
    label: "Commit count",
    icon: GitCommitHorizontal,
    description: "Requires a minimum number of commits pushed during the raise period.",
    supported: true,
  },
  {
    type: "readme",
    label: "README file",
    icon: BookOpen,
    description: "Requires a README on the default branch.",
    supported: true,
  },
  {
    type: "stars",
    label: "Star count",
    icon: Star,
    description: "Requires the repo to reach a minimum star count.",
    supported: true,
  },
  {
    type: "website",
    label: "Live website",
    icon: Globe,
    description: "Requires a live page to be reachable.",
    supported: true,
  },
];

const COMMIT_COUNTS = [1, 2, 3, 5, 10, 25];
const STAR_COUNTS = [1, 5, 10, 25, 50];

// Build the API endpoint the validator fetches (source of truth) from any
// GitHub repo link — far more reliably parseable than the rendered page.
function buildApiUrl(rawUrl: string): { apiUrl: string; owner: string; repo: string } {
  const cleaned = rawUrl.trim().replace(/\/+$/, "");
  const m = cleaned.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  if (!m) return { apiUrl: cleaned, owner: "", repo: "" };
  const [, owner, repo] = m;
  return {
    apiUrl: `https://api.github.com/repos/${owner}/${repo}`,
    owner,
    repo,
  };
}

// Generate the exact, verifiable condition string for the selected check.
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
    case "website":
      return `The website at the check URL must be reachable and return a successful response.`;
    default:
      return "";
  }
}

type Step = "form" | "review";

export default function LaunchRaisePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const vaultAddress = getVaultContractAddress();
  const conditionAddress = getConditionContractAddress();

  const [step, setStep] = useState<Step>("form");
  const [teamAddress, setTeamAddress] = useState("");
  const [deadline, setDeadline] = useState("");

  // ── Guarded condition fields ────────────────────────────────────────────
  const [checkType, setCheckType] = useState<CheckType>("commit");
  const [commitCount, setCommitCount] = useState(1);
  const [repoUrl, setRepoUrl] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // GitHub verification status for the connected wallet.
  const [ghHandle, setGhHandle] = useState("");
  const [ghChecked, setGhChecked] = useState(false);
  const [ghChecking, setGhChecking] = useState(true);

  useEffect(() => {
    if (!isConnected || !address || !GITHUB_VERIFY_CONTRACT) {
      setGhChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/github-verify?wallet=" + encodeURIComponent(address));
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setGhHandle(typeof data.verifiedHandle === "string" ? data.verifiedHandle : "");
      } catch {
        if (!cancelled) setGhHandle("");
      } finally {
        if (!cancelled) setGhChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isConnected, address]);

  // Launch timestamp — embedded into commit conditions so the validator can
  // compare commit dates against the raise period.
  const launchTs = useMemo(() => Date.now(), []);

  const deadlineTimestamp = useMemo(() => {
    if (!deadline) return "";
    return Math.floor(new Date(deadline).getTime() / 1000).toString();
  }, [deadline]);

  const { apiUrl, owner, repo } = useMemo(() => buildApiUrl(repoUrl), [repoUrl]);
  const repoDisplay = owner && repo ? `${owner}/${repo}` : repoUrl || "the linked repository";
  const isRepoCheck = checkType === "commit" || checkType === "readme" || checkType === "stars";

  const generatedCondition = useMemo(() => {
    if (checkType === "commit") return buildCondition(checkType, commitCount, repoDisplay, launchTs);
    if (checkType === "stars") return buildCondition(checkType, commitCount, repoDisplay, launchTs);
    return buildCondition(checkType, commitCount, repoDisplay, launchTs);
  }, [checkType, commitCount, repoDisplay, launchTs]);

  const checkUrl = useMemo(() => (isRepoCheck ? apiUrl : repoUrl.trim()), [isRepoCheck, apiUrl, repoUrl]);

  const validateForm = (): boolean => {
    const next: Record<string, string> = {};
    if (!teamAddress.trim()) next.teamAddress = "Team wallet is required";
    else if (!/^0x[a-fA-F0-9]{40}$/.test(teamAddress.trim())) next.teamAddress = "Invalid wallet address";

    if (!deadline.trim()) next.deadline = "Close date is required";
    else if (new Date(deadline) <= new Date()) next.deadline = "Close date must be in the future";

    if (isRepoCheck) {
      if (!repoUrl.trim()) next.repoUrl = "GitHub repository URL is required";
      else if (!owner || !repo) next.repoUrl = "Enter a valid GitHub repo URL, e.g. https://github.com/org/project";
    } else if (!repoUrl.trim() || !/^https?:\/\//.test(repoUrl.trim())) {
      next.repoUrl = "A valid URL is required";
    }

    setErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const createAndRegister = async () => {
    if (!address) {
      error("Please connect your wallet first");
      return;
    }
    if (!vaultAddress || !conditionAddress) {
      error("Contract not configured", {
        description: "Set NEXT_PUBLIC_VAULT_CONTRACT and NEXT_PUBLIC_CONDITION_CONTRACT.",
      });
      return;
    }
    if (ghChecking) {
      error("Please wait", { description: "Checking your GitHub verification…" });
      return;
    }
    if (!ghHandle) {
      error("Verify your GitHub first", {
        description:
          "You must verify your GitHub account on your dashboard page before launching a raise.",
        action: { label: "Go to dashboard", onClick: () => router.push("/dashboard") },
      });
      return;
    }

    const id = `vault-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSubmitting(true);
    try {
      const client = createClient({
        chain: GENLAYER_CHAIN,
        account: address as `0x${string}`,
      });

      // 1. Register the condition with the governor.
      const regFees = await client.estimateTransactionFees({});
      await client.writeContract({
        address: conditionAddress as `0x${string}`,
        functionName: "register_condition",
        args: [id, checkUrl, generatedCondition, teamAddress],
        fees: regFees,
      });

      // 2. Create the vault, reusing the same id.
      const cvFees = await client.estimateTransactionFees({});
      await client.writeContract({
        address: vaultAddress as `0x${string}`,
        functionName: "create_vault",
        args: [id, teamAddress, deadlineTimestamp, generatedCondition, conditionAddress],
        fees: cvFees,
      });

      success("Raise launched", {
        description: `Raise ${id} is live. Backers can now deposit GEN into it.`,
      });
      router.push("/dashboard");
    } catch (e: any) {
      error("Could not launch raise", {
        description: e?.message || "The transaction could not be submitted.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) {
      error("Connect your wallet", { description: "Please connect your wallet to launch a raise." });
      return;
    }
    if (!validateForm()) return;
    setStep("review");
  };

  const countOptions = checkType === "stars" ? STAR_COUNTS : COMMIT_COUNTS;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="shell">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" /> Back to dashboard
            </button>

            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[11px] font-semibold tracking-wide uppercase">
                  <Rocket className="w-3 h-3" />
                  Launch a raise
                </span>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Launch a new raise</h1>
              </div>
              <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
                Set the team&apos;s wallet, pick a verifiable source of truth, and choose the close date.
                Backers deposit GEN — the AI checks the evidence at the close date and releases or refunds
                automatically. Launching requires a verified GitHub identity.
              </p>
            </div>

            {GITHUB_VERIFY_CONTRACT && isConnected && (
              <div className="mb-6">
                {ghChecking ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Checking GitHub verification…
                  </div>
                ) : ghHandle ? (
                  <div className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
                    <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                    <p className="text-sm text-primary/90">
                      Launching as verified GitHub <strong>@{ghHandle}</strong>
                    </p>
                    <Check className="w-4 h-4 text-primary ml-auto shrink-0" />
                  </div>
                ) : (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm space-y-2.5">
                    <div className="flex items-center gap-2 text-destructive font-medium">
                      <Github className="w-4 h-4" /> GitHub verification required
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      You must verify your GitHub account on-chain before launching a raise — this stops
                      people pointing a raise at someone else&apos;s GitHub as their source of truth.
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={() => router.push("/dashboard")} className="gap-1.5">
                      <Github className="w-3.5 h-3.5" /> Verify on dashboard
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="bg-background border border-border rounded-xl overflow-hidden">
              {step === "review" ? (
                <div className="p-6 space-y-5">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setStep("form")} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <div className="space-y-2.5 rounded-lg border border-border bg-muted/50 p-5 text-sm">
                    <p className="eyebrow">Review</p>
                    <p><span className="text-muted-foreground">Team:</span> {teamAddress}</p>
                    <p><span className="text-muted-foreground">Close date:</span> {new Date(deadline).toLocaleString()}</p>
                    <div className="pt-1 border-t border-border/40">
                      <p className="eyebrow mt-2">Source of truth</p>
                      <p className="break-all text-xs text-muted-foreground">URL the validator fetches: {checkUrl}</p>
                      <p className="mt-3 eyebrow">Condition</p>
                      <p className="leading-relaxed">{generatedCondition}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This submits two transactions: first the condition is registered with the guardian, then the
                    fund is opened. Both share one fund id.
                  </p>
                  <Button type="button" variant="gradient" className="w-full" onClick={createAndRegister} disabled={submitting}>
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Launching…</>
                    ) : (
                      <><Rocket className="w-4 h-4 mr-2" /> Confirm and launch</>
                    )}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {/* Team wallet */}
                  <div className="space-y-2">
                    <Label htmlFor="teamAddress" className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" /> Team wallet
                    </Label>
                    <Input
                      id="teamAddress"
                      type="text"
                      placeholder="0x... — where raise proceeds go"
                      value={teamAddress}
                      onChange={(e) => { setTeamAddress(e.target.value); setErrors({ ...errors, teamAddress: "" }); }}
                      className={errors.teamAddress ? "border-destructive" : ""}
                    />
                    {errors.teamAddress && <p className="text-xs text-destructive">{errors.teamAddress}</p>}
                  </div>

                  {/* Close date */}
                  <div className="space-y-2">
                    <Label htmlFor="deadline" className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" /> Close date
                    </Label>
                    <Input
                      id="deadline"
                      type="datetime-local"
                      value={deadline}
                      onChange={(e) => { setDeadline(e.target.value); setErrors({ ...errors, deadline: "" }); }}
                      className={errors.deadline ? "border-destructive" : ""}
                    />
                    {errors.deadline && <p className="text-xs text-destructive">{errors.deadline}</p>}
                  </div>

                  {/* Source of truth — selectable, verifiable types */}
                  <div className="space-y-2.5">
                    <Label className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" /> Source of truth
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {CHECK_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const active = checkType === opt.type;
                        return (
                          <button
                            key={opt.type}
                            type="button"
                            onClick={() => setCheckType(opt.type)}
                            className={`text-left rounded-lg border p-3.5 transition-all duration-150 ${
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
                  {checkType !== "website" && (
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
                            onClick={() => setCommitCount(c)}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-150 ${
                              commitCount === c
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
                      <p className="text-[11px] text-muted-foreground">
                        {checkType === "commit"
                          ? `Only commits pushed after ${new Date(launchTs).toLocaleString()} count toward the target.`
                          : "Threshold verified by the AI against the live repository."}
                      </p>
                    </div>
                  )}

                  {/* Repo / URL input */}
                  <div className="space-y-2">
                    <Label htmlFor="repoUrl" className="flex items-center gap-2">
                      <Link className="w-4 h-4 text-primary" />
                      {checkType === "website" ? "Website URL" : "GitHub repository URL"}
                    </Label>
                    <Input
                      id="repoUrl"
                      type="text"
                      placeholder={isRepoCheck ? "https://github.com/org/project" : "https://example.com"}
                      value={repoUrl}
                      onChange={(e) => { setRepoUrl(e.target.value); setErrors({ ...errors, repoUrl: "" }); }}
                      className={errors.repoUrl ? "border-destructive" : ""}
                    />
                    {errors.repoUrl && <p className="text-xs text-destructive">{errors.repoUrl}</p>}
                    {isRepoCheck && owner && repo && (
                      <p className="text-[11px] text-muted-foreground break-all">
                        Validator will fetch: <code className="text-foreground/80">{checkUrl}</code>
                      </p>
                    )}
                  </div>

                  {/* Generated condition preview */}
                  <div className="rounded-lg border border-border/60 bg-muted/40 p-4 space-y-1.5">
                    <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                      <Info className="w-3.5 h-3.5" /> Auto-generated condition
                    </p>
                    <p className="text-sm leading-relaxed text-foreground/90">{generatedCondition}</p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="secondary" className="flex-1" onClick={() => router.push("/dashboard")}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="gradient" className="flex-1" disabled={!isConnected}>
                      Continue
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}