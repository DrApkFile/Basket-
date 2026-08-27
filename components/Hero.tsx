"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Sparkles, ShieldCheck, Link2, ArrowRight, ArrowDown } from "lucide-react";
import ParticleField from "./ParticleField";

const NAV_LINKS = [
  { label: "HOME", href: "#", active: true },
  { label: "HOW IT WORKS", href: "#how-it-works", active: false },
  { label: "MARKETS", href: "#markets", active: false },
  { label: "DOCS", href: "#docs", active: false },
  { label: "ABOUT", href: "#about", active: false },
];

const FEATURES = [
  {
    n: "01",
    icon: Sparkles,
    title: "AI-CONSTRUCTED",
    body: "Windows selected and explained before you commit.",
  },
  {
    n: "02",
    icon: ShieldCheck,
    title: "RISK-SMOOTHED",
    body: "Several smaller positions instead of one all-or-nothing call.",
  },
  {
    n: "03",
    icon: Link2,
    title: "FULLY ON-CHAIN",
    body: "Every window resolves permissionlessly on DreamDEX.",
  },
];

function WovenMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="12" cy="14" r="8" stroke="#00E28A" strokeWidth="1.6" opacity="0.85" />
      <circle cx="20" cy="14" r="8" stroke="#00E28A" strokeWidth="1.6" opacity="0.55" />
      <circle cx="16" cy="21" r="8" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.35" />
    </svg>
  );
}

function NavLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <a
      href={href}
      className={`relative text-xs tracking-[0.16em] font-display transition-colors ${
        active ? "text-white" : "text-white/60 hover:text-white/90"
      }`}
    >
      {label}
      {active && <span className="absolute -bottom-2 left-0 right-0 h-px bg-accent" />}
    </a>
  );
}

export default function Hero() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <section className="relative min-h-screen overflow-hidden bg-ink">
      {/* Background: particle field + radial vignette on top of it. */}
      <ParticleField />
      <div className="hero-vignette pointer-events-none absolute inset-0" />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header */}
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 sm:px-10">
          <div className="flex items-center gap-3">
            <span className="glass-pill flex h-10 w-10 items-center justify-center rounded-xl">
              <WovenMark />
            </span>
          </div>

          <nav className="hidden items-center gap-10 md:flex">
            {NAV_LINKS.map((l) => (
              <NavLink key={l.label} {...l} />
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] tracking-[0.14em] text-white/45">
              TESTNET
            </span>
            <Link
              href="/basket"
              className="glass-pill flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold tracking-[0.1em] font-display text-white"
            >
              LAUNCH APP
            </Link>
          </div>

          <button
            className="glass-pill flex h-10 w-10 items-center justify-center rounded-xl md:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5 text-white" />
          </button>
        </header>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex flex-col bg-ink/95 backdrop-blur-xl md:hidden">
            <div className="flex items-center justify-between px-6 py-6">
              <span className="glass-pill flex h-10 w-10 items-center justify-center rounded-xl">
                <WovenMark />
              </span>
              <button
                className="glass-pill flex h-10 w-10 items-center justify-center rounded-xl"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col items-center justify-center gap-8">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={() => setDrawerOpen(false)}
                  className={`font-display text-2xl tracking-[0.1em] ${
                    l.active ? "text-accent" : "text-white/70"
                  }`}
                >
                  {l.label}
                </a>
              ))}
              <Link
                href="/basket"
                className="glass-pill mt-4 rounded-full px-8 py-3 text-sm font-semibold tracking-[0.1em] font-display text-white"
              >
                LAUNCH APP
              </Link>
            </nav>
          </div>
        )}

        {/* Main content */}
        <div className="mx-auto flex w-full max-w-7xl flex-1 items-center px-6 py-16 sm:px-10">
          <div className="grid w-full grid-cols-1 gap-y-16 lg:grid-cols-12 lg:gap-x-8">
            {/* Left: headline */}
            <div className="lg:col-span-5">
              <p className="mb-5 font-display text-xs font-semibold tracking-[0.28em] text-accent">
                SPREAD THE RISK
              </p>
              <h1 className="font-display text-5xl font-black uppercase leading-[0.96] text-white sm:text-7xl lg:text-[76px]">
                One call.
                <br />
                Many windows.
                <br />
                Not one coin flip.
              </h1>
              <p className="mt-7 max-w-md text-base leading-relaxed text-white/72">
                Basket turns a single directional view into several smaller, correlated
                DreamDEX Event Contracts — reasoned out loud by AI, before you ever commit
                a dollar.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-6">
                <Link
                  href="/basket"
                  className="glass-pill flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold tracking-[0.08em] font-display text-white"
                >
                  BUILD A BASKET
                  <ArrowRight className="h-4 w-4 text-accent" />
                </Link>
                <a
                  href="#how-it-works"
                  className="flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-white/85"
                >
                  See how it works
                  <ArrowDown className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Center: spacer preserving the orb visual */}
            <div className="hidden lg:col-span-3 lg:block" aria-hidden="true" />

            {/* Right: numbered feature stack */}
            <div className="flex flex-col gap-10 lg:col-span-4 lg:justify-self-end">
              {FEATURES.map((f) => (
                <div key={f.n} className="flex items-start gap-4">
                  <span className="font-display text-sm font-semibold text-white/30">{f.n}</span>
                  <div>
                    <div className="mb-1.5 flex items-center gap-2">
                      <f.icon className="h-4 w-4 text-accent" />
                      <h3 className="font-display text-sm font-bold tracking-[0.08em] text-white">
                        {f.title}
                      </h3>
                    </div>
                    <p className="max-w-xs text-sm leading-relaxed text-white/60">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ticker strip */}
        <div className="relative z-10 border-t border-white/8 bg-ink/60">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-6 py-3.5 text-xs text-white/45 sm:px-10">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" />
            <span className="font-mono tracking-tight">
              BTC BASKET — 3/5 SETTLED ·{" "}
              <span className="text-accent">+12%</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
