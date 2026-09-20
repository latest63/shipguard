/**
 * Open raises — data source backed by Supabase.
 *
 * Uses the Ecosystem Fund Guardian Supabase project
 * (ervkqbncvboqsgvwjnpq.supabase.co) with a `raises` table.
 *
 * Reads directly from the table. No seed/fallback data: if the table
 * is empty (or Supabase is unavailable), an empty list is returned.
 */

import { createClient } from "@supabase/supabase-js";

export interface ShippingRaise {
  id: string;
  company: string;
  tagline: string;
  initials: string;
  tint: string;
  logo_url?: string;
  raised: string;
  progress: number;
  closes_on: string;
  verified: boolean;
  // Project-linkage fields (raise stems from the launching project).
  project_id?: string | null;
  project_wallet?: string | null;
  github_handle?: string | null;
  project_link?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  discord?: string | null;
  description?: string | null;
  creator?: string | null;
  repo_url?: string | null;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
  "";

const hasSupabase = Boolean(supabaseUrl && supabaseKey);

/**
 * Parse a human-readable "raised" value (e.g. "4.2M", "1,200", "8.5K")
 * into a numeric amount so the explore page can sum it.
 */
export function parseRaised(value: string): number {
  const s = (value || "").trim().replace(/,/g, "");
  if (!s) return 0;
  const m = s.match(/^([\d.]+)\s*([MKTk])?$/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return 0;
  const suffix = (m[2] || "").toUpperCase();
  if (suffix === "T") return n * 1e12;
  if (suffix === "M") return n * 1e6;
  if (suffix === "K") return n * 1e3;
  return n;
}

/** Format a numeric total back into a compact token string. */
export function formatTotal(n: number): string {
  if (n <= 0) return "0";
  if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2).replace(/\.?0+$/, "") + "K";
  return String(Math.round(n));
}

/**
 * Fetch open raises from Supabase. Returns an empty array when there is
 * nothing to show — no fallback seed data.
 */
export async function fetchRaises(): Promise<ShippingRaise[]> {
  if (!hasSupabase) return [];

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from("raises")
      .select("*")
      .order("progress", { ascending: false });

    if (error) {
      console.warn("[raises] Supabase query failed:", error.message);
      return [];
    }
    return (data || []) as ShippingRaise[];
  } catch (err) {
    console.error("[raises] Supabase fetch failed:", err);
    return [];
  }
}
