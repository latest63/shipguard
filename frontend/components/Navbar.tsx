"use client";

import { useState, useEffect } from "react";
import { WordmarkSVG } from "./Logo";
import { LogOut, Menu, X, Wallet, Compass, Rocket, User } from "lucide-react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect } from "wagmi";
import { useRouter } from "next/navigation";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: "explore" | "launch" | "profile" | "myraises" | "connect" | "disconnect" | null;
}

function shortAddr(addr: string | undefined) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // wagmi account + disconnect (RainbowKit v2 does not export a disconnect hook),
  // RainbowKit connect modal for the connect flow.
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const handleNavAction = (action: string) => {
    setMenuOpen(false);
    switch (action) {
      case "connect":
        openConnectModal?.();
        break;
      case "explore":
        router.push("/explore");
        break;
      case "launch":
        // Launching happens from the dashboard — it requires a connected
        // wallet + GitHub verification before a raise can be created.
        router.push("/dashboard");
        break;
      case "disconnect":
        disconnect();
        break;
      case "profile":
        router.push("/dashboard");
        break;
    }
  };

  // Major nav items — primary actions only. Wallet connect/disconnect is
  // handled separately at the foot of the menu, not mixed into this list.
  const menuItems: NavItem[] = [
    { label: "Explore raises", icon: Compass, action: "explore" },
    { label: "Launch a raise", icon: Rocket, action: "launch" },
    { label: "Dashboard", icon: User, action: "profile" },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50">
        <div
          className={`
            border-b transition-all duration-300
            ${isScrolled
              ? "bg-neutral-900/80 backdrop-blur-xl border-border"
              : "bg-transparent border-transparent"
            }
          `}
        >
          <div className="shell">
            <div className="flex h-16 items-center justify-between gap-4">
              {/* Left: brand */}
              <a
                href="/"
                className="flex items-center shrink-0"
                aria-label="ShipGuard home"
                onClick={() => setMenuOpen(false)}
              >
                <WordmarkSVG height={15} className="text-foreground" />
              </a>

              {/* Right: glass-morph wallet widget + hamburger */}
              <div className="flex items-center gap-2">
                {isConnected && address && (
                  <div className="hidden md:flex items-center gap-2.5 pl-2.5 pr-1 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:bg-white/10 transition-all duration-200">
                    {/* Wallet dot */}
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-40" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    <div className="flex flex-col leading-none">
                      <span className="text-[11px] font-medium text-foreground tabular-nums">
                        {shortAddr(address)}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        Studio Next
                      </span>
                    </div>
                    {/* Divider */}
                    <span className="w-px h-6 bg-white/10" />
                    <button
                      onClick={() => handleNavAction("disconnect")}
                      aria-label="Disconnect wallet"
                      className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors duration-150"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Hamburger icon */}
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label={menuOpen ? "Close menu" : "Open menu"}
                  className="
                    flex items-center justify-center w-9 h-9
                    rounded-lg border border-border bg-white/5 backdrop-blur-md
                    text-foreground hover:bg-white/10
                    transition-all duration-200
                  "
                >
                  {menuOpen ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Menu className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile / Overlay menu ───────────────────────────── */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 flex flex-col">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />

          {/* Panel */}
          <div
            className="
              relative mt-16 mx-4 rounded-xl
              bg-neutral-950/95 backdrop-blur-xl
              border border-border
              shadow-2xl shadow-black/50
              overflow-hidden
            "
          >
            {/* Section header */}
            <div className="px-5 py-4 border-b border-border/50">
              <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
                Menu
              </p>
            </div>

            {/* Major nav items */}
            <nav className="p-2">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleNavAction(item.action ?? "explore")}
                  className="
                    w-full flex items-center gap-3
                    px-4 py-3.5 rounded-lg
                    text-sm font-medium
                    text-foreground/80
                    hover:text-foreground hover:bg-white/5
                    transition-colors duration-150
                  "
                >
                  <item.icon className="w-4.5 h-4.5 text-muted-foreground shrink-0" />
                  {item.label}
                </button>
              ))}
            </nav>

            {/* ── Wallet section — foot of the menu, separated from major nav ── */}
            <div className="border-t border-border/50 p-4">
              <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-3 px-1">
                {isConnected ? "Connected wallet" : "Wallet"}
              </p>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.04] border border-white/10">
                {/* Avatar */}
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border shrink-0 ${
                    isConnected
                      ? "bg-primary/15 border-primary/25"
                      : "bg-white/5 border-border"
                  }`}
                >
                  {isConnected ? (
                    <Wallet className="w-5 h-5 text-primary" />
                  ) : (
                    <Wallet className="w-5 h-5 text-muted-foreground/50" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-1.5 w-1.5">
                      <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-50 ${
                          isConnected ? "bg-primary" : "bg-muted-foreground/40"
                        }`}
                      />
                      <span
                        className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                          isConnected ? "bg-primary" : "bg-muted-foreground/40"
                        }`}
                      />
                    </span>
                    <p
                      className={`text-sm font-semibold tabular-nums ${
                        isConnected
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {isConnected && address
                        ? shortAddr(address)
                        : "Not connected"}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isConnected
                      ? "Studio Next · Chain 61997"
                      : "Connect to launch or back a raise"}
                  </p>
                </div>

                {/* Connect / Disconnect */}
                {isConnected ? (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      disconnect();
                    }}
                    aria-label="Disconnect wallet"
                    className="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg border border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors duration-150"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      openConnectModal?.();
                    }}
                    aria-label="Connect wallet"
                    className="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg border border-primary/25 bg-primary/10 text-primary hover:bg-primary/20 transition-colors duration-150"
                  >
                    <Wallet className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
