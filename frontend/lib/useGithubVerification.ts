"use client";

import { useCallback, useEffect, useState } from "react";
import { getGithubVerifyContractAddress } from "@/lib/genlayer/client";

const GITHUB_VERIFY_CONTRACT = getGithubVerifyContractAddress();

function genCode() {
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint32Array(6);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < arr.length; i++) out += CHARS[arr[i] % CHARS.length];
  return out;
}

export type GhPhase = "idle" | "code" | "submitting" | "verifying" | "verified";

export interface GithubVerification {
  GITHUB_VERIFY_CONTRACT: string | null;
  phase: GhPhase;
  handle: string;
  code: string;
  busy: boolean;
  error: string;
  verifiedHandle: string;
  checking: boolean;
  start: () => void;
  submit: (rawHandle: string) => Promise<string | undefined>;
  reset: () => void;
  setHandle: (v: string) => void;
}

/**
 * Shared GitHub verification state for the connected wallet.
 *
 * GitHub verification is wallet-level: the on-chain GitHubVerifier keyed by
 * `get_gh_handle(address)` stores one handle per wallet, shared by every
 * project that wallet owns. This hook reads that status once on mount (and
 * when the address changes) and exposes the full verify flow.
 */
export function useGithubVerification(
  address?: string,
  isConnected?: boolean
): GithubVerification {
  const [phase, setPhase] = useState<GhPhase>("idle");
  const [handle, setHandle] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [verifiedHandle, setVerifiedHandle] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isConnected || !address || !GITHUB_VERIFY_CONTRACT) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/github-verify?wallet=" + encodeURIComponent(address));
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        const h = typeof data.verifiedHandle === "string" ? data.verifiedHandle : "";
        if (!cancelled) {
          setVerifiedHandle(h);
          setPhase(h ? "verified" : "idle");
        }
      } catch {
        if (!cancelled) {
          setVerifiedHandle("");
          setPhase("idle");
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isConnected, address]);

  const start = useCallback(() => {
    setError("");
    setCode(genCode());
    setPhase("code");
  }, []);

  const submit = useCallback(async (rawHandle: string) => {
    if (!address || !GITHUB_VERIFY_CONTRACT || !rawHandle.trim() || !code) return;
    const clean = rawHandle.trim().replace(/^@/, "");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/github-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, handle: clean, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `GitHub verification failed (HTTP ${res.status})`);
      const got = typeof data.verifiedHandle === "string" ? data.verifiedHandle : "";
      setVerifiedHandle(got);
      setPhase("verified");
      return got;
    } catch (e: any) {
      setError(e?.message || "GitHub verification failed");
      throw e;
    } finally {
      setBusy(false);
    }
  }, [address, code]);

  const reset = useCallback(() => {
    setPhase("idle");
    setCode("");
    setError("");
    setBusy(false);
  }, []);

  return {
    GITHUB_VERIFY_CONTRACT,
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
  };
}