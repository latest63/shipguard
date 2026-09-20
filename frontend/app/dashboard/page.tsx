"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Rocket, Wallet } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { ProjectCard } from "@/components/ProjectCard";
import { useGithubVerification } from "@/lib/useGithubVerification";
import { fetchProject, type Project } from "@/lib/projects";

export default function DashboardPage() {
  const { address, isConnected } = useAccount();

  // Projects are single-wallet/single-project: exactly one project per wallet.
  const [project, setProject] = useState<Project | null>(null);
  const [loaded, setLoaded] = useState(false);

  // GitHub verification is wallet-level and shared by the project.
  // Lifted here so the card badge, verify dialog, and launch gate stay in sync.
  const gh = useGithubVerification(address, isConnected);

  // Fetch this wallet's single project.
  const loadProject = useCallback(async () => {
    if (!isConnected || !address) {
      setProject(null);
      setLoaded(false);
      return;
    }
    setLoaded(false);
    const p = await fetchProject(address);
    setProject(p?.name ? p : null);
    setLoaded(true);
  }, [isConnected, address]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const handleProjectUpdated = useCallback((p: Project) => {
    setProject(p);
  }, []);

  // Runs after a successful verify inside the dialog. The lifted `gh` hook
  // already updated its own verifiedHandle (which drives the badge + launch
  // gate); here we just keep the project row's stored handle in sync.
  const handleGithubVerified = useCallback((handle: string) => {
    setProject((prev) => (prev ? { ...prev, github_handle: handle } : prev));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow pt-24 pb-20">
        <div className="shell">
          <div className="max-w-2xl mx-auto">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="mb-8">
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
                  ? "Manage your project, verify your GitHub, and launch escrowed raises."
                  : "Connect your wallet to manage your project and launch raises."}
              </p>
            </div>

            {/* ── Not connected ──────────────────────────────────────────── */}
            {!isConnected && (
              <div className="brand-card p-8 flex flex-col items-center justify-center gap-4 text-center py-16">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-white/5 border border-border">
                  <Wallet className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Connect your wallet</h2>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1 leading-relaxed">
                    Connect to view your project, verify your GitHub, and launch raises.
                  </p>
                </div>
              </div>
            )}

            {/* ── Connected: the project card ────────────────────────────── */}
            {isConnected && (
              <ProjectCard
                project={project}
                loaded={loaded}
                gh={gh}
                onProjectUpdated={handleProjectUpdated}
                onGithubVerified={handleGithubVerified}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}