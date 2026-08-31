"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Sparkles, ShieldCheck, Link2, TrendingUp, Layers, Zap } from "lucide-react";

export default function Hero() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [motionPending, setMotionPending] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [glowOpacity, setGlowOpacity] = useState(0);
  const heroRef = useRef<HTMLElement>(null);
  const glowTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setMotionPending(false);
      return;
    }

    const timeout = setTimeout(() => setMotionPending(false), 2500);
    return () => clearTimeout(timeout);
  }, []);

  // Mouse tracking for hero glow effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!heroRef.current) return;

      const rect = heroRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      setMousePos({ x, y });
      setGlowOpacity(1);

      // Clear existing timeout
      if (glowTimeoutRef.current) {
        clearTimeout(glowTimeoutRef.current);
      }

      // Fade out after 3 seconds of no movement
      glowTimeoutRef.current = setTimeout(() => {
        setGlowOpacity(0);
      }, 3000);
    };

    const heroElement = heroRef.current;
    if (heroElement) {
      heroElement.addEventListener("mousemove", handleMouseMove);
    }

    return () => {
      if (heroElement) {
        heroElement.removeEventListener("mousemove", handleMouseMove);
      }
      if (glowTimeoutRef.current) {
        clearTimeout(glowTimeoutRef.current);
      }
    };
  }, []);

  // Close menu on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');

        :root {
          --gutter: clamp(24px, 5vw, 96px);
          --header-height: 72px;
        }

        .landing-page {
          background: #000;
          color: #fff;
          font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
          min-height: 100vh;
        }

        /* Header */
        .header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: var(--header-height);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--gutter);
          z-index: 100;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
        }

        .brand-logo {
          width: 32px;
          height: 32px;
        }

        .brand-name {
          font-size: 20px;
          font-weight: 600;
          color: #fff;
          letter-spacing: -0.5px;
        }

        .nav {
          display: flex;
          align-items: center;
          gap: clamp(24px, 3vw, 40px);
        }

        .nav-link {
          font-size: 15px;
          font-weight: 450;
          color: rgba(255, 255, 255, 0.7);
          text-decoration: none;
          transition: color 200ms;
        }

        .nav-link:hover,
        .nav-link.active {
          color: #fff;
        }

        .header-cta {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .btn-secondary {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.8);
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          cursor: pointer;
          transition: all 200ms;
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .btn-primary {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 500;
          color: #000;
          background: #fff;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 200ms;
        }

        .btn-primary:hover {
          background: rgba(255, 255, 255, 0.9);
          transform: translateY(-1px);
        }

        .menu-toggle {
          display: none;
          width: 44px;
          height: 44px;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          cursor: pointer;
        }

        /* Hero Section */
        .hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          padding: calc(var(--header-height) + 60px) var(--gutter) 80px;
          overflow: hidden;
          isolation: isolate;
        }

        .hero-bg {
          position: absolute;
          inset: 0;
          z-index: -1;
          overflow: hidden;
          background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%);
        }

        .hero-video {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          pointer-events: none;
          user-select: none;
        }

        .hero-glow {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          transition: opacity 3s ease-in-out;
          mix-blend-mode: screen;
        }

        .hero-overlay {
          position: absolute;
          inset: 0;
          z-index: 2;
          background:
            linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.9) 100%),
            radial-gradient(ellipse at 50% 50%, transparent 20%, rgba(0,0,0,0.5) 100%);
          pointer-events: none;
        }

        .hero-content {
          position: relative;
          z-index: 10;
          max-width: 900px;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 100px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 32px;
        }

        .hero-badge-dot {
          width: 8px;
          height: 8px;
          background: #00E28A;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .hero-title {
          font-size: clamp(48px, 8vw, 88px);
          font-weight: 600;
          line-height: 1.05;
          letter-spacing: -2px;
          margin: 0 0 28px;
        }

        .hero-title .line {
          display: block;
        }

        .hero-title .highlight {
          color: rgba(255, 255, 255, 0.5);
        }

        .hero-description {
          font-size: clamp(18px, 2vw, 22px);
          font-weight: 350;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.7);
          max-width: 600px;
          margin-bottom: 40px;
        }

        .hero-actions {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .hero-cta {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 16px 28px;
          font-size: 16px;
          font-weight: 500;
          color: #000;
          background: #fff;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 200ms;
          text-decoration: none;
        }

        .hero-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(255, 255, 255, 0.15);
        }

        .hero-cta-secondary {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #fff;
        }

        .hero-cta-secondary:hover {
          background: rgba(255, 255, 255, 0.12);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }

        /* Features Section */
        .section {
          padding: 120px var(--gutter);
          position: relative;
        }

        .section-dark {
          background: #050508;
        }

        .section-header {
          text-align: center;
          max-width: 700px;
          margin: 0 auto 80px;
        }

        .section-label {
          display: inline-block;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #00E28A;
          margin-bottom: 20px;
        }

        .section-title {
          font-size: clamp(32px, 5vw, 48px);
          font-weight: 600;
          line-height: 1.15;
          letter-spacing: -1px;
          margin: 0 0 20px;
        }

        .section-description {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.6;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .feature-card {
          padding: 32px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          transition: all 300ms;
        }

        .feature-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.1);
          transform: translateY(-4px);
        }

        .feature-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 226, 138, 0.1);
          border-radius: 12px;
          margin-bottom: 20px;
          color: #00E28A;
        }

        .feature-title {
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 12px;
        }

        .feature-description {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.55);
          line-height: 1.6;
          margin: 0;
        }

        /* How It Works Section */
        .steps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 48px;
          max-width: 1000px;
          margin: 0 auto;
        }

        .step {
          text-align: center;
        }

        .step-number {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
          font-size: 24px;
          font-weight: 700;
          color: #00E28A;
          background: rgba(0, 226, 138, 0.1);
          border: 1px solid rgba(0, 226, 138, 0.2);
          border-radius: 16px;
        }

        .step-title {
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 12px;
        }

        .step-description {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.55);
          line-height: 1.6;
          margin: 0;
        }

        /* Footer */
        .footer {
          padding: 60px var(--gutter);
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          background: #000;
        }

        .footer-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .footer-brand-name {
          font-size: 18px;
          font-weight: 600;
        }

        .footer-links {
          display: flex;
          gap: 32px;
        }

        .footer-link {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          text-decoration: none;
          transition: color 200ms;
        }

        .footer-link:hover {
          color: #fff;
        }

        .footer-copy {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.4);
        }

        /* Entrance animations */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .motion-pending .hero-badge {
          opacity: 0;
          animation: fadeInUp 600ms ease-out 200ms forwards;
        }

        .motion-pending .hero-title {
          opacity: 0;
          animation: fadeInUp 700ms ease-out 400ms forwards;
        }

        .motion-pending .hero-description {
          opacity: 0;
          animation: fadeInUp 600ms ease-out 600ms forwards;
        }

        .motion-pending .hero-actions {
          opacity: 0;
          animation: fadeInUp 600ms ease-out 800ms forwards;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .nav {
            display: none;
          }

          .header-cta .btn-secondary {
            display: none;
          }

          .menu-toggle {
            display: flex;
          }

          .hero {
            padding-top: calc(var(--header-height) + 40px);
          }

          .hero-title {
            letter-spacing: -1px;
          }

          .section {
            padding: 80px var(--gutter);
          }

          .footer-content {
            flex-direction: column;
            text-align: center;
          }

          .footer-links {
            flex-wrap: wrap;
            justify-content: center;
          }
        }
      `}</style>

      <div className={`landing-page ${motionPending ? "motion-pending" : ""}`}>
        {/* Header */}
        <header className="header">
          <Link href="/" className="brand">
            <svg className="brand-logo" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="16" fill="#00E28A" />
              <path d="M16 8L10 14L16 12L22 14L16 8Z" fill="#000" />
              <path d="M10 14L16 20V12L10 14Z" fill="#000" fillOpacity="0.4" />
              <path d="M22 14L16 12V20L22 14Z" fill="#000" fillOpacity="0.7" />
              <path d="M16 20L10 14L8 20L16 26L24 20L22 14L16 20Z" fill="#000" />
            </svg>
            <span className="brand-name">Basket</span>
          </Link>

          <nav className="nav">
            <a href="#" className="nav-link active">Home</a>
            <a href="#features" className="nav-link">Features</a>
            <a href="#how-it-works" className="nav-link">How It Works</a>
            <a href="#" className="nav-link">Docs</a>
          </nav>

          <div className="header-cta">
            <button className="btn-secondary">Sign In</button>
            <Link href="/basket">
              <button className="btn-primary">Launch App</button>
            </Link>
          </div>

          <button
            className="menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
              {menuOpen ? (
                <>
                  <line x1="2" y1="2" x2="18" y2="12" stroke="white" strokeWidth="2" />
                  <line x1="2" y1="12" x2="18" y2="2" stroke="white" strokeWidth="2" />
                </>
              ) : (
                <>
                  <line x1="0" y1="3" x2="20" y2="3" stroke="white" strokeWidth="2" />
                  <line x1="0" y1="11" x2="20" y2="11" stroke="white" strokeWidth="2" />
                </>
              )}
            </svg>
          </button>
        </header>

        {/* Hero Section */}
        <section className="hero" ref={heroRef}>
          <div className="hero-bg">
            {/* Background Video */}
            <video
              className="hero-video"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-hidden="true"
            >
              <source
                src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260808_064556_051587f1-74a1-4336-8c05-4dde3594ed05.mp4"
                type="video/mp4"
              />
            </video>
            {/* Mouse-following glow effect */}
            <div
              className="hero-glow"
              style={{
                opacity: glowOpacity,
                background: `
                  radial-gradient(900px circle at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(0, 226, 138, 0.3), transparent 50%),
                  radial-gradient(600px circle at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(0, 255, 150, 0.15), transparent 40%)
                `,
              }}
            />
            {/* Ambient glow that follows mouse with delay */}
            <div
              className="hero-glow-ambient"
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                pointerEvents: 'none',
                opacity: glowOpacity * 0.6,
                background: `radial-gradient(1200px circle at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(0, 200, 120, 0.08), transparent 60%)`,
                transition: 'opacity 3s ease-in-out, background 0.5s ease-out',
              }}
            />
            <div className="hero-overlay" />
          </div>

          <div className="hero-content">
            <div className="hero-badge">
              <span className="hero-badge-dot" />
              Live on Somnia Testnet
            </div>

            <h1 className="hero-title">
              <span className="line">One Call.</span>
              <span className="line highlight">Many Windows.</span>
              <span className="line highlight">Not One Coin Flip.</span>
            </h1>

            <p className="hero-description">
              Basket turns a single directional view into several smaller, correlated
              DreamDEX Event Contracts — reasoned out loud by AI, before you ever
              commit a dollar.
            </p>

            <div className="hero-actions">
              <Link href="/basket" className="hero-cta">
                Build a Basket
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8H13M13 8L8 3M13 8L8 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <a href="#how-it-works" className="hero-cta hero-cta-secondary">
                See How It Works
              </a>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="section section-dark" id="features">
          <div className="section-header">
            <span className="section-label">Features</span>
            <h2 className="section-title">Spread the Risk, Keep the Upside</h2>
            <p className="section-description">
              Every basket is AI-constructed, on-chain, and designed to reduce variance
              without sacrificing your thesis.
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <Sparkles size={24} />
              </div>
              <h3 className="feature-title">AI-Constructed</h3>
              <p className="feature-description">
                Windows selected and explained before you commit. No black box — see the
                reasoning behind every position in your basket.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <ShieldCheck size={24} />
              </div>
              <h3 className="feature-title">Risk-Smoothed</h3>
              <p className="feature-description">
                Several smaller positions instead of one all-or-nothing call.
                Statistical variance reduction you can measure.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Link2 size={24} />
              </div>
              <h3 className="feature-title">Fully On-Chain</h3>
              <p className="feature-description">
                Every window resolves permissionlessly on DreamDEX. Your positions,
                your keys, verifiable outcomes.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <TrendingUp size={24} />
              </div>
              <h3 className="feature-title">Real-Time Markets</h3>
              <p className="feature-description">
                Live price feeds from BTC and ETH binary markets with multiple
                time windows — from 5 minutes to 24 hours.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Layers size={24} />
              </div>
              <h3 className="feature-title">Cross-Asset Baskets</h3>
              <p className="feature-description">
                Combine BTC and ETH positions in a single basket for even more
                diversification across correlated assets.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Zap size={24} />
              </div>
              <h3 className="feature-title">Instant Settlement</h3>
              <p className="feature-description">
                Markets resolve automatically. Winning positions can be redeemed
                immediately — no waiting, no counterparty risk.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="section" id="how-it-works">
          <div className="section-header">
            <span className="section-label">How It Works</span>
            <h2 className="section-title">From Thesis to Basket in Minutes</h2>
            <p className="section-description">
              Tell us your view, set your parameters, and let AI do the heavy lifting.
            </p>
          </div>

          <div className="steps-grid">
            <div className="step">
              <div className="step-number">1</div>
              <h3 className="step-title">Set Your Parameters</h3>
              <p className="step-description">
                Choose your asset (BTC, ETH, or both), number of windows (2-5),
                max spend, and risk tolerance.
              </p>
            </div>

            <div className="step">
              <div className="step-number">2</div>
              <h3 className="step-title">Review AI Proposal</h3>
              <p className="step-description">
                Our AI analyzes live markets and constructs a diversified basket
                with full reasoning and risk metrics.
              </p>
            </div>

            <div className="step">
              <div className="step-number">3</div>
              <h3 className="step-title">Approve & Execute</h3>
              <p className="step-description">
                Sign the transactions to place your orders. Each position is
                tracked and monitored automatically.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="footer">
          <div className="footer-content">
            <div className="footer-brand">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="16" fill="#00E28A" />
                <path d="M16 8L10 14L16 12L22 14L16 8Z" fill="#000" />
                <path d="M10 14L16 20V12L10 14Z" fill="#000" fillOpacity="0.4" />
                <path d="M22 14L16 12V20L22 14Z" fill="#000" fillOpacity="0.7" />
                <path d="M16 20L10 14L8 20L16 26L24 20L22 14L16 20Z" fill="#000" />
              </svg>
              <span className="footer-brand-name">Basket</span>
            </div>

            <div className="footer-links">
              <a href="#" className="footer-link">Documentation</a>
              <a href="#" className="footer-link">GitHub</a>
              <a href="#" className="footer-link">Twitter</a>
              <a href="#" className="footer-link">Discord</a>
            </div>

            <p className="footer-copy">
              © 2026 Basket. Built on Somnia.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
