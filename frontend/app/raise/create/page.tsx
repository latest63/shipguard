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

// A single raise id is minted per submission and reused by both txs:
//   1. register_condition(id, checkUrl, condition, teamAddress)
//   2. create_vault(id, teamAddress, deadline, condition, conditionContract)
type Step = "form" | "review";

export default function LaunchRaisePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const vaultAddress = getVaultContractAddress();
  const conditionAddress = getConditionContractAddress();

  const [step, setStep] = useState<Step>("form");
  const [teamAddress, setTeamAddress] = useState("");
  const [deadline, setDeadline] = useState("");
  const [condition, setCondition] = useState("");
  const [checkUrl, setCheckUrl] = useState("");

  const [errors, setErrors] = useState({ teamAddress: "", deadline: "", condition: "", checkUrl: "" });
  const [submitting, setSubmitting] = useState(false);

  // GitHub verification status for the connected wallet (read-only, via backend route).
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

  const deadlineTimestamp = useMemo(() => {
    if (!deadline) return "";
    return Math.floor(new Date(deadline).getTime() / 1000).toString();
  }, [deadline]);

  const validateForm = (): boolean => {
    const next = { teamAddress: "", deadline: "", condition: "", checkUrl: "" };
    if (!teamAddress.trim()) next.teamAddress = "Team wallet is required";
    else if (!/^0x[a-fA-F0-9]{40}$/.test(teamAddress.trim())) next.teamAddress = "Invalid wallet address";

    if (!deadline.trim()) next.deadline = "Close date is required";
    else if (new Date(deadline) <= new Date()) next.deadline = "Close date must be in the future";

    if (!condition.trim()) next.condition = "Condition is required";

    if (!checkUrl.trim()) next.checkUrl = "Evidence URL is required";
    else if (!/^https?:\/\/.+/.test(checkUrl.trim())) next.checkUrl = "Invalid URL";

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
    // GitHub verification gate — must be verified on-chain to launch.
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
      // The global MetaMask compat shim (installed in providers.tsx) patches
      // window.ethereum, so the SDK's write path works without an explicit provider.
      const client = createClient({
        chain: GENLAYER_CHAIN,
        account: address as `0x${string}`,
      });

      // 1. Register the condition with the governor.
      const regFees = await client.estimateTransactionFees({});
      await client.writeContract({
        address: conditionAddress as `0x${string}`,
        functionName: "register_condition",
        args: [id, checkUrl, condition, teamAddress],
        fees: regFees,
      });

      // 2. Create the vault, reusing the same id.
      const cvFees = await client.estimateTransactionFees({});
      await client.writeContract({
        address: vaultAddress as `0x${string}`,
        functionName: "create_vault",
        args: [id, teamAddress, deadlineTimestamp, condition, conditionAddress],
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

            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[11px] font-semibold tracking-wide uppercase">
                  <Rocket className="w-3 h-3" />
                  Launch a raise
                </span>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  Launch a new raise
                </h1>
              </div>
              <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
                Set the team&apos;s wallet, the condition, the evidence URL, and the close date.
                Backers deposit GEN — the AI checks the evidence at the close date and releases or
                refunds automatically. Launching requires a verified GitHub identity.
              </p>
            </div>

            {/* GitHub verification status */}
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
                      You must verify your GitHub account on-chain before launching a raise — this
                      stops people pointing a raise at someone else&apos;s GitHub as their source of
                      truth.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/dashboard")}
                      className="gap-1.5"
                    >
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
                    <p><span className="text-muted-foreground">Condition:</span> {condition}</p>
                    <p className="break-all"><span className="text-muted-foreground">Evidence URL:</span> {checkUrl}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This submits two transactions: first the commitments are registered with the
                    guardian, then the fund is opened. Both share one fund id.
                  </p>
                  <Button
                    type="button"
                    variant="gradient"
                    className="w-full"
                    onClick={createAndRegister}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Launching…
                      </>
                    ) : (
                      <>
                        <Rocket className="w-4 h-4 mr-2" /> Confirm and launch
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
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

                  <div className="space-y-2">
                    <Label htmlFor="condition" className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" /> Condition
                    </Label>
                    <Input
                      id="condition"
                      type="text"
                      placeholder="e.g. Ships v1 and publishes a public changelog"
                      value={condition}
                      onChange={(e) => { setCondition(e.target.value); setErrors({ ...errors, condition: "" }); }}
                      className={errors.condition ? "border-destructive" : ""}
                    />
                    {errors.condition && <p className="text-xs text-destructive">{errors.condition}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="checkUrl" className="flex items-center gap-2">
                      <Link className="w-4 h-4 text-primary" /> Evidence URL
                    </Label>
                    <Input
                      id="checkUrl"
                      type="url"
                      placeholder="https://github.com/org/project — the AI checks this at close"
                      value={checkUrl}
                      onChange={(e) => { setCheckUrl(e.target.value); setErrors({ ...errors, checkUrl: "" }); }}
                      className={errors.checkUrl ? "border-destructive" : ""}
                    />
                    {errors.checkUrl && <p className="text-xs text-destructive">{errors.checkUrl}</p>}
                  </div>

                  <div className="flex gap-3 pt-4">
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