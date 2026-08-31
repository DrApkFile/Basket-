"use client";

import Link from "next/link";
import { useState } from "react";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "getting-started", label: "Getting Started" },
  { id: "architecture", label: "Architecture" },
  { id: "sdk", label: "DreamDEX SDK" },
  { id: "api", label: "API Reference" },
  { id: "contracts", label: "Smart Contracts" },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');

        :root {
          --accent-green: #00E28A;
          --accent-orange: #FF6B35;
          --accent-gradient: linear-gradient(135deg, var(--accent-orange), var(--accent-green));
        }

        .docs-page {
          min-height: 100vh;
          background: #000;
          color: #fff;
          font-family: Inter, -apple-system, sans-serif;
        }

        .docs-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          z-index: 100;
        }

        .docs-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
        }

        .docs-brand-name {
          font-size: 18px;
          font-weight: 700;
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .docs-badge {
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
          background: rgba(255, 255, 255, 0.06);
          border-radius: 4px;
          margin-left: 8px;
        }

        .docs-layout {
          display: flex;
          padding-top: 64px;
        }

        .docs-sidebar {
          position: fixed;
          top: 64px;
          left: 0;
          width: 260px;
          height: calc(100vh - 64px);
          padding: 32px 24px;
          border-right: 1px solid rgba(255, 255, 255, 0.06);
          overflow-y: auto;
        }

        .docs-nav-section {
          margin-bottom: 32px;
        }

        .docs-nav-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.4);
          margin-bottom: 16px;
        }

        .docs-nav-link {
          display: block;
          padding: 10px 14px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          text-decoration: none;
          border-radius: 8px;
          margin-bottom: 4px;
          transition: all 200ms;
        }

        .docs-nav-link:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.04);
        }

        .docs-nav-link.active {
          color: #fff;
          background: linear-gradient(135deg, rgba(255, 107, 53, 0.1), rgba(0, 226, 138, 0.05));
          border-left: 2px solid var(--accent-orange);
        }

        .docs-content {
          flex: 1;
          margin-left: 260px;
          padding: 48px 64px;
          max-width: 900px;
        }

        .docs-section {
          margin-bottom: 80px;
        }

        .docs-h1 {
          font-size: 40px;
          font-weight: 700;
          letter-spacing: -1px;
          margin: 0 0 16px;
        }

        .docs-h2 {
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.5px;
          margin: 48px 0 20px;
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .docs-h3 {
          font-size: 20px;
          font-weight: 600;
          margin: 32px 0 16px;
        }

        .docs-p {
          font-size: 16px;
          line-height: 1.8;
          color: rgba(255, 255, 255, 0.7);
          margin: 0 0 20px;
        }

        .docs-lead {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 40px;
        }

        .docs-code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          padding: 2px 8px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 4px;
          color: var(--accent-orange);
        }

        .docs-codeblock {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          line-height: 1.7;
          padding: 24px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow-x: auto;
          margin: 24px 0;
        }

        .docs-codeblock-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px 12px 0 0;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        .docs-codeblock-content {
          padding: 20px 24px;
          margin: 0;
          white-space: pre;
          color: rgba(255, 255, 255, 0.85);
        }

        .docs-table {
          width: 100%;
          border-collapse: collapse;
          margin: 24px 0;
          font-size: 14px;
        }

        .docs-table th {
          text-align: left;
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
        }

        .docs-table td {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          color: rgba(255, 255, 255, 0.6);
        }

        .docs-table code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          color: var(--accent-green);
        }

        .docs-card {
          padding: 24px;
          background: linear-gradient(145deg, rgba(255, 107, 53, 0.04), rgba(0, 226, 138, 0.02));
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          margin: 24px 0;
        }

        .docs-card-title {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 8px;
          color: var(--accent-orange);
        }

        .docs-card-content {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.6;
          margin: 0;
        }

        .docs-list {
          margin: 20px 0;
          padding-left: 24px;
        }

        .docs-list li {
          font-size: 15px;
          line-height: 1.8;
          color: rgba(255, 255, 255, 0.65);
          margin-bottom: 8px;
        }

        .glass-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 500;
          color: #fff;
          background: linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(0, 226, 138, 0.1));
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          text-decoration: none;
          backdrop-filter: blur(10px);
          transition: all 200ms;
        }

        .glass-btn:hover {
          background: linear-gradient(135deg, rgba(255, 107, 53, 0.25), rgba(0, 226, 138, 0.15));
          transform: translateY(-1px);
        }

        @media (max-width: 900px) {
          .docs-sidebar { display: none; }
          .docs-content { margin-left: 0; padding: 32px 24px; }
        }
      `}</style>

      <div className="docs-page">
        <header className="docs-header">
          <Link href="/" className="docs-brand">
            <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
              <defs>
                <linearGradient id="docLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF6B35" />
                  <stop offset="100%" stopColor="#00E28A" />
                </linearGradient>
              </defs>
              <circle cx="18" cy="18" r="18" fill="url(#docLogoGrad)" />
              <path d="M18 8L11 15L18 13L25 15L18 8Z" fill="#000" />
              <path d="M11 15L18 22V13L11 15Z" fill="#000" fillOpacity="0.4" />
              <path d="M25 15L18 13V22L25 15Z" fill="#000" fillOpacity="0.7" />
              <path d="M18 22L11 15L9 22L18 28L27 22L25 15L18 22Z" fill="#000" />
            </svg>
            <span className="docs-brand-name">Basket</span>
            <span className="docs-badge">Docs</span>
          </Link>

          <Link href="/basket" className="glass-btn">
            Launch App →
          </Link>
        </header>

        <div className="docs-layout">
          <aside className="docs-sidebar">
            <nav className="docs-nav-section">
              <div className="docs-nav-title">Getting Started</div>
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`docs-nav-link ${activeSection === s.id ? "active" : ""}`}
                  onClick={() => setActiveSection(s.id)}
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </aside>

          <main className="docs-content">
            <section className="docs-section" id="overview">
              <h1 className="docs-h1">Basket Documentation</h1>
              <p className="docs-lead">
                Build AI-constructed, risk-smoothed prediction market baskets on DreamDEX.
              </p>

              <div className="docs-card">
                <h4 className="docs-card-title">What is Basket?</h4>
                <p className="docs-card-content">
                  Basket transforms single directional views into diversified positions across multiple time windows.
                  Instead of making one all-or-nothing bet, spread your thesis across correlated DreamDEX Event Contracts
                  with AI-powered construction and transparent reasoning.
                </p>
              </div>

              <h3 className="docs-h3">Key Features</h3>
              <ul className="docs-list">
                <li><strong>AI Construction</strong> — Markets selected based on liquidity, volatility, and correlation analysis</li>
                <li><strong>Risk Smoothing</strong> — Variance reduction of up to 38% vs single-position bets</li>
                <li><strong>Full Transparency</strong> — Every decision explained with data-backed reasoning</li>
                <li><strong>On-Chain Settlement</strong> — Permissionless resolution via DreamDEX contracts</li>
                <li><strong>Cross-Asset Support</strong> — Combine BTC and ETH markets in single baskets</li>
              </ul>
            </section>

            <section className="docs-section" id="getting-started">
              <h2 className="docs-h2">Getting Started</h2>
              <p className="docs-p">
                To start using Basket, you need a Web3 wallet connected to the Somnia Shannon testnet.
              </p>

              <h3 className="docs-h3">1. Connect Wallet</h3>
              <p className="docs-p">
                Click "Launch App" and connect using RainbowKit. Supported wallets include MetaMask, Coinbase Wallet, and WalletConnect.
              </p>

              <h3 className="docs-h3">2. Switch to Somnia Shannon</h3>
              <p className="docs-p">
                The app will prompt you to switch networks if needed. Somnia Shannon testnet details:
              </p>

              <table className="docs-table">
                <tbody>
                  <tr><td>Network Name</td><td>Somnia Shannon Testnet</td></tr>
                  <tr><td>Chain ID</td><td><code>50312</code></td></tr>
                  <tr><td>Currency</td><td>STT (testnet)</td></tr>
                  <tr><td>Collateral</td><td>tUSDC at <code>0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E</code></td></tr>
                </tbody>
              </table>

              <h3 className="docs-h3">3. Create Your First Basket</h3>
              <p className="docs-p">
                Select an asset (BTC/ETH), number of windows (2-5), max spend, and risk tolerance. The AI will construct
                a proposal with full reasoning for your review.
              </p>
            </section>

            <section className="docs-section" id="architecture">
              <h2 className="docs-h2">Architecture</h2>
              <p className="docs-p">
                Basket is a Next.js application integrating with the DreamDEX SDK for on-chain market operations,
                Firebase Firestore for basket tracking, and Google Gemini for AI reasoning.
              </p>

              <h3 className="docs-h3">Tech Stack</h3>
              <ul className="docs-list">
                <li><strong>Frontend</strong> — Next.js 16, React 19, Tailwind CSS</li>
                <li><strong>Blockchain</strong> — Somnia Shannon testnet, DreamDEX Event Contracts</li>
                <li><strong>Wallet</strong> — Wagmi + RainbowKit</li>
                <li><strong>Database</strong> — Firebase Firestore (UI cache only)</li>
                <li><strong>AI</strong> — Google Gemini for market analysis and reasoning</li>
              </ul>

              <h3 className="docs-h3">Security Model</h3>
              <div className="docs-card">
                <h4 className="docs-card-title">Firestore as Cache Only</h4>
                <p className="docs-card-content">
                  Firestore is a UI cache synced FROM on-chain reads — never the reverse. All writes happen only after
                  server has verified on-chain status via getMarketOnchain(). The client NEVER writes basket/leg status
                  directly.
                </p>
              </div>
            </section>

            <section className="docs-section" id="sdk">
              <h2 className="docs-h2">DreamDEX SDK</h2>
              <p className="docs-p">
                Basket uses <code className="docs-code">@somnia-chain/markets-sdk</code> for all on-chain operations.
              </p>

              <h3 className="docs-h3">Installation</h3>
              <div className="docs-codeblock">
                <div className="docs-codeblock-header">
                  <span>Terminal</span>
                </div>
                <pre className="docs-codeblock-content">{`npm install @somnia-chain/markets-sdk`}</pre>
              </div>

              <h3 className="docs-h3">Basic Usage</h3>
              <div className="docs-codeblock">
                <div className="docs-codeblock-header">
                  <span>TypeScript</span>
                </div>
                <pre className="docs-codeblock-content">{`import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

