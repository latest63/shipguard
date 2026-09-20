"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Loader2, Rocket, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { upsertProject, type Project } from "@/lib/projects";
import { success, error } from "@/lib/utils/toast";

interface ProjectFormData {
  name: string;
  logo_url: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
}

const EMPTY: ProjectFormData = {
  name: "",
  logo_url: "",
  description: "",
  website: "",
  twitter: "",
  telegram: "",
  discord: "",
};

/**
 * Create-or-edit project details in a clean dialog.
 *
 * - `project === null`  → "Create project" mode (inserts a new row).
 * - `project !== null`  → "Edit details" mode (updates the existing row).
 *
 * GitHub verification is NOT part of this dialog — that lives in
 * GithubVerifyDialog (it is wallet-level, shared by the project).
 */
export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  onSaved: (p: Project) => void;
}) {
  const { address, isConnected } = useAccount();
  const isEdit = !!project;
  const [form, setForm] = useState<ProjectFormData>(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  // Load existing data when editing
  useEffect(() => {
    if (!open) return;
    if (project && project.id) {
      const extra = (project.profile_data || {}) as Record<string, unknown>;
      setForm({
        name: project.name || "",
        logo_url: project.logo_url || "",
        description: (extra.description as string) || "",
        website: project.link || "",
        twitter: (extra.twitter as string) || "",
        telegram: (extra.telegram as string) || "",
        discord: (extra.discord as string) || "",
      });
      setLoading(false);
    } else {
      setForm(EMPTY);
      setLoading(false);
    }
  }, [open, project]);

  const handleChange =
    (field: keyof ProjectFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSave = async () => {
    if (!address) return;
    if (!form.name.trim()) {
      error("Project name is required");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim() || null,
      logo_url: form.logo_url.trim() || null,
      link: form.website.trim() || null,
      profile_data: {
        description: form.description.trim() || null,
        twitter: form.twitter.trim() || null,
        telegram: form.telegram.trim() || null,
        discord: form.discord.trim() || null,
      },
    };
    try {
      // Single-project model: upsert keyed on wallet_address (create or update).
      const updated = await upsertProject(address, payload);
      if (updated) {
        success(isEdit ? "Project updated" : "Project created", {
          description: isEdit
            ? "Your project details were saved."
            : "Your project is ready. Verify your GitHub to launch a raise.",
        });
        onSaved(updated);
        onOpenChange(false);
      } else {
        error(isEdit ? "Failed to update project" : "Failed to create project", {
          description: "Could not save your project. Please try again.",
        });
      }
    } catch (e: any) {
      error("Error saving project", {
        description: e?.message || "Unknown error occurred",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="brand-card border-2 sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {isEdit ? "Edit project details" : "Create a project"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {isEdit
              ? "Update your project&apos;s name, logo, and links. Changes are saved to your profile."
              : "Give your project a name and links. You can verify your GitHub right after."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {loading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading project…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pf-name">Project name</Label>
                <input
                  id="pf-name"
                  type="text"
                  placeholder="e.g. My Awesome Project"
                  value={form.name}
                  onChange={handleChange("name")}
                  className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pf-logo">Logo URL</Label>
                <input
                  id="pf-logo"
                  type="url"
                  placeholder="https://yourproject.com/logo.png"
                  value={form.logo_url}
                  onChange={handleChange("logo_url")}
                  className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pf-desc">Description</Label>
                <textarea
                  id="pf-desc"
                  placeholder="Describe your project…"
                  value={form.description}
                  onChange={handleChange("description")}
                  rows={3}
                  className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 resize-y"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pf-site">Website</Label>
                <input
                  id="pf-site"
                  type="url"
                  placeholder="https://yourproject.com"
                  value={form.website}
                  onChange={handleChange("website")}
                  className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="pf-tw">Twitter</Label>
                  <input
                    id="pf-tw"
                    type="text"
                    placeholder="yourproject"
                    value={form.twitter}
                    onChange={handleChange("twitter")}
                    className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pf-tg">Telegram</Label>
                  <input
                    id="pf-tg"
                    type="text"
                    placeholder="@yourproject"
                    value={form.telegram}
                    onChange={handleChange("telegram")}
                    className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pf-dc">Discord</Label>
                <input
                  id="pf-dc"
                  type="text"
                  placeholder="discord.gg/yourproject"
                  value={form.discord}
                  onChange={handleChange("discord")}
                  className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                />
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
                  type="button"
                  variant="gradient"
                  className="flex-1 gap-2"
                  onClick={handleSave}
                  disabled={saving || !isConnected || !form.name.trim()}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isEdit ? "Saving…" : "Creating…"}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {isEdit ? "Save changes" : "Create project"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}