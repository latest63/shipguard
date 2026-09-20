"use client";

import { useEffect } from "react";
import { Github, Check, Loader2, KeyRound, FileCode } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { GithubVerification } from "@/lib/useGithubVerification";

/**
 * GitHub verification in a clean dialog.
 *
 * GitHub identity is wallet-level: the on-chain GitHubVerifier stores one
 * handle per wallet, shared by the (single) project that wallet owns. This is
 * why verification moved off the main dashboard surface into its own dialog —
 * it only needs to happen once per wallet.
 *
 * The verification state itself is owned by the dashboard page (lifted via the
 * `gh` prop) so the card badge, launch gate, and this dialog all stay in sync.
 */
export function GithubVerifyDialog({
  open,
  onOpenChange,
  gh,
  onVerified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gh: GithubVerification;
  onVerified?: (handle: string) => void;
}) {
  const {
    phase,
    handle,
    code,
    busy,
    error,
    verifiedHandle,
    checking,
    start,
    submit,
    reset,
    setHandle,
  } = gh;

  // Reset internal flow state whenever the dialog opens/closes
  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onDone = async () => {
    try {
      const got = await submit(handle);
      if (got && onVerified) onVerified(got);
    } catch {
      /* error is shown inline by the hook */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="brand-card border-2 sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Github className="w-5 h-5" />
            GitHub verification
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Prove you own a GitHub account to launch raises. This is verified
            on-chain and shared by your project.
          </DialogDescription>
        </DialogHeader>

        <div className="pt-3">
          {checking ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking on-chain status…
            </div>
          ) : phase === "verified" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 p-4">
                <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
                  <Github className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-2 text-primary">
                    <Check className="w-4 h-4" />
                    {verifiedHandle ? `@${verifiedHandle}` : "Verified"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {verifiedHandle
                      ? `github.com/${verifiedHandle}`
                      : "Confirmed on-chain"}
                  </p>
                </div>
              </div>
              <Button
                variant="gradient"
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            </div>
          ) : phase === "idle" ? (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                To launch a raise, prove you own a GitHub account. We generate a
                one-time code — you publish it in a <strong>public gist</strong>,
                then we fetch the GitHub API and commit the proof to the chain.
              </p>
              <div className="space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground block">
                  GitHub username
                </label>
                <input
                  type="text"
                  placeholder="e.g. octocat"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                />
              </div>
              <Button
                variant="gradient"
                className="w-full gap-2"
                onClick={start}
                disabled={busy || !handle.trim()}
              >
                <KeyRound className="w-4 h-4" /> Get my code
              </Button>
            </div>
          ) : phase === "code" ? (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Create a <strong>public gist</strong> containing this code:
                </p>
                <div className="bg-white/[0.03] border border-primary/30 rounded-lg p-4">
                  <p className="font-mono text-lg text-primary tracking-wider select-all">
                    {code}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    gist.github.com → New gist → paste the code → Public
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={reset}
                  disabled={busy}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="gradient"
                  className="flex-1 gap-2"
                  onClick={onDone}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileCode className="w-4 h-4" />
                  )}
                  {busy ? "Verifying…" : "I created the gist"}
                </Button>
              </div>
              {error && (
                <p className="text-xs text-destructive leading-relaxed">{error}</p>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}