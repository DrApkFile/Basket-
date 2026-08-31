"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      setMousePos({ x, y });
      setGlowOpacity(1);
      if (glowTimeoutRef.current) clearTimeout(glowTimeoutRef.current);
      glowTimeoutRef.current = setTimeout(() => setGlowOpacity(0), 3000);
    };

    const heroElement = heroRef.current;
    if (heroElement) heroElement.addEventListener("mousemove", handleMouseMove);
    return () => {
      if (heroElement) heroElement.removeEventListener("mousemove", handleMouseMove);
      if (glowTimeoutRef.current) clearTimeout(glowTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen) setMenuOpen(false);
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
          --accent-green: #00E28A;
          --accent-orange: #FF6B35;
          --accent-gradient: linear-gradient(135deg, var(--accent-orange), var(--accent-green));
        }

        .landing-page {
          background: #000;
          color: #fff;
          font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
          min-height: 100vh;
        }

        /* Glass Button */
        .glass-btn {
          position: relative;
          padding: 12px 24px;
          font-size: 14px;
          font-weight: 500;
          color: #fff;
          background: linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(0, 226, 138, 0.1));
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          cursor: pointer;
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          box-shadow:
            0 4px 24px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            inset 0 -1px 0 rgba(0, 0, 0, 0.1);
          transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
        }

        .glass-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(0, 226, 138, 0.15));
          opacity: 0;
          transition: opacity 300ms;
          border-radius: inherit;
        }

        .glass-btn:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow:
            0 8px 32px rgba(255, 107, 53, 0.2),
            0 4px 16px rgba(0, 226, 138, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        .glass-btn:hover::before {
          opacity: 1;
        }

        .glass-btn span {
          position: relative;
          z-index: 1;
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
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
        }

        .brand-logo {
          width: 36px;
          height: 36px;
        }

        .brand-name {
          font-size: 22px;
          font-weight: 700;
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
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
          color: rgba(255, 255, 255, 0.6);
          text-decoration: none;
          transition: color 200ms;
          position: relative;
        }

        .nav-link:hover,
        .nav-link.active {
          color: #fff;
        }

        .nav-link.active::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--accent-gradient);
          border-radius: 1px;
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
          backdrop-filter: blur(10px);
        }

        /* Hero Section */
        .hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          padding: calc(var(--header-height) + 80px) var(--gutter) 100px;
          overflow: hidden;
          isolation: isolate;
        }

        .hero-bg {
          position: absolute;
          inset: 0;
          z-index: -1;
          overflow: hidden;
          background: radial-gradient(ellipse at 30% 20%, rgba(255, 107, 53, 0.08) 0%, transparent 50%),
                      radial-gradient(ellipse at 70% 80%, rgba(0, 226, 138, 0.06) 0%, transparent 50%),
                      #000;
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
          opacity: 0.7;
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
            linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 25%, transparent 65%, rgba(0,0,0,0.95) 100%),
            radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.4) 100%);
          pointer-events: none;
        }

        .hero-content {
          position: relative;
          z-index: 10;
          max-width: 800px;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 18px;
          background: linear-gradient(135deg, rgba(255, 107, 53, 0.12), rgba(0, 226, 138, 0.08));
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 100px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 36px;
          backdrop-filter: blur(10px);
        }

        .hero-badge-dot {
          width: 8px;
          height: 8px;
          background: var(--accent-green);
          border-radius: 50%;
          animation: pulse 2s infinite;
          box-shadow: 0 0 12px var(--accent-green);
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.9); }
        }

        .hero-title {
          font-size: clamp(52px, 9vw, 96px);
          font-weight: 700;
          line-height: 1.0;
          letter-spacing: -3px;
          margin: 0 0 32px;
        }

        .hero-title .line {
          display: block;
        }

        .hero-title .gradient {
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-title .dim {
          color: rgba(255, 255, 255, 0.4);
        }

        .hero-description {
          font-size: clamp(18px, 2.2vw, 24px);
          font-weight: 400;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.6);
          max-width: 560px;
          margin-bottom: 48px;
        }

        .hero-actions {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .hero-cta {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 18px 32px;
          font-size: 16px;
          font-weight: 600;
          text-decoration: none;
        }

        .hero-cta-primary {
          background: linear-gradient(135deg, var(--accent-orange), #FF8B5A);
          color: #000;
          border: none;
          border-radius: 14px;
          box-shadow: 0 4px 24px rgba(255, 107, 53, 0.4);
          transition: all 300ms;
        }

        .hero-cta-primary:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 40px rgba(255, 107, 53, 0.5);
        }

        .hero-cta-secondary {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #fff;
          border-radius: 14px;
          backdrop-filter: blur(10px);
          transition: all 300ms;
        }

        .hero-cta-secondary:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }

        /* Stats Bar */
        .stats-bar {
          display: flex;
          gap: 48px;
          margin-top: 80px;
          padding-top: 40px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .stat {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-value {
          font-size: 32px;
          font-weight: 700;
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .stat-label {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Features Section */
        .section {
          padding: 140px var(--gutter);
          position: relative;
        }

        .section-dark {
          background: linear-gradient(180deg, #000 0%, #050508 50%, #000 100%);
        }

        .section-header {
          text-align: center;
          max-width: 700px;
          margin: 0 auto 100px;
        }

        .section-label {
          display: inline-block;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 24px;
        }

        .section-title {
          font-size: clamp(36px, 5vw, 56px);
          font-weight: 700;
          line-height: 1.1;
          letter-spacing: -1.5px;
          margin: 0 0 24px;
        }

        .section-description {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.7;
        }

        /* Bento Grid */
        .bento-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: auto auto;
          gap: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .bento-card {
          position: relative;
          padding: 40px;
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 24px;
          overflow: hidden;
          transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        .bento-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 50% 0%, rgba(255, 107, 53, 0.08), transparent 70%);
          opacity: 0;
          transition: opacity 400ms;
        }

        .bento-card:hover {
          border-color: rgba(255, 107, 53, 0.2);
          transform: translateY(-4px);
        }

        .bento-card:hover::before {
          opacity: 1;
        }

        .bento-card.featured {
          grid-column: span 2;
          background: linear-gradient(145deg, rgba(255, 107, 53, 0.06), rgba(0, 226, 138, 0.03));
        }

        .bento-card.tall {
          grid-row: span 2;
        }

        .bento-icon {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(0, 226, 138, 0.1));
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          margin-bottom: 28px;
          color: var(--accent-orange);
        }

        .bento-number {
          font-size: 48px;
          font-weight: 800;
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 20px;
        }

        .bento-title {
          font-size: 22px;
          font-weight: 600;
          margin: 0 0 14px;
          letter-spacing: -0.3px;
        }

        .bento-description {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.7;
          margin: 0;
        }

        .bento-visual {
          margin-top: 32px;
          padding: 24px;
          background: rgba(0, 0, 0, 0.4);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .bento-chart {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          height: 80px;
        }

        .bento-bar {
          flex: 1;
          background: linear-gradient(180deg, var(--accent-orange), var(--accent-green));
          border-radius: 4px;
          opacity: 0.7;
        }

        /* How It Works */
        .process-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 40px;
          max-width: 1100px;
          margin: 0 auto;
          position: relative;
        }

        .process-grid::before {
          content: '';
          position: absolute;
          top: 48px;
          left: 15%;
          right: 15%;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
        }

        .process-step {
          text-align: center;
          position: relative;
        }

        .process-number {
          width: 96px;
          height: 96px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 32px;
          font-size: 36px;
          font-weight: 800;
          background: linear-gradient(145deg, rgba(255, 107, 53, 0.1), rgba(0, 226, 138, 0.05));
          border: 2px solid rgba(255, 107, 53, 0.2);
          border-radius: 24px;
          color: var(--accent-orange);
          position: relative;
          z-index: 1;
        }

        .process-title {
          font-size: 22px;
          font-weight: 600;
          margin: 0 0 14px;
        }

        .process-description {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.7;
          margin: 0;
          max-width: 280px;
          margin-inline: auto;
        }

        /* CTA Section */
        .cta-section {
          padding: 120px var(--gutter);
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        .cta-section::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 50% 100%, rgba(255, 107, 53, 0.15) 0%, transparent 60%),
                      radial-gradient(ellipse at 50% 0%, rgba(0, 226, 138, 0.08) 0%, transparent 50%);
        }

        .cta-content {
          position: relative;
          z-index: 1;
        }

        .cta-title {
          font-size: clamp(32px, 5vw, 52px);
          font-weight: 700;
          letter-spacing: -1px;
          margin: 0 0 20px;
        }

        .cta-description {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 40px;
        }

        /* Footer */
        .footer {
          padding: 60px var(--gutter) 40px;
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
          font-size: 20px;
          font-weight: 700;
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .footer-links {
          display: flex;
          gap: 36px;
        }

        .footer-link {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.4);
          text-decoration: none;
          transition: color 200ms;
        }

        .footer-link:hover {
          color: var(--accent-orange);
        }

        .footer-copy {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.3);
        }

        /* Animations */
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .motion-pending .hero-badge { opacity: 0; animation: fadeInUp 700ms ease-out 200ms forwards; }
        .motion-pending .hero-title { opacity: 0; animation: fadeInUp 800ms ease-out 400ms forwards; }
        .motion-pending .hero-description { opacity: 0; animation: fadeInUp 700ms ease-out 600ms forwards; }
        .motion-pending .hero-actions { opacity: 0; animation: fadeInUp 700ms ease-out 800ms forwards; }
        .motion-pending .stats-bar { opacity: 0; animation: fadeInUp 700ms ease-out 1000ms forwards; }

        /* Responsive */
        @media (max-width: 1024px) {
          .bento-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .bento-card.featured { grid-column: span 2; }
          .bento-card.tall { grid-row: span 1; }
        }

        @media (max-width: 768px) {
          .nav { display: none; }
          .menu-toggle { display: flex; }
          .bento-grid, .process-grid { grid-template-columns: 1fr; }
          .bento-card.featured { grid-column: span 1; }
          .process-grid::before { display: none; }
          .stats-bar { flex-direction: column; gap: 24px; }
          .footer-content { flex-direction: column; text-align: center; }
          .footer-links { flex-wrap: wrap; justify-content: center; }
        }
      `}</style>

      <div className={`landing-page ${motionPending ? "motion-pending" : ""}`}>
        {/* Header */}
        <header className="header">
          <Link href="/" className="brand">
            <svg className="brand-logo" viewBox="0 0 36 36" fill="none">
              <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF6B35" />
                  <stop offset="100%" stopColor="#00E28A" />
                </linearGradient>
              </defs>
              <circle cx="18" cy="18" r="18" fill="url(#logoGrad)" />
              <path d="M18 8L11 15L18 13L25 15L18 8Z" fill="#000" />
              <path d="M11 15L18 22V13L11 15Z" fill="#000" fillOpacity="0.4" />
              <path d="M25 15L18 13V22L25 15Z" fill="#000" fillOpacity="0.7" />
              <path d="M18 22L11 15L9 22L18 28L27 22L25 15L18 22Z" fill="#000" />
            </svg>
            <span className="brand-name">Basket</span>
          </Link>

          <nav className="nav">
            <a href="#" className="nav-link active">Home</a>
            <a href="#features" className="nav-link">Features</a>
            <a href="#how-it-works" className="nav-link">How It Works</a>
            <Link href="/docs" className="nav-link">Docs</Link>
          </nav>

          <Link href="/basket" className="glass-btn">
            <span>Launch App</span>
          </Link>

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

        {/* Hero */}
        <section className="hero" ref={heroRef}>
          <div className="hero-bg">
            <video className="hero-video" autoPlay muted loop playsInline preload="auto" aria-hidden="true">
              <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260808_064556_051587f1-74a1-4336-8c05-4dde3594ed05.mp4" type="video/mp4" />
            </video>
            <div
              className="hero-glow"
              style={{
                opacity: glowOpacity,
                background: `
                  radial-gradient(800px circle at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(255, 107, 53, 0.25), transparent 45%),
                  radial-gradient(600px circle at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(0, 226, 138, 0.15), transparent 40%)
                `,
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
              <span className="line gradient">Many Windows.</span>
              <span className="line dim">Not One Coin Flip.</span>
            </h1>

            <p className="hero-description">
              Basket turns your directional view into diversified DreamDEX positions —
              AI-constructed, risk-smoothed, and fully on-chain.
            </p>

            <div className="hero-actions">
              <Link href="/basket" className="hero-cta hero-cta-primary">
                Build a Basket
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3 9H15M15 9L10 4M15 9L10 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <a href="#how-it-works" className="hero-cta hero-cta-secondary">
                See How It Works
              </a>
            </div>

            <div className="stats-bar">
              <div className="stat">
                <span className="stat-value">$2.4M+</span>
                <span className="stat-label">Total Volume</span>
              </div>
              <div className="stat">
                <span className="stat-value">1,200+</span>
                <span className="stat-label">Baskets Created</span>
              </div>
              <div className="stat">
                <span className="stat-value">89%</span>
                <span className="stat-label">Win Rate</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="section section-dark" id="features">
          <div className="section-header">
            <span className="section-label">Features</span>
            <h2 className="section-title">Spread the Risk.<br />Keep the Upside.</h2>
            <p className="section-description">
              Every basket is AI-constructed, on-chain, and designed to reduce variance without sacrificing your thesis.
            </p>
          </div>

          <div className="bento-grid">
            <div className="bento-card featured">
              <div className="bento-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <h3 className="bento-title">AI-Constructed Portfolios</h3>
              <p className="bento-description">
                Our AI analyzes market liquidity, volatility, and correlation to build optimal position distributions.
                Every decision is explained — no black box.
              </p>
              <div className="bento-visual">
                <div className="bento-chart">
                  <div className="bento-bar" style={{ height: '40%' }} />
                  <div className="bento-bar" style={{ height: '70%' }} />
                  <div className="bento-bar" style={{ height: '55%' }} />
                  <div className="bento-bar" style={{ height: '85%' }} />
                  <div className="bento-bar" style={{ height: '60%' }} />
                  <div className="bento-bar" style={{ height: '75%' }} />
                </div>
              </div>
            </div>

            <div className="bento-card tall">
              <div className="bento-number">↓38%</div>
              <h3 className="bento-title">Variance Reduction</h3>
              <p className="bento-description">
                Spreading across multiple time windows reduces variance by up to 38% compared to all-in single bets.
                Same thesis, smoother outcomes.
              </p>
            </div>

            <div className="bento-card">
              <div className="bento-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3 className="bento-title">Fully On-Chain</h3>
              <p className="bento-description">
                Every position resolves permissionlessly on DreamDEX. Your keys, verifiable outcomes.
              </p>
            </div>

            <div className="bento-card">
              <div className="bento-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <h3 className="bento-title">Multiple Time Windows</h3>
              <p className="bento-description">
                From 5-minute scalps to 24-hour positions. Mix windows to match your conviction timeline.
              </p>
            </div>

            <div className="bento-card">
              <div className="bento-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <h3 className="bento-title">Instant Settlement</h3>
              <p className="bento-description">
                Markets resolve automatically. Redeem winning positions immediately — no counterparty risk.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="section" id="how-it-works">
          <div className="section-header">
            <span className="section-label">How It Works</span>
            <h2 className="section-title">From Thesis to Basket<br />in 3 Steps</h2>
            <p className="section-description">
              Tell us your view, set your parameters, and let AI construct your diversified position.
            </p>
          </div>

          <div className="process-grid">
            <div className="process-step">
              <div className="process-number">1</div>
              <h3 className="process-title">Configure</h3>
              <p className="process-description">
                Pick your asset, set windows count (2-5), max spend, and risk tolerance. Cross-asset baskets available.
              </p>
            </div>

            <div className="process-step">
              <div className="process-number">2</div>
              <h3 className="process-title">Review</h3>
              <p className="process-description">
                AI constructs your basket with full reasoning, risk metrics, and liquidity analysis. Modify or approve.
              </p>
            </div>

            <div className="process-step">
              <div className="process-number">3</div>
              <h3 className="process-title">Execute</h3>
              <p className="process-description">
                Sign transactions to place orders. Track positions in real-time. Redeem winners automatically.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta-section">
          <div className="cta-content">
            <h2 className="cta-title">Ready to Build Smarter?</h2>
            <p className="cta-description">Join traders using AI to diversify their prediction market positions.</p>
            <Link href="/basket" className="hero-cta hero-cta-primary">
              Launch App
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 9H15M15 9L10 4M15 9L10 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="footer">
          <div className="footer-content">
            <div className="footer-brand">
              <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
                <defs>
                  <linearGradient id="footerLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FF6B35" />
                    <stop offset="100%" stopColor="#00E28A" />
                  </linearGradient>
                </defs>
                <circle cx="18" cy="18" r="18" fill="url(#footerLogoGrad)" />
                <path d="M18 8L11 15L18 13L25 15L18 8Z" fill="#000" />
                <path d="M11 15L18 22V13L11 15Z" fill="#000" fillOpacity="0.4" />
                <path d="M25 15L18 13V22L25 15Z" fill="#000" fillOpacity="0.7" />
                <path d="M18 22L11 15L9 22L18 28L27 22L25 15L18 22Z" fill="#000" />
              </svg>
              <span className="footer-brand-name">Basket</span>
            </div>

            <div className="footer-links">
              <Link href="/docs" className="footer-link">Documentation</Link>
              <a href="#" className="footer-link">GitHub</a>
              <a href="#" className="footer-link">Twitter</a>
              <a href="#" className="footer-link">Discord</a>
            </div>

            <p className="footer-copy">© 2026 Basket. Built on Somnia.</p>
          </div>
        </footer>
      </div>
    </>
  );
}