const exchange = new SomniaMarkets({
  indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
  chain: somniaShannon,
  addresses: SOMNIA_TESTNET_ADDRESSES,
});

// Load all markets
await exchange.loadMarkets();

// Get trading markets
const tradingMarkets = Object.values(exchange.markets)
  .filter(m => m.type === "binary" && m.active);

// Place an order (requires signer)
exchange.setSigner({ walletClient });
const order = await exchange.createOrder(symbol, "buy", quantity, price);`}</pre>
              </div>
            </section>

            <section className="docs-section" id="api">
              <h2 className="docs-h2">API Reference</h2>
              <p className="docs-p">
                Basket exposes several API endpoints for basket construction and management.
              </p>

              <h3 className="docs-h3">Endpoints</h3>
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Endpoint</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>POST</td>
                    <td><code>/api/basket/construct</code></td>
                    <td>AI constructs a basket proposal</td>
                  </tr>
                  <tr>
                    <td>POST</td>
                    <td><code>/api/basket/approve</code></td>
                    <td>Save basket after orders placed</td>
                  </tr>
                  <tr>
                    <td>GET</td>
                    <td><code>/api/basket/list</code></td>
                    <td>List user's baskets</td>
                  </tr>
                  <tr>
                    <td>POST</td>
                    <td><code>/api/basket/narrate</code></td>
                    <td>Get AI narration of basket status</td>
                  </tr>
                  <tr>
                    <td>POST</td>
                    <td><code>/api/basket/redeem</code></td>
                    <td>Get/record redeemable positions</td>
                  </tr>
                  <tr>
                    <td>GET</td>
                    <td><code>/api/markets</code></td>
                    <td>List available trading markets</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="docs-section" id="contracts">
              <h2 className="docs-h2">Smart Contracts</h2>
              <p className="docs-p">
                DreamDEX Event Contracts are binary prediction markets where outcomes resolve to 0 or 1.
              </p>

              <h3 className="docs-h3">Contract Addresses (Somnia Shannon)</h3>
              <table className="docs-table">
                <tbody>
                  <tr>
                    <td>tUSDC (Collateral)</td>
                    <td><code>0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E</code></td>
                  </tr>
                  <tr>
                    <td>Exchange Router</td>
                    <td><code>SOMNIA_TESTNET_ADDRESSES.router</code></td>
                  </tr>
                </tbody>
              </table>

              <h3 className="docs-h3">Market Lifecycle</h3>
              <ul className="docs-list">
                <li><strong>0 - Listed</strong> — Market created but not yet trading</li>
                <li><strong>1 - Trading</strong> — Active, orders can be placed</li>
                <li><strong>2 - Locked</strong> — Trading halted, awaiting resolution</li>
                <li><strong>3 - Settling</strong> — Resolution in progress</li>
                <li><strong>4 - Resolved</strong> — Outcome determined, redemption available</li>
                <li><strong>5 - Voided</strong> — Market cancelled, collateral returned</li>
              </ul>
            </section>
          </main>
        </div>
      </div>
    </>
  );
}
