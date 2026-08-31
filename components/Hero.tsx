"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

export default function Hero() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [motionPending, setMotionPending] = useState(true);
  const demoCardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setMotionPending(false);
      return;
    }

    // Fallback timeout to remove motion-pending
    const timeout = setTimeout(() => setMotionPending(false), 3500);

    const handleAnimationEnd = () => {
      setMotionPending(false);
      clearTimeout(timeout);
    };

    const card = demoCardRef.current;
    if (card) {
      card.addEventListener("animationend", handleAnimationEnd, { once: true });
    }

    return () => {
      clearTimeout(timeout);
      if (card) {
        card.removeEventListener("animationend", handleAnimationEnd);
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
          --gutter-start: clamp(36px, 4.177vw, 96px);
          --gutter-end: clamp(36px, 4.04vw, 96px);
          --header-top: clamp(20px, 2.264vh, 30px);
          --hero-bottom: clamp(34px, 5.19vh, 64px);
          --display-size: clamp(58px, 7.64vh, 88px);
          --display-leading: clamp(72px, 9.34vh, 106px);
          --copy-size: clamp(14px, 1.70vh, 19px);
          --copy-leading: clamp(19px, 2.17vh, 24px);
          --title-copy-gap: clamp(15px, 2.08vh, 24px);
          --copy-cta-gap: clamp(24px, 3.11vh, 36px);
          --cta-width: clamp(142px, 15.09vh, 168px);
          --cta-height: clamp(38px, 3.96vh, 44px);
          --card-width: clamp(150px, 18.96vh, 215px);
          --mobile-gutter: clamp(20px, 5vw, 36px);
        }

        .viewport {
          position: fixed;
          inset: 0;
          isolation: isolate;
          background: #000;
          overflow: hidden;
        }

        .screen {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 100%;
          height: 100%;
          background: #000;
        }

        .screen::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: -2;
          background:
            linear-gradient(180deg, rgba(0,0,0,.03), transparent 24%, transparent 82%, rgba(0,0,0,.05)),
            radial-gradient(ellipse at 44% 54%, transparent 30%, rgba(0,0,0,.055) 100%);
          pointer-events: none;
        }

        .background-video {
          position: absolute;
          inset: 0;
          z-index: -3;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          pointer-events: none;
          user-select: none;
        }

        .header {
          position: absolute;
          inset: var(--header-top) var(--gutter-end) auto var(--gutter-start);
          height: 48px;
          display: flex;
          align-items: flex-start;
          white-space: nowrap;
          z-index: 100;
        }

        .brand {
          position: relative;
          top: 10px;
          width: 25px;
          height: 25px;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,.3));
        }

        .nav {
          display: flex;
          gap: clamp(32px, 2.9vw, 43px);
          margin-left: clamp(36px, 3.03vw, 48px);
          position: relative;
          top: 9px;
        }

        .nav-link {
          font-size: 16px;
          font-weight: 430;
          letter-spacing: -0.36px;
          color: rgba(229,229,230,.77);
          text-shadow: 0 1px 3px rgba(0,0,0,.55);
          text-decoration: none;
          position: relative;
          transition: filter 140ms, opacity 140ms;
        }

        .nav-link:first-child {
          top: -3px;
        }

        .nav-link:nth-child(4) {
          margin-left: 1px;
        }

        .nav-link:hover {
          filter: brightness(1.08);
        }

        .nav-link.active {
          color: #fff;
        }

        .nav-link.active::after {
          content: '';
          position: absolute;
          bottom: -6px;
          left: 0;
          width: 44px;
          height: 2px;
          background: rgba(255,255,255,.82);
        }

        .time-panel {
          margin-left: auto;
          width: 211px;
          height: 48px;
          padding-left: 8px;
          border-left: 2px solid rgba(230,230,230,.52);
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .time-label {
          font-size: 15px;
          font-weight: 420;
          color: rgba(240,240,240,.77);
        }

        .time-value {
          font-size: 15px;
          font-weight: 440;
          color: rgba(255,255,255,.93);
        }

        .sign-up-btn {
          width: 109px;
          height: 42px;
          border-radius: 7px;
          background: #fff;
          color: #101010;
          font-weight: 460;
          letter-spacing: -0.34px;
          border: none;
          cursor: pointer;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.72), 0 1px 5px rgba(0,0,0,.34);
          margin-left: clamp(20px, 1.95vw, 29px);
          transition: filter 140ms;
        }

        .sign-up-btn:hover {
          filter: brightness(1.08);
        }

        .menu-toggle {
          display: none;
          width: 46px;
          height: 46px;
          border-radius: 11px;
          border: 1px solid rgba(255,255,255,.13);
          background: linear-gradient(145deg, rgba(24,22,20,.80), rgba(5,12,14,.86));
          backdrop-filter: blur(14px) saturate(108%);
          cursor: pointer;
          align-items: center;
          justify-content: center;
          margin-left: auto;
        }

        .hero {
          position: absolute;
          inset: 0;
        }

        .hero-content {
          position: absolute;
          left: var(--gutter-start);
          bottom: var(--hero-bottom);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .hero-title {
          font-family: Inter, Arial, sans-serif;
          font-size: var(--display-size);
          font-weight: 500;
          line-height: var(--display-leading);
          font-optical-sizing: auto;
          letter-spacing: -2.1px;
          -webkit-text-stroke: .12px currentColor;
          text-shadow: 0 2px 2px rgba(0,0,0,.44);
          margin: 0;
        }

        .line {
          display: block;
          overflow: hidden;
          transform-origin: left center;
        }

        .line-one {
          transform: scaleX(.775);
        }

        .line-one .line-reveal {
          color: #fff;
        }

        .line-two {
          transform: scaleX(.793);
        }

        .line-two .line-reveal {
          color: rgba(211, 207, 207, .78);
        }

        .line-reveal {
          display: block;
          white-space: nowrap;
        }

        .hero-copy {
          margin-top: var(--title-copy-gap);
          font-size: var(--copy-size);
          line-height: var(--copy-leading);
          font-weight: 350;
          letter-spacing: .13px;
          color: rgba(226, 229, 228, .84);
          text-shadow: 0 1px 3px rgba(0,0,0,.7);
          width: clamp(390px, 31.67vw, 500px);
          position: relative;
          left: 1px;
        }

        .primary-cta {
          position: relative;
          margin-top: var(--copy-cta-gap);
          width: var(--cta-width);
          height: var(--cta-height);
          border-radius: 7px;
          background: #fff;
          color: #111;
          border: none;
          cursor: pointer;
          box-shadow: 0 1px 5px rgba(0,0,0,.38);
          transition: filter 140ms;
        }

        .primary-cta:hover {
          filter: brightness(1.08);
        }

        .primary-cta .label {
          position: absolute;
          left: 8.125%;
          top: 50%;
          transform: translateY(-50%);
          font-weight: 450;
          letter-spacing: -0.3px;
        }

        .primary-cta .arrow-box {
          position: absolute;
          right: 3.125%;
          top: 14.286%;
          width: 20.625%;
          height: 71.429%;
          border-radius: 7px;
          background: #070909;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .demo-card {
          position: absolute;
          right: var(--gutter-end);
          bottom: var(--hero-bottom);
          width: var(--card-width);
          aspect-ratio: 201 / 265;
          container-type: inline-size;
          border: 1px solid rgba(255,255,255,.13);
          border-radius: clamp(12px, 1.52vh, 18px);
          background: linear-gradient(145deg, rgba(24,22,20,.80), rgba(5,12,14,.86));
          box-shadow:
            0 2px 10px rgba(0,0,0,.44),
            0 0 0 3px rgba(255,255,255,.035) inset,
            0 0 0 1px rgba(0,0,0,.9);
          backdrop-filter: blur(14px) saturate(108%);
          overflow: hidden;
        }

        .demo-visual {
          position: absolute;
          left: 3.5cqw;
          top: 4cqw;
          width: 92.5cqw;
          height: 92cqw;
          border-radius: 4cqw;
          background: #101a1e;
          overflow: hidden;
        }

        .demo-visual img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: brightness(.89) saturate(.93) contrast(1.03);
        }

        .play-btn {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 29cqw;
          height: 29cqw;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,.34);
          background: rgba(3,5,7,.47);
          backdrop-filter: blur(4px);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: filter 140ms;
        }

        .play-btn:hover {
          filter: brightness(1.08);
        }

        .watch-button {
          position: absolute;
          left: 3.5cqw;
          bottom: 4cqw;
          width: 92.5cqw;
          height: 16cqw;
          border-radius: 3cqw;
          border: 1px solid rgba(255,255,255,.21);
          background: linear-gradient(145deg, rgba(26,34,36,.86), rgba(16,29,33,.9));
          backdrop-filter: blur(14px);
          color: #fff;
          font-weight: 430;
          font-size: 4.5cqw;
          cursor: pointer;
          transition: filter 140ms;
        }

        .watch-button:hover {
          filter: brightness(1.08);
        }

        /* Entrance animations */
        @keyframes entrance-brand {
          from {
            opacity: 0;
            transform: translateY(7px) scale(.94);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes entrance-nav {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes entrance-action {
          from {
            opacity: 0;
            transform: translateY(8px) scale(.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes entrance-line {
          from {
            transform: translate3d(0, 110%, 0) skewY(2deg);
          }
          to {
            transform: translate3d(0, 0, 0) skewY(0);
          }
        }

        @keyframes entrance-copy {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes entrance-card {
          from {
            opacity: 0;
            transform: translateY(12px) scale(.968);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .motion-pending .brand {
          opacity: 0;
          animation: entrance-brand 580ms cubic-bezier(.16,1,.3,1) 60ms forwards;
        }

        .motion-pending .nav-link:nth-child(1) {
          opacity: 0;
          animation: entrance-nav 480ms cubic-bezier(.16,1,.3,1) 130ms forwards;
        }
        .motion-pending .nav-link:nth-child(2) {
          opacity: 0;
          animation: entrance-nav 480ms cubic-bezier(.16,1,.3,1) 175ms forwards;
        }
        .motion-pending .nav-link:nth-child(3) {
          opacity: 0;
          animation: entrance-nav 480ms cubic-bezier(.16,1,.3,1) 220ms forwards;
        }
        .motion-pending .nav-link:nth-child(4) {
          opacity: 0;
          animation: entrance-nav 480ms cubic-bezier(.16,1,.3,1) 265ms forwards;
        }

        .motion-pending .time-panel {
          opacity: 0;
          animation: entrance-nav 520ms cubic-bezier(.16,1,.3,1) 180ms forwards;
        }

        .motion-pending .sign-up-btn {
          opacity: 0;
          animation: entrance-action 520ms cubic-bezier(.16,1,.3,1) 220ms forwards;
        }

        .motion-pending .line-one .line-reveal {
          transform: translate3d(0, 110%, 0) skewY(2deg);
          animation: entrance-line 800ms cubic-bezier(.22,1,.36,1) 300ms forwards;
        }

        .motion-pending .line-two .line-reveal {
          transform: translate3d(0, 110%, 0) skewY(2deg);
          animation: entrance-line 850ms cubic-bezier(.22,1,.36,1) 440ms forwards;
        }

        .motion-pending .hero-copy {
          opacity: 0;
          animation: entrance-copy 620ms cubic-bezier(.16,1,.3,1) 740ms forwards;
        }

        .motion-pending .primary-cta {
          opacity: 0;
          animation: entrance-action 560ms cubic-bezier(.16,1,.3,1) 960ms forwards;
        }

        .motion-pending .demo-card {
          opacity: 0;
          transform-origin: 82% 50%;
          animation: entrance-card 920ms cubic-bezier(.22,1,.36,1) 1040ms forwards;
        }

        /* Focus styles */
        button:focus-visible,
        a:focus-visible {
          outline: 2px solid #fff;
          outline-offset: 3px;
        }

        /* Tablet */
        @media (min-width: 620px) and (max-width: 790px),
               (min-width: 620px) and (max-width: 1100px) and (orientation: portrait) {
          .nav, .time-panel, .sign-up-btn {
            display: none;
          }

          .menu-toggle {
            display: flex;
          }

          .header-actions {
            position: absolute;
            top: 56px;
            right: 0;
            width: min(324px, calc(100vw - 2 * var(--gutter-end)));
            padding: 20px;
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,.13);
            background: linear-gradient(145deg, rgba(24,22,20,.85), rgba(5,12,14,.9));
            backdrop-filter: blur(18px) saturate(110%);
            opacity: 0;
            visibility: hidden;
            transform: translateY(-8px) scale(.985);
            transition: opacity 200ms, visibility 200ms, transform 200ms;
          }

          .header.menu-open .header-actions {
            opacity: 1;
            visibility: visible;
            transform: translateY(0) scale(1);
          }

          .header.menu-open .nav,
          .header.menu-open .time-panel,
          .header.menu-open .sign-up-btn {
            display: flex;
          }

          .header.menu-open .nav {
            flex-direction: column;
            gap: 16px;
            margin: 0 0 20px 0;
          }

          .header.menu-open .nav-link {
            top: 0;
          }

          .header.menu-open .time-panel {
            border-left: none;
            border-top: 1px solid rgba(255,255,255,.1);
            padding: 16px 0 0 0;
            width: 100%;
            margin-bottom: 16px;
          }

          .header.menu-open .sign-up-btn {
            width: 100%;
            margin-left: 0;
          }
        }

        /* Mobile */
        @media (max-width: 619px) {
          :root {
            --gutter-start: var(--mobile-gutter);
            --gutter-end: var(--mobile-gutter);
          }

          .nav, .time-panel, .sign-up-btn {
            display: none;
          }

          .menu-toggle {
            display: flex;
          }

          .header-actions {
            position: absolute;
            top: 56px;
            right: 0;
            width: min(340px, calc(100vw - 2 * var(--gutter-end)));
            padding: 20px;
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,.13);
            background: linear-gradient(145deg, rgba(24,22,20,.85), rgba(5,12,14,.9));
            backdrop-filter: blur(18px) saturate(110%);
            opacity: 0;
            visibility: hidden;
            transform: translateY(-8px) scale(.985);
            transition: opacity 200ms, visibility 200ms, transform 200ms;
          }

          .header.menu-open .header-actions {
            opacity: 1;
            visibility: visible;
            transform: translateY(0) scale(1);
          }

          .header.menu-open .nav,
          .header.menu-open .time-panel,
          .header.menu-open .sign-up-btn {
            display: flex;
          }

          .header.menu-open .nav {
            flex-direction: column;
            gap: 16px;
            margin: 0 0 20px 0;
          }

          .header.menu-open .nav-link {
            top: 0;
          }

          .header.menu-open .time-panel {
            border-left: none;
            border-top: 1px solid rgba(255,255,255,.1);
            padding: 16px 0 0 0;
            width: 100%;
            margin-bottom: 16px;
          }

          .header.menu-open .sign-up-btn {
            width: 100%;
            margin-left: 0;
          }

          .line-one {
            transform: scaleX(.78);
          }

          .line-two {
            transform: scaleX(.55);
          }

          .hero-copy br {
            display: none;
          }

          .hero-copy {
            width: 100%;
            max-width: 340px;
          }

          .demo-card {
            top: clamp(176px, 32svh, 300px);
            bottom: auto;
            right: var(--gutter-end);
          }
        }
      `}</style>

      <main className={`viewport ${motionPending ? "motion-pending" : ""}`}>
        <section className="screen" id="screen">
          {/* Background Video */}
          <video
            className="background-video"
            autoPlay
            muted
            loop
            playsInline
            disablePictureInPicture
            aria-hidden="true"
          >
            <source
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260808_064556_051587f1-74a1-4336-8c05-4dde3594ed05.mp4"
              type="video/mp4"
            />
          </video>

          {/* Header */}
          <header className={`header ${menuOpen ? "menu-open" : ""}`}>
            {/* Brand Logo */}
            <Link href="/" className="brand" aria-label="Basket home">
              <svg viewBox="0 0 25 25" fill="none">
                <circle cx="12.5" cy="12.5" r="12.5" fill="#ededed" />
                <path d="M12.5 4L8 10L12.5 8L17 10L12.5 4Z" fill="#050606" />
                <path d="M8 10L12.5 14L12.5 8L8 10Z" fill="#737778" />
                <path d="M17 10L12.5 8L12.5 14L17 10Z" fill="#fafafa" />
                <path d="M12.5 14L8 10L6 16L12.5 21L19 16L17 10L12.5 14Z" fill="#0a0b0b" />
              </svg>
            </Link>

            {/* Header Actions (collapsible on mobile) */}
            <div className="header-actions" id="tablet-navigation">
              <nav className="nav">
                <a href="#" className="nav-link active">Home</a>
                <a href="#about" className="nav-link">About</a>
                <a href="#services" className="nav-link">Services</a>
                <a href="#contact" className="nav-link">Contact</a>
              </nav>

              <div className="time-panel">
                <span className="time-label">Timezone</span>
                <span className="time-value">9:47 PM&nbsp; • &nbsp;14 July 2026</span>
              </div>

              <Link href="/basket">
                <button className="sign-up-btn">Sign Up</button>
              </Link>
            </div>

            {/* Menu Toggle (mobile/tablet) */}
            <button
              className="menu-toggle"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
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
          <section className="hero">
            <div className="hero-content">
              <h1 className="hero-title">
                <span className="line line-one">
                  <span className="line-reveal">One Call,</span>
                </span>
                <span className="line line-two">
                  <span className="line-reveal">Many Windows.</span>
                </span>
              </h1>

              <p className="hero-copy">
                Your bets are scattered across single outcomes.<br />
                Basket bring them into one diversified signal, so every<br />
                decision is backed by risk you actually understand.
              </p>

              <Link href="/basket">
                <button className="primary-cta">
                  <span className="label">Get Started</span>
                  <span className="arrow-box">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M1 7H13M13 7L7 1M13 7L7 13"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>
              </Link>
            </div>

            {/* Demo Card */}
            <article className="demo-card" ref={demoCardRef}>
              <div className="demo-visual">
                <img
                  src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='g1' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23ff4444'/%3E%3Cstop offset='50%25' stop-color='%23440066'/%3E%3Cstop offset='100%25' stop-color='%234444ff'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='%23101a1e' width='200' height='200'/%3E%3Ccircle cx='60' cy='80' r='60' fill='url(%23g1)' opacity='0.7'/%3E%3Ccircle cx='140' cy='120' r='50' fill='%234444ff' opacity='0.5'/%3E%3Ccircle cx='100' cy='100' r='40' fill='%23ff4444' opacity='0.4'/%3E%3C/svg%3E"
                  alt="Abstract visualization"
                />
                <button className="play-btn" aria-label="Play demo">
                  <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
                    <path d="M0 0L12 7L0 14V0Z" fill="white" />
                  </svg>
                </button>
              </div>
              <button className="watch-button">Watch Demo</button>
            </article>
          </section>
        </section>
      </main>
    </>
  );
}
