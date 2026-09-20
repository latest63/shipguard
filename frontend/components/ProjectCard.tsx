"use client";

import { useState } from "react";
import {
  Rocket,
  Edit,
  Github,
  Check,
  Loader2,
  ShieldCheck,
  ExternalLink,
  Plus,
} from "lucide-react";
import type { Project } from "@/lib/projects";
import type { GithubVerification } from "@/lib/useGithubVerification";
import { ProjectFormDialog } from "@/components/ProjectFormDialog";
import { GithubVerifyDialog } from "@/components/GithubVerifyDialog";
import { LaunchRaiseDialog } from "@/components/LaunchRaiseDialog";
import { Button } from "@/components/ui/button";

type ActiveDialog = null | "edit" | "github" | "launch";

/**
 * The project card shown on the dashboard.
 *
 * In the single-wallet/single-project model, this card is the entire project
 * management surface. It hosts three dialogs:
 *   - Edit details   (ProjectFormDialog)
 *   - GitHub verify  (GithubVerifyDialog) — moved off the main dashboard.
 *   - Launch a raise (LaunchRaiseDialog)  — scoped to this project.
 */
export function ProjectCard({
  project,
  loaded,
  gh,
  onProjectUpdated,
  onGithubVerified,
}: {
  project: Project | null;
  loaded: boolean;
  gh: GithubVerification;
  onProjectUpdated: (p: Project) => void;
  onGithubVerified: (handle: string) => void;
}) {
  const [active, setActive] = useState<ActiveDialog>(null);
  const ghHandle = gh.verifiedHandle;
  const ghChecking = gh.checking;
  const extra = (project?.profile_data || {}) as Record<string, unknown>;
  const description = (extra.description as string) || project?.link || "";

  const handleSaved = (p: Project) => {
    onProjectUpdated(p);
    setActive(null);
  };

  // Still loading the project row
  if (!loaded) {
    return (
      <div className="brand-card p-8 flex flex-col items-center justify-center gap-3 text-muted-foreground py-16">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-sm">Loading your project…</p>
      </div>
    );
  }

  // No project yet — empty state prompting creation
  if (!project) {
    return (
      <div className="brand-card p-8 flex flex-col items-center justify-center gap-4 text-center py-16">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 border border-primary/25">
          <Rocket className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Create your project</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1 leading-relaxed">
            Set up your project to start raising funds with AI-verified escrow.
          </p>
        </div>
        <Button variant="gradient" size="lg" className="gap-2 mt-2" onClick={() => setActive("edit")}>
          <Plus className="w-5 h-5" /> Create a new project
        </Button>
      </div>
    );
  }

  const logo = project.logo_url;

  return (
    <div className="brand-card">
      {/* ── Card header: logo + name ─────────────────────────────────── */}
      <div className="px-6 py-6">
        <div className="flex items-start gap-4">
          <div className="relative flex items-center justify-center w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 overflow-hidden shrink-0">
            {logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={logo}
                alt={project.name || "Project logo"}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <Rocket className="w-7 h-7 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h2 className="text-xl font-bold tracking-tight truncate">
              {project.name || "Untitled project"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              ShipGuard project ·{" "}
              {ghHandle ? (
                <span className="inline-flex items-center gap-1 text-primary">
                  <Check className="w-3 h-3" /> GitHub verified
                </span>
              ) : (
                "GitHub not verified"
              )}
            </p>

            {/* GitHub status badge */}
            <div className="mt-3">
              {ghChecking ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-border text-muted-foreground text-[11px]">
                  <Loader2 className="w-3 h-3 animate-spin" /> Checking GitHub…
                </span>
              ) : ghHandle ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[11px] font-medium">
                  <ShieldCheck className="w-3 h-3" /> @{ghHandle}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 border border-destructive/25 text-destructive text-[11px] font-medium">
                  <Github className="w-3 h-3" /> Verify to launch
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description / link */}
        {(description || project.link) && (
          <div className="mt-5">
            {description ? (
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                {description}
              </p>
            ) : null}
            {project.link && (
              <a
                href={project.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
              >
                <ExternalLink className="w-3 h-3" /> {project.link}
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Divider + action rows ─────────────────────────────────────── */}
      <div className="border-t border-border/60">
        {/* Row 1: Edit details + GitHub verify */}
        <div className="grid grid-cols-2 divide-x divide-border/60">
          <button
            onClick={() => setActive("edit")}
            className="flex items-center gap-2 px-5 py-4 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-white/[0.03] transition-colors"
          >
            <Edit className="w-4 h-4 text-muted-foreground" />
            Edit details
          </button>
          <button
            onClick={() => setActive("github")}
            className="flex items-center gap-2 px-5 py-4 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-white/[0.03] transition-colors"
          >
            {ghHandle ? (
              <ShieldCheck className="w-4 h-4 text-primary" />
            ) : (
              <Github className="w-4 h-4 text-muted-foreground" />
            )}
            {ghHandle ? `GitHub • @${ghHandle}` : "Verify GitHub"}
          </button>
        </div>

        {/* Row 2: Launch a raise (primary) */}
        <div className="border-t border-border/60 p-5">
          <Button
            variant="gradient"
            size="lg"
            className="w-full gap-2 h-auto py-3.5 justify-center"
            onClick={() => setActive("launch")}
          >
            <Rocket className="w-5 h-5" /> Launch a raise
          </Button>
          <p className="text-[11px] text-muted-foreground/70 mt-2 text-center">
            {ghHandle
              ? "Open an escrowed round for this project."
              : "Verify your GitHub above to unlock raises."}
          </p>
        </div>
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────── */}
      <ProjectFormDialog
        open={active === "edit"}
        onOpenChange={(o) => setActive(o ? "edit" : null)}
        project={project}
        onSaved={handleSaved}
      />
      <GithubVerifyDialog
        open={active === "github"}
        onOpenChange={(o) => setActive(o ? "github" : null)}
        gh={gh}
        onVerified={onGithubVerified}
      />
      <LaunchRaiseDialog
        open={active === "launch"}
        onOpenChange={(o) => setActive(o ? "launch" : null)}
        project={project}
        ghHandle={ghHandle}
      />
    </div>
  );
}