"use client";

import { Navbar } from "@/components/Navbar";
import { RaiseCarousel } from "@/components/RaiseCarousel";
import { fetchRaises, type ShippingRaise } from "@/lib/raises";
import { Coins, ShieldCheck, Gavel, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = [
  {
    icon: Coins,
    label: "Open a raise",
    body: "A raise is an escrowed funding round with one condition, one evidence URL, and a close date. Backers lock GEN until verification.",
  },
  {
    icon: ShieldCheck,
    label: "Backers deposit",
    body: "Investors contribute GEN to the raise. Funds are held in escrow: the team cannot access them until the condition passes verification.",
  },
  {
    icon: Gavel,
    label: "Verify and settle",
    body: "At the close date, GenLayer AI validates the evidence URL. Pass → funds release. Fail → every backer receives a refund.",
  },
];

const TIMELINE = [
  { label: "Open the raise", detail: "Set condition + close date" },
  { label: "Backers deposit", detail: "GEN locked in escrow" },
  { label: "AI reads evidence", detail: "Verifies against condition" },
  { label: "Release or refund", detail: "Automated settlement" },
];

// ShipGuard roadmap — product milestones, not individual raises.
const ROADMAP = [
  {
    status: "Shipped",
    title: "Escrowed raises",
    body: "Deploy a raise with one condition, one evidence URL, and a close date. Backers deposit GEN into the escrow. No team access until verification.",
  },
  {
    status: "Shipped",
    title: "AI-verified settlement",
    body: "GenLayer validators read the evidence URL and settle to one of two outcomes: release funds to the team, or refund every backer.",
  },
  {
    status: "Shipped",
    title: "Refund safety net",
    body: "After the close date, backers can always claim their refund. A team that goes quiet cannot hold the funds.",
  },
  {
    status: "Next",
    title: "Multi-milestone raises",
    body: "Split a raise into stages, each with its own condition and date, releasing in tranches as each stage is verified.",
  },
  {
    status: "Next",
    title: "Repository tracking",
    body: "Point a condition at a public repo and let validators check commit activity directly, instead of a single evidence page.",
  },
  {
    status: "Exploring",
    title: "Dispute window",
    body: "A short period after a verdict where either side can submit counter-evidence before funds move.",
  },
];


export default function HomePage() {
  const [raises, setRaises] = useState<ShippingRaise[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchRaises().then(setRaises).catch(() => {
      // Fallback handled in fetchRaises
    });
  }, []);

  const handleBackRaise = () => {
    router.push("/explore");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Offset the fixed 64px navbar */}
      <main className="flex-grow pt-16">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="shell pt-16 pb-12 md:pt-24 md:pb-16">
          <div className="max-w-3xl">
            <p className="eyebrow mb-4">AI-verified fundraising on GenLayer</p>

            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl uppercase leading-[1.05] tracking-tight mb-5">
              Capital that only
              <br />
              moves when the{" "}
              <span className="text-primary">work ships</span>.
            </h1>

            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl mb-8">
              Deploy an escrowed raise with a condition and close date. Investors lock GEN. AI validates at deadline. Pass means release funds. Fail means auto-refund.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-12">
              <Button
                variant="gradient"
                size="default"
                onClick={() => router.push("/dashboard")}
                className="transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Rocket className="w-4 h-4 mr-2" />
                Launch a raise
              </Button>
              <Button
                variant="gradient"
                size="default"
                onClick={handleBackRaise}
                className="transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Coins className="w-4 h-4 mr-2" />
                Back a raise
              </Button>
            </div>

            {/* The contract, in four steps */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border">
              {TIMELINE.map((step, i) => {
                const isStep4 = i === 3;
                return (
                  <div
                    key={step.label}
                    className={`bg-background p-4 ${
                      isStep4 ? "step-highlight" : ""
                    }`}
                  >
                    <div className="font-mono text-xs font-semibold text-primary mb-2 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="text-sm font-semibold mb-0.5">
                      {step.label}
                    </div>
                    <div className="text-[13px] text-muted-foreground">
                      {step.detail}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Open raises ──────────────────────────────────── */}
        <section className="pb-16">
          <div className="shell flex items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">Open raises</h2>
              <p className="text-sm text-muted-foreground">
                Live escrowed funding rounds on ShipGuard.
              </p>
            </div>
          </div>

          <RaiseCarousel raises={raises} />
        </section>

        {/* ── How it works ─────────────────────────────────── */}
        <section className="border-t border-border">
          <div className="shell section">
            <h2 className="text-2xl md:text-3xl font-bold mb-10 max-w-2xl">
              Three stages, one escrow, two automated outcomes.
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border">
              {STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.label}
                    className="bg-background p-6 md:p-8"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-primary">
                        <Icon className="w-5 h-5" />
                      </span>
                    </div>
                    <h3 className="text-base font-semibold mb-2">
                      {step.label}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Roadmap ─────────────────────────────────────── */}
        <section className="border-t border-border">
          <div className="shell section">
            <h2 className="text-2xl md:text-3xl font-bold mb-10 max-w-2xl">
              ShipGuard's development milestones.
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ROADMAP.map((item) => (
                <div
                  key={item.title}
                  className={`p-4 border rounded-lg ${
                    item.status === "Shipped"
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${
                        item.status === "Shipped"
                          ? "bg-primary text-background"
                          : "bg-border text-muted-foreground"
                      }`}
                    >
                      {item.status}
                    </span>
                    <h3 className="text-sm font-semibold">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-[13px] text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="shell py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[13px] text-muted-foreground">
              ShipGuard: AI-verified escrow for teams that ship.
            </p>
            <nav className="flex items-center gap-5 text-[13px] text-muted-foreground">
              <a
                href="https://genlayer.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                GenLayer
              </a>
              <a
                href="https://docs.genlayer.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                Docs
              </a>
              <a
                href="https://explorer-studio-dev.genlayer.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                Explorer
              </a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}