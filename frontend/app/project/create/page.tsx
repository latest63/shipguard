"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Loader2, Rocket, Github, Check, KeyRound, FileCode } from "lucide-react";
import { getGithubVerifyContractAddress } from "@/lib/genlayer/client";
import { useAccount } from "wagmi";
import { upsertProject } from "@/lib/projects";
import { success, error } from "@/lib/utils/toast";

const GITHUB_VERIFY_CONTRACT = getGithubVerifyContractAddress();

function genCode() {
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint32Array(6);
  crypto.getRandomValues(arr);
  let out = "";
  for (const n of arr) out += CHARS[n % CHARS.length];
  return out;
}

type GhPhase = "idle" | "code" | "submitting" | "verifying" | "verified";

interface CreateProjectFormData {
  name: string;
  logo_url: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
}

export default function CreateProjectPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [form, setForm] = useState<CreateProjectFormData>({
    name: "",
    logo_url: "",
    description: "",
    website: "",
    twitter: "",
    telegram: "",
    discord: "",
  });

  const [loading, setLoading] = useState(false);
  const [ghPhase, setGhPhase] = useState<GhPhase>("idle");
  const [ghHandle, setGhHandle] = useState("");
  const [ghCode, setGhCode] = useState("");
  const [ghBusy, setGhBusy] = useState(false);
  const [ghError, setGhError] = useState("");
  const [ghVerifiedHandle, setGhVerifiedHandle] = useState("");
  const [ghChecking, setGhChecking] = useState(true);

  const handleChange = (field: keyof CreateProjectFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const ghStart = () => {
    setGhError("");
    setGhCode(genCode());
    setGhPhase("code");
  };

  const ghSubmit = async () => {
    if (!address || !GITHUB_VERIFY_CONTRACT || !ghHandle.trim() || !ghCode) return;
    const handle = ghHandle.trim().replace(/^@/, "");
    setGhPhase("submitting");
    setGhBusy(true);
    setGhError("");
    try {
      const res = await fetch("/api/github-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, handle, code: ghCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `GitHub verification failed (HTTP ${res.status})`);

      const got = typeof data.verifiedHandle === "string" ? data.verifiedHandle : "";
      setGhVerifiedHandle(got);
      setGhPhase("verified");
    } catch (e: any) {
      setGhPhase("idle");
      setGhError(e?.message || "GitHub verification failed");
    } finally {
      setGhBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!address) return;

    setLoading(true);
    try {
      const updated = await upsertProject(address, {
        name: form.name || null,
        logo_url: form.logo_url || null,
        link: form.website || null,
      });

      if (updated) {
        success("Project created successfully", {
          description: "Your project is ready. Complete GitHub verification to launch raises.",
        });
        router.push("/dashboard");
      } else {
        error("Failed to create project", {
          description: "No wallet connected or Supabase configuration issue.",
        });
      }
    } catch (e: any) {
      error("Error creating project", {
        description: e?.message || "Unknown error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow pt-24 pb-20">
          <div className="shell">
            <div className="max-w-2xl mx-auto text-center">
              <h1 className="text-2xl md:text-3xl font-bold mb-4">Connect your wallet</h1>
              <p className="text-muted-foreground mb-6">
                Connect your wallet to create a new project.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

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
                  Create Project
                </span>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  New project
                </h1>
              </div>
            </div>

            {/* ── Create Project Form ────────────────────────────────── */}
            <div className="bg-background border border-border rounded-xl overflow-hidden">
              <div className="p-5 space-y-4">
                {/* Project Name */}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground block">
                    Project Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. My Awesome Project"
                    value={form.name}
                    onChange={handleChange("name")}
                    className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                  />
                </div>

                {/* Logo URL */}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground block">
                    Logo URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://yourproject.com/logo.png"
                    value={form.logo_url}
                    onChange={handleChange("logo_url")}
                    className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Direct link to your project logo image
                  </p>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground block">
                    Description
                  </label>
                  <textarea
                    placeholder="Describe your project..."
                    value={form.description}
                    onChange={handleChange("description")}
                    rows={3}
                    className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 resize-y"
                  />
                </div>

                {/* Website */}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground block">
                    Website
                  </label>
                  <input
                    type="url"
                    placeholder="https://yourproject.com"
                    value={form.website}
                    onChange={handleChange("website")}
                    className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                  />
                </div>

                {/* Twitter */}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground block">
                    Twitter
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. yourproject"
                    value={form.twitter}
                    onChange={handleChange("twitter")}
                    className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                  />
                </div>

                {/* Telegram */}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground block">
                    Telegram
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. @yourproject"
                    value={form.telegram}
                    onChange={handleChange("telegram")}
                    className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                  />
                </div>

                {/* Discord */}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground block">
                    Discord
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. discord.gg/yourproject"
                    value={form.discord}
                    onChange={handleChange("discord")}
                    className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                  />
                </div>

                {/* GitHub Verification Section */}
                {ghPhase !== "verified" && (
                  <div className="pt-4 border-t border-border/50">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Github className="w-4 h-4" />
                      GitHub verification (required to launch raises)
                    </h3>
                    
                    {ghChecking ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Checking verification...
                      </div>
                    ) : ghPhase === "idle" ? (
                      <div className="space-y-3">
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
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                          onClick={ghStart}
                          disabled={ghBusy}
                        >
                          <KeyRound className="w-4 h-4" />
                          Get verification code
                        </button>
                      </div>
                    ) : ghPhase === "code" ? (
                      <div className="space-y-3">
                        <div>
                          <p className="text-[11px] text-muted-foreground mb-2">
                            Create a <strong>public gist</strong> containing this code:
                          </p>
                          <div className="bg-white/[0.03] border border-primary/30 rounded-lg p-3">
                            <p className="font-mono text-base text-primary tracking-wider select-all">
                              {ghCode}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-2">
                              gist.github.com → New gist → paste the code → Public
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-white/[0.03] transition-colors"
                            onClick={() => setGhPhase("idle")}
                            disabled={ghBusy}
                          >
                            Back
                          </button>
                          <button
                            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-primary to-purple-500 text-white rounded-lg hover:opacity-90 transition-colors"
                            onClick={ghSubmit}
                            disabled={ghBusy}
                          >
                            {ghBusy ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {(ghPhase as string) === "verifying" ? "Verifying…" : "Submitting…"}
                              </>
                            ) : (
                              <>
                                <FileCode className="w-3 h-3" />
                                Done
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
                )}

                {/* GitHub Verified Banner */}
                {ghPhase === "verified" && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-900">
                          GitHub verified @{ghVerifiedHandle}
                        </p>
                        <p className="text-xs text-green-700">
                          You can now launch raises with this project.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  variant="gradient"
                  size="lg"
                  className="w-full gap-2"
                  onClick={handleSubmit}
                  disabled={loading || !form.name}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating project...
                    </>
                  ) : (
                    "Create project"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}