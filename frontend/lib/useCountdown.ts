"use client";

import { useEffect, useState } from "react";

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number; // ms until deadline (0 if passed)
  ended: boolean;
}

/** Live countdown to an ISO/ms deadline. Ticks every second. */
export function useCountdown(deadline: string | number | Date): CountdownParts {
  const target = new Date(deadline).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const total = Math.max(0, target - now);
  const ended = total <= 0;
  return {
    days: Math.floor(total / 86_400_000),
    hours: Math.floor((total % 86_400_000) / 3_600_000),
    minutes: Math.floor((total % 3_600_000) / 60_000),
    seconds: Math.floor((total % 60_000) / 1000),
    total,
    ended,
  };
}

/** Pretty compact remaining label, e.g. "3d 4h", "12h 30m", "5m 12s". */
export function formatRemaining(p: CountdownParts): string {
  if (p.ended) return "Ended";
  if (p.days > 0) return `${p.days}d ${p.hours}h`;
  if (p.hours > 0) return `${p.hours}h ${p.minutes}m`;
  return `${p.minutes}m ${p.seconds}s`;
}