import { NextResponse } from "next/server";

// ── Public GitHub repo list for a verified handle ─────────────────────────
// Since GitHub is verified on-chain, the raise form can present the user's
// own public repos and let them pick which repo is the "source of truth"
// that the on-chain validator will check. We fetch server-side to avoid
// browser CORS/rate-limit friction and keep the GitHub token (if any) out
// of the client.

export interface GithubRepo {
  full_name: string; // owner/repo
  html_url: string; // https://github.com/owner/repo
  description: string | null;
  default_branch: string;
  pushed_at: string | null;
  stars: number;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get("handle");
  if (!handle) {
    return NextResponse.json({ error: "handle query param is required" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  // If a GH_TOKEN is available, use it to raise the rate limit.
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(handle)}/repos?per_page=100&type=public&sort=updated`,
      { headers }
    );
    if (res.status === 404) {
      return NextResponse.json({ error: `GitHub user "@${handle}" not found` }, { status: 404 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: `GitHub API error (HTTP ${res.status})` }, { status: 502 });
    }
    const repos = (await res.json()) as Array<{
      full_name: string;
      html_url: string;
      description: string | null;
      default_branch: string;
      pushed_at: string | null;
      stargazers_count: number;
    }>;

    const out: GithubRepo[] = repos.map((r) => ({
      full_name: r.full_name,
      html_url: r.html_url,
      description: r.description,
      default_branch: r.default_branch,
      pushed_at: r.pushed_at,
      stars: r.stargazers_count || 0,
    }));

    return NextResponse.json({ repos: out });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to fetch repos" }, { status: 502 });
  }
}