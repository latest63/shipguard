"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Github, Check, Loader2, KeyRound, FileCode, Rocket, Edit, Plus } from "lucide-react";
import { GENLAYER_CHAIN, getGithubVerifyContractAddress } from "@/lib/genlayer/client";
import { createClient } from "genlayer-js";
import { useRouter } from "next/navigation";
import { fetchProject, type Project } from "@/lib/projects";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";

const GITHUB_VERIFY_CONTRACT = getGithubVerifyContractAddress();

function genCode() {
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint32Array(6);
  crypto.getRandomValues(arr);
  let out = "";
  for (const n of arr) out += CHARS[n % CHARS.length];
  return out;
}

function ghClient(address?: `0x${string}`) {
  const config: any = { chain: GENLAYER_CHAIN };
  if (address) config.account = address;
  return createClient(config);
}

type GhPhase = "idle" | "code" | "submitting" | "verifying" | "verified";

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [ghPhase, setGhPhase] = useState<GhPhase>("idle");
  const [ghHandle, setGhHandle] = useState("");
  const [ghCode, setGhCode] = useState("");
  const [ghBusy, setGhBusy] = useState(false);
  const [ghError, setGhError] = useState("");
  const [ghVerifiedHandle, setGhVerifiedHandle] = useState("");
  const [ghChecking, setGhChecking] = useState(true);

  // Check if wallet already has a verified GitHub handle
  useEffect(() => {
    if (!isConnected || !address || !GITHUB_VERIFY_CONTRACT) {
      setGhChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const client = ghClient();
        const h = await client.readContract({
          address: GITHUB_VERIFY_CONTRACT,
          functionName: "get_gh_handle",
          args: [address],
        });
        if (!cancelled) {
          setGhVerifiedHandle(typeof h === "string" ? h : h?.toString() || "");
          setGhPhase(typeof h === "string" && h ? "verified" : "idle");
        }
      } catch {
        /* contract not configured / chain not ready */
      } finally {
        if (!cancelled) setGhChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isConnected, address]);

  // Fetch project when wallet connects
  useEffect(() => {
    if (!isConnected || !address) {
      setProject(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const p = await fetchProject(address);
      if (!cancelled) {
        setProject(p);
      }
    })();
    return () => { cancelled = true; };
  }, [isConnected, address]);

  const ghStart = () => {
    setGhError("");
    setGhCode(genCode());
    setGhPhase("code");
  };

  const ghSubmit = async () => {
    if (!address || !GITHUB_VERIFY_CONTRACT || !ghHandle.trim() || !ghCode) return;
    const handle = ghHandle.trim().replace(/^@/, "");
    setGhBusy(true);
    setGhError("");
    try {
      const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(handle)}`);
      if (userRes.status === 404) throw new Error(`GitHub user "@${handle}" not found`);
      if (!userRes.ok) throw new Error(`GitHub API error (HTTP ${userRes.status})`);
      const user = await userRes.json();

      let gistFound = false;
      let gistUrl = "";
      const gistsRes = await fetch(`https://api.github.com/users/${encodeURIComponent(handle)}/gists?per_page=100`);
      if (gistsRes.ok) {
        const gists = await gistsRes.json();
        for (const g of gists) {
          for (const f of Object.values(g.files || {})) {
            const raw = f as any;
            if (raw.content && raw.content.includes(ghCode)) {
              gistFound = true;
              gistUrl = g.html_url;
              break;
            }
          }
          if (gistFound) break;
        }
      }

      setGhPhase("submitting");
      const client = ghClient(address as `0x${string}`);
      const fees = await client.estimateTransactionFees({});
      await client.writeContract({
        address: GITHUB_VERIFY_CONTRACT,
        functionName: "submit",
        args: [address, handle, ghCode, user.login, user.type, user.html_url, gistFound, gistUrl],
        fees,
      });

      setGhPhase("verifying");
      const fees2 = await client.estimateTransactionFees({});
      await client.writeContract({
        address: GITHUB_VERIFY_CONTRACT,
        functionName: "verify",
        args: [address],
        fees: fees2,
      });

      const h = await client.readContract({
        address: GITHUB_VERIFY_CONTRACT,
        functionName: "get_gh_handle",
        args: [address],
      });
      const got = typeof h === "string" ? h : h?.toString() || "";
      if (got) {
        setGhVerifiedHandle(got);
        setGhPhase("verified");
      } else {
        throw new Error("Verification did not resolve to a handle");
      }
    } catch (e: any) {
      // Stay on the code screen so the failure reason stays visible instead
      // of snapping back to "Get my code" with the error hidden.
      setGhPhase("code");
      setGhError(e?.message || "GitHub verification failed");
    } finally {
      setGhBusy(false);
    }
  };

  const handleCreateProject = () => {
    router.push("/project/create");
  };

  const handleLaunchRaise = () => {
    router.push("/raise/create");
  };

  // Check if project has a name set
  const hasProject = project && project.name;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow pt-24 pb-20">
        <div className="shell">
          <div className="max-w-2xl mx-auto">
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[11px] font-semibold tracking-wide uppercase">
                  <Rocket className="w-3 h-3" />
                  Dashboard
                </span>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  {isConnected ? "Your project" : "Connect to continue"}
                </h1>
              </div>
              <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
                {isConnected
                  ? "Manage your project details and launch raises."
                  : "Connect your wallet to view your raises and manage your connection."}
              </p>
            </div>

            {/* ── No project: Show create button ───────────────────────────── */}
            {!hasProject && isConnected && (
              <div className="mb-8">
                <Button
                  variant="gradient"
                  size="lg"
                  className="w-full gap-2 h-auto py-4 justify-center"
                  onClick={handleCreateProject}
                >
                  <Plus className="w-5 h-5" />
                  Create a new project
                </Button>
              </div>
            )}

            {/* ── Project exists: Show project details ───────────────────────── */}
            {hasProject && project && (
              <div className="shell">
                <div className="max-w-2xl mx-auto">
                  <div className="bg-background border border-border rounded-xl mb-8">
                    <div className="px-5 py-4 border-b border-border/50 flex items-center gap-3">
                      <div className="relative flex items-center justify-center w-11 h-11 rounded-full bg-primary/15 border border-primary/25 shrink-0 overflow-hidden">
                        {project.logo_url ? (
                          <img src={project.logo_url} alt={project.name || "Logo"} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <Rocket className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-semibold text-foreground">{project.name}</h2>
                        <p className="text-[11px] text-muted-foreground">Your ShipGuard project</p>
                      </div>
                      <button
                        onClick={() => router.push(`/project/edit`)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border hover:bg-white/[0.03] transition-colors"
                      >
                        <Edit className="w-3 h-3" />
                        <span className="text-[11px] font-medium">Edit details</span>
                      </button>
                    </div>
                  </div>

                  {/* ── GitHub verification card ─────────────────────────────────── */}
                  <div className="bg-background border border-border rounded-xl overflow-hidden mb-8">
                    <div className="px-5 py-4 border-b border-border/50 flex items-center gap-3">
                      <div className="flex items-center justify-center w-11 h-11 rounded-full bg-white/5 border border-border shrink-0">
                        <Github className="w-5 h-5 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">GitHub identity</p>
                        <p className="text-[11px] text-muted-foreground">
                          {ghPhase === "verified"
                            ? "Verified on-chain — required to launch a raise"
                            : "Verify your GitHub to launch raises"}
                        </p>
                      </div>
                      {ghPhase === "verified" && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium border border-primary/20">
                          <Check className="w-3 h-3" />
                          @{ghVerifiedHandle}
                        </span>
                      )}
                    </div>

                    <div className="p-5">
                      {ghChecking ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Checking on-chain status…
                        </div>
                      ) : ghPhase === "verified" ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
                              <Github className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                <a
                                  href={`https://github.com/${ghVerifiedHandle}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="hover:text-primary transition-colors"
                                >
                                  github.com/{ghVerifiedHandle}
                                </a>
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Verified • {project.logo_url ? "Source-of-truth URL will be checked" : "Ready to launch raises"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : ghPhase === "idle" ? (
                        <div className="space-y-4">
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            To launch a raise, prove you own a GitHub account. We generate a
                            one-time code — you publish it in a <strong>public gist</strong>, then
                            we fetch the GitHub API and commit the proof to the chain.
                          </p>
                          <div className="space-y-2">
                            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground block">
                              GitHub username
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. octocat"
                              value={ghHandle}
                              onChange={(e) => setGhHandle(e.target.value)}
                              className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                            />
                          </div>
                          <button
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                            onClick={ghStart}
                            disabled={ghBusy}
                          >
                            <KeyRound className="w-4 h-4" />
                            Get my code
                          </button>
                        </div>
                      ) : ghPhase === "code" ? (
                        <div className="space-y-4">
                          <div>
                            <p className="text-[11px] text-muted-foreground mb-2">
                              Create a <strong>public gist</strong> containing this code:
                            </p>
                            <div className="bg-white/[0.03] border border-primary/30 rounded-lg p-4">
                              <p className="font-mono text-lg text-primary tracking-wider select-all">
                                {ghCode}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-2">
                                gist.github.com → New gist → paste the code → Public
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg hover:bg-white/[0.03] transition-colors disabled:opacity-50"
                              onClick={() => setGhPhase("idle")}
                              disabled={ghBusy}
                            >
                              Back
                            </button>
                            <button
                              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-purple-500 text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
                              onClick={ghSubmit}
                              disabled={ghBusy}
                            >
                              {ghBusy ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  {(ghPhase as string) === "verifying" ? "Verifying…" : "Submitting…"}
                                </>
                              ) : (
                                <>
                                  <FileCode className="w-4 h-4" />
                                  I created the gist
                                </>
                              )}
                            </button>
                          </div>
                          {ghError && (
                            <p className="text-xs text-destructive leading-relaxed">{ghError}</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* ── Launch raise button ───────────────────────────────────── */}
                  {ghPhase === "verified" && (
                    <Button
                      variant="gradient"
                      size="lg"
                      className="w-full gap-2 h-auto py-4 justify-center"
                      onClick={handleLaunchRaise}
                    >
                      <Rocket className="w-5 h-5" />
                      Launch a raise
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}