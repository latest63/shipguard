"use client";

import { useState, useMemo } from "react";
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
} from "lucide-react";
import { createClient } from "genlayer-js";
import {
  GENLAYER_CHAIN,
  getVaultContractAddress,
  getConditionContractAddress,
  getGithubVerifyContractAddress,
} from "@/lib/genlayer/client";
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

type Step = "form" | "review";

/**
 * Launch a raise for a specific project, in a dialog.
 *
 * The raise is scoped to the project passed in:
 *   - team wallet defaults to the connected creator (or project.team_wallet)
 *   - the raise id is namespaced with the project name so it is clearly
 *     associated ("<project>-<timestamp>")
 *   - the confirmed GitHub handle of the launching wallet is shown and guards
 *     submission (wallet-level, required to launch)
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
  const vaultAddress = getVaultContractAddress();
  const conditionAddress = getConditionContractAddress();

  const [step, setStep] = useState<Step>("form");
  const [teamAddress, setTeamAddress] = useState("");
  const [deadline, setDeadline] = useState("");
  const [condition, setCondition] = useState("");
  const [checkUrl, setCheckUrl] = useState("");
  const [errors, setErrors] = useState({
    teamAddress: "",
    deadline: "",
    condition: "",
    checkUrl: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill the team wallet with the connected creator wallet (single-project
  // model: the raise funds go to the wallet that owns the project).
  const defaultTeam = address || "";

  const deadlineTimestamp = useMemo(() => {
    if (!deadline) return "";
    return Math.floor(new Date(deadline).getTime() / 1000).toString();
  }, [deadline]);

  const validateForm = (): boolean => {
    const next = { teamAddress: "", deadline: "", condition: "", checkUrl: "" };
    if (!teamAddress.trim()) next.teamAddress = "Team wallet is required";
    else if (!/^0x[a-fA-F0-9]{40}$/.test(teamAddress.trim()))
      next.teamAddress = "Invalid wallet address";

    if (!deadline.trim()) next.deadline = "Close date is required";
    else if (new Date(deadline) <= new Date())
      next.deadline = "Close date must be in the future";

    if (!condition.trim()) next.condition = "Condition is required";

    if (!checkUrl.trim()) next.checkUrl = "Evidence URL is required";
    else if (!/^https?:\/\/.+/.test(checkUrl.trim()))
      next.checkUrl = "Invalid URL";

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
    if (!ghHandle) {
      error("Verify your GitHub first", {
        description:
          "You must verify your GitHub account before launching a raise.",
        action: { label: "Go to dashboard", onClick: () => onOpenChange(false) },
      });
      return;
    }

    const projectSlug = (project?.name || "project")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "project";
    // Namespaced so the raise is clearly tied to this project.
    const id = `raise-${projectSlug}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    setSubmitting(true);
    try {
      // Committed providers.tsx installs the global MetaMask compat shim, so
      // the SDK's write path works without an explicit provider.
      const client = createClient({
        chain: GENLAYER_CHAIN,
        account: address as `0x${string}`,
      });

      const regFees = await client.estimateTransactionFees({});
      await client.writeContract({
        address: conditionAddress as `0x${string}`,
        functionName: "register_condition",
        args: [id, checkUrl, condition, teamAddress],
        fees: regFees,
      });

      const cvFees = await client.estimateTransactionFees({});
      await client.writeContract({
        address: vaultAddress as `0x${string}`,
        functionName: "create_vault",
        args: [id, teamAddress, deadlineTimestamp, condition, conditionAddress],
        fees: cvFees,
      });

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
    setDeadline("");
    setCondition("");
    setCheckUrl("");
    setStep("form");
    setErrors({ teamAddress: "", deadline: "", condition: "", checkUrl: "" });
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="brand-card border-2 sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Rocket className="w-5 h-5" />
            Launch a raise
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {project?.name
              ? `Open an escrowed raise for "${project.name}". Backers lock GEN — AI verifies the evidence at the close date.`
              : "Open an escrowed raise. Backers lock GEN — AI verifies the evidence at the close date."}
          </DialogDescription>
        </DialogHeader>

        {/* GitHub gate */}
        {GITHUB_VERIFY_CONTRACT && isConnected && (
          ghHandle ? (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
              <p className="text-xs text-primary/90">
                Launching as verified GitHub <strong>@{ghHandle}</strong>
                <Check className="w-3.5 h-3.5 inline ml-1.5" />
              </p>
            </div>
          ) : (
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
        )}

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
                <span className="text-muted-foreground">Team:</span> {teamAddress}
              </p>
              <p>
                <span className="text-muted-foreground">Close date:</span>{" "}
                {new Date(deadline).toLocaleString()}
              </p>
              <p>
                <span className="text-muted-foreground">Condition:</span>{" "}
                {condition}
              </p>
              <p className="break-all">
                <span className="text-muted-foreground">Evidence URL:</span>{" "}
                {checkUrl}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Submits two transactions: the condition is registered with the
              guardian, then the fund is opened. Both share one fund id.
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
            <div className="space-y-2">
              <Label htmlFor="ra-team" className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Team wallet
              </Label>
              <Input
                id="ra-team"
                type="text"
                placeholder="0x… — where raise proceeds go"
                value={teamAddress || defaultTeam}
                onChange={(e) => {
                  setTeamAddress(e.target.value);
                  setErrors({ ...errors, teamAddress: "" });
                }}
                className={errors.teamAddress ? "border-destructive" : ""}
              />
              {errors.teamAddress && (
                <p className="text-xs text-destructive">{errors.teamAddress}</p>
              )}
            </div>

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
              {errors.deadline && (
                <p className="text-xs text-destructive">{errors.deadline}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ra-condition" className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" /> Condition
              </Label>
              <Input
                id="ra-condition"
                type="text"
                placeholder="e.g. Ships v1 and publishes a public changelog"
                value={condition}
                onChange={(e) => {
                  setCondition(e.target.value);
                  setErrors({ ...errors, condition: "" });
                }}
                className={errors.condition ? "border-destructive" : ""}
              />
              {errors.condition && (
                <p className="text-xs text-destructive">{errors.condition}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ra-url" className="flex items-center gap-2">
                <Link className="w-4 h-4 text-primary" /> Evidence URL
              </Label>
              <Input
                id="ra-url"
                type="url"
                placeholder="https://github.com/org/project — the AI checks this at close"
                value={checkUrl}
                onChange={(e) => {
                  setCheckUrl(e.target.value);
                  setErrors({ ...errors, checkUrl: "" });
                }}
                className={errors.checkUrl ? "border-destructive" : ""}
              />
              {errors.checkUrl && (
                <p className="text-xs text-destructive">{errors.checkUrl}</p>
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
                disabled={!isConnected}
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