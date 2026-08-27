"use client";

import { useEffect, useState, useRef } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { BinaryMarket, UnifiedMarket, UnifiedOrderBook } from "@somnia-chain/markets-sdk";
import { createExchange, bigintReplacer } from "@/lib/somnia";

const STATUS_LABELS = ["Listed", "Trading", "Locked", "Settling", "Resolved", "Voided"] as const;

function expiryOf(m: UnifiedMarket): number {
  return Number((m.info as BinaryMarket).expiry);
}

function intervalOf(m: UnifiedMarket): string {
  return (m.info as BinaryMarket).interval ?? "?";
}

function intervalSecOf(m: UnifiedMarket): number {
  const sec = (m.info as BinaryMarket).intervalSec;
  return sec ? Number(sec) : Infinity;
}

export default function DemoPage() {
  const [exchange] = useState(() => createExchange());
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [pool, setPool] = useState<UnifiedMarket[] | null>(null);
  const [selected, setSelected] = useState<UnifiedMarket | null>(null);

  const [book, setBook] = useState<UnifiedOrderBook | null>(null);
  const [bookLoading, setBookLoading] = useState(false);

  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetTx, setFaucetTx] = useState<string | null>(null);

  const [quantity, setQuantity] = useState(5);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderResult, setOrderResult] = useState<unknown>(null);

  const [onchainStatus, setOnchainStatus] = useState<number | null>(null);
  const [polling, setPolling] = useState(false);

  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemResult, setRedeemResult] = useState<unknown>(null);

  // Ref guard to prevent double-execution (state updates are async)
  const orderInFlight = useRef(false);

  function appendLog(msg: string) {
    setLog((l) => [...l, msg]);
  }

  function fail(e: unknown) {
    setError(e instanceof Error ? e.message : String(e));
  }

  // RainbowKit/wagmi own the connect + chain-switch UI; once a wallet client
  // is available we just bind it as the exchange's signer. Reads (market
  // discovery, order books) already worked without one — only writes (order
  // placement, faucet, redeem) need it.
  useEffect(() => {
    if (!walletClient) return;
    exchange.setSigner({ walletClient });
    appendLog("Wallet connected and bound as the exchange's signer.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient]);

  async function handleDiscover() {
    setLoadingMarkets(true);
    setError(null);
    try {
      await exchange.loadMarkets();
      const now = Math.floor(Date.now() / 1000);
      const FIVE_MINUTES = 5 * 60;
      // Filter out markets expiring within 5 minutes (they may already be Locked)
      const all = Object.values(exchange.markets).filter(
        (m) => m.type === "binary" && m.active && expiryOf(m) > now + FIVE_MINUTES
      );
      const btcOnly = all.filter((m) => m.base === "BTC");
      const candidates = btcOnly.length > 0 ? btcOnly : all;
      if (candidates.length === 0) {
        throw new Error("No live (Trading-status) binary markets found right now.");
      }
      // Sort by shortest interval first (5m before 1h), then by soonest expiry
      const sorted = [...candidates].sort((a, b) => {
        const intervalDiff = intervalSecOf(a) - intervalSecOf(b);
        if (intervalDiff !== 0) return intervalDiff;
        return expiryOf(a) - expiryOf(b);
      });
      const shortest = sorted[0] ?? null;
      setPool(sorted);
      setSelected(shortest);
      setBook(null);
      setOrderResult(null);
      setOnchainStatus(null);
      appendLog(
        shortest
          ? `Picked ${shortest.symbol} (${intervalOf(shortest)} window) — prioritizing short intervals for quick settlement.`
          : "No candidates found.",
      );
    } catch (e) {
      fail(e);
    } finally {
      setLoadingMarkets(false);
    }
  }

  async function handleFetchBook() {
    if (!selected) return;
    setBookLoading(true);
    setError(null);
    try {
      const ob = await exchange.fetchOrderBook(`${selected.symbol}#YES`, 5);
      setBook(ob);
    } catch (e) {
      fail(e);
    } finally {
      setBookLoading(false);
    }
  }

  async function handleFaucet() {
    setFaucetLoading(true);
    setError(null);
    try {
      const res = await exchange.trader.faucet({});
      setFaucetTx(res.hash);
      appendLog(
        "Minted testnet collateral via trader.faucet(). This is testnet TestUSDC — a different token from mainnet USDso, not just a decimals difference (6 vs 18).",
      );
    } catch (e) {
      fail(e);
    } finally {
      setFaucetLoading(false);
    }
  }

  async function handlePlaceOrder(side: "YES" | "NO") {
    if (!selected) return;
    if (!address) {
      setError("Connect a wallet before placing an order — writes need a signer.");
      return;
    }
    // Ref guard — prevents double-execution from rapid clicks or re-renders
    if (orderInFlight.current) return;
    orderInFlight.current = true;
    setOrderLoading(true);
    setError(null);
    try {
      // Pre-flight: verify market is still Trading on-chain
      const onchain = await exchange.client.getMarketOnchain(selected.id as `0x${string}`);
      if (onchain.status !== 1) {
        throw new Error(`Market is ${STATUS_LABELS[onchain.status] ?? onchain.status}, not Trading. Pick a different market.`);
      }

      const symbol = `${selected.symbol}#${side}`;
      // Always fetch YES book for price reference — NO price is just 1 - YES price
      const yesSymbol = `${selected.symbol}#YES`;
      const ob = book ?? (await exchange.fetchOrderBook(yesSymbol, 5));
      setBook(ob);
      const bestAsk = ob.asks[0]?.[0];
      const price = bestAsk ?? 0.5;
      appendLog(
        bestAsk
          ? `Pricing ${side} at ${side === "YES" ? price : 1 - price} (YES best ask is ${bestAsk}).`
          : `Book empty — pricing ${side} at 0.5. Order will rest until countered.`,
      );
      const result = await exchange.createOrder(symbol, "limit", "buy", quantity, price);
      setOrderResult(result);
      appendLog(
        `Placed BUY ${side} via exchange.createOrder. If you place both YES and NO at complementary prices, they mint-a-pair and fill each other — no counterparty needed.`,
      );
    } catch (e) {
      fail(e);
    } finally {
      orderInFlight.current = false;
      setOrderLoading(false);
    }
  }

  async function handleRedeem() {
    if (!selected) return;
    setRedeemLoading(true);
    setError(null);
    try {
      const bal = await exchange.fetchBalance();
      const yesSymbol = `${selected.symbol}#YES`;
      const noSymbol = `${selected.symbol}#NO`;
      const yesHeld = bal[yesSymbol]?.total ?? 0;
      const noHeld = bal[noSymbol]?.total ?? 0;

      if (yesHeld <= 0 && noHeld <= 0) {
        throw new Error(`No YES or NO balance to redeem — orders may not have filled.`);
      }

      const results: unknown[] = [];
      if (yesHeld > 0) {
        const r = await exchange.redeem(yesSymbol, yesHeld);
        results.push({ side: "YES", amount: yesHeld, result: r });
        appendLog(`Redeemed ${yesHeld} YES tokens.`);
      }
      if (noHeld > 0) {
        const r = await exchange.redeem(noSymbol, noHeld);
        results.push({ side: "NO", amount: noHeld, result: r });
        appendLog(`Redeemed ${noHeld} NO tokens.`);
      }

      setRedeemResult(results);
      appendLog(
        "Redeemed via exchange.redeem — it resolves the winning outcome index automatically. Redeeming the losing side succeeds but pays nothing.",
      );
    } catch (e) {
      fail(e);
    } finally {
      setRedeemLoading(false);
    }
  }

  // Poll on-chain status once an order is in, until the market settles.
  // Deliberately a direct chain read (getMarketOnchain), not the indexed
  // status on the market row — the indexer can lag by seconds right before a
  // write/redeem decision, per the SDK's own docs.
  useEffect(() => {
    if (!selected || !orderResult) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    setPolling(true);

    async function tick() {
      try {
        const onchain = await exchange.client.getMarketOnchain(selected!.id as `0x${string}`);
        if (cancelled) return;
        setOnchainStatus(onchain.status);
        if (onchain.status >= 4) {
          setPolling(false);
          appendLog(
            `Market moved to ${STATUS_LABELS[onchain.status] ?? onchain.status} on-chain (direct getMarketOnchain read).`,
          );
          return;
        }
      } catch {
        // keep trying — a transient RPC hiccup shouldn't kill the poll loop
      }
      if (!cancelled) timer = setTimeout(tick, 5000);
    }
    tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setPolling(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, orderResult]);

  const canRedeem = onchainStatus === 4 || onchainStatus === 5;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12 font-sans text-white">
      <h1 className="font-display text-2xl font-bold tracking-tight">Day 1 — Single-Position Lifecycle</h1>
      <p className="mt-2 text-sm text-white/60">
        Real Somnia Shannon testnet (chain 50312). No AI, no Firestore — this proves one clean
        connect → discover → order → settle → redeem cycle end to end.
      </p>

      {error && (
        <div className="mt-6 rounded-lg border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss">
          {error}
        </div>
      )}

      {/* Step 1 — wallet */}
      <section className="mt-8 rounded-xl border border-white/10 p-5">
        <h2 className="font-display text-sm font-bold tracking-wide text-white/80">1. CONNECT WALLET</h2>
        <div className="mt-3">
          <ConnectButton showBalance={false} />
        </div>
      </section>

      {/* Step 2 — discover */}
      <section className="mt-6 rounded-xl border border-white/10 p-5">
        <h2 className="font-display text-sm font-bold tracking-wide text-white/80">
          2. DISCOVER SHORTEST-EXPIRY LIVE MARKET
        </h2>
        <button
          onClick={handleDiscover}
          disabled={loadingMarkets}
          className="glass-pill mt-3 rounded-full px-5 py-2 text-xs font-semibold tracking-wide disabled:opacity-50"
        >
          {loadingMarkets ? "LOADING…" : "LOAD MARKETS"}
        </button>
        {selected && (
          <div className="mt-4 rounded-lg bg-white/5 px-4 py-3 text-sm">
            <div className="font-mono text-accent">{selected.symbol}</div>
            <div className="mt-1 text-xs text-white/60">
              <span className="text-accent">{intervalOf(selected)}</span> window · expiry {new Date(expiryOf(selected) * 1000).toLocaleString()} · id {selected.id}
            </div>
          </div>
        )}
        {pool && pool.length > 1 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-white/40">
              {pool.length} live candidates — click to see all
            </summary>
            <ul className="mt-2 max-h-40 overflow-auto text-xs text-white/50">
              {pool.map((m) => (
                <li
                  key={m.id}
                  onClick={() => { setSelected(m); setBook(null); setOrderResult(null); }}
                  className={`cursor-pointer rounded px-2 py-1 hover:bg-white/10 ${m.id === selected?.id ? "bg-white/10 text-accent" : ""}`}
                >
                  <span className="font-mono text-accent">[{intervalOf(m)}]</span> {m.symbol} — expires {new Date(expiryOf(m) * 1000).toLocaleTimeString()}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Step 3 — book */}
      {selected && (
        <section className="mt-6 rounded-xl border border-white/10 p-5">
          <h2 className="font-display text-sm font-bold tracking-wide text-white/80">3. ORDER BOOK (YES)</h2>
          <button
            onClick={handleFetchBook}
            disabled={bookLoading}
            className="glass-pill mt-3 rounded-full px-5 py-2 text-xs font-semibold tracking-wide disabled:opacity-50"
          >
            {bookLoading ? "FETCHING…" : "REFRESH BOOK"}
          </button>
          {book && (
            <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="mb-1 text-white/40">BIDS</div>
                {book.bids.length === 0 && <div className="text-white/30">empty</div>}
                {book.bids.map(([p, q], i) => (
                  <div key={i} className="flex justify-between font-mono text-accent">
                    <span>{p.toFixed(4)}</span>
                    <span>{q}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-1 text-white/40">ASKS</div>
                {book.asks.length === 0 && <div className="text-white/30">empty</div>}
                {book.asks.map(([p, q], i) => (
                  <div key={i} className="flex justify-between font-mono text-loss">
                    <span>{p.toFixed(4)}</span>
                    <span>{q}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Step 4 — faucet + order */}
      {selected && (
        <section className="mt-6 rounded-xl border border-white/10 p-5">
          <h2 className="font-display text-sm font-bold tracking-wide text-white/80">4. FUND &amp; PLACE ONE ORDER</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={handleFaucet}
              disabled={faucetLoading || !address}
              className="glass-pill rounded-full px-5 py-2 text-xs font-semibold tracking-wide disabled:opacity-50"
            >
              {faucetLoading ? "MINTING…" : "GET TESTNET USDC"}
            </button>
            {faucetTx && <span className="font-mono text-xs text-white/40">{faucetTx}</span>}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="text-xs text-white/60">
              Quantity
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="ml-2 w-20 rounded border border-white/15 bg-transparent px-2 py-1 font-mono text-xs text-white"
              />
            </label>
            <button
              onClick={() => handlePlaceOrder("YES")}
              disabled={orderLoading || !address}
              className="glass-pill rounded-full px-5 py-2 text-xs font-semibold tracking-wide disabled:opacity-50"
            >
              {orderLoading ? "PLACING…" : "BUY YES"}
            </button>
            <button
              onClick={() => handlePlaceOrder("NO")}
              disabled={orderLoading || !address}
              className="glass-pill rounded-full px-5 py-2 text-xs font-semibold tracking-wide disabled:opacity-50"
            >
              {orderLoading ? "PLACING…" : "BUY NO"}
            </button>
          </div>
          <p className="mt-2 text-xs text-white/40">
            Tip: Place both YES and NO at 0.5 to self-match via mint-a-pair (no counterparty needed).
          </p>
          {orderResult != null && (
            <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-white/5 p-3 text-[11px] text-white/70">
              {JSON.stringify(orderResult, bigintReplacer, 2)}
            </pre>
          )}
        </section>
      )}

      {/* Step 5 — status */}
      {orderResult != null && (
        <section className="mt-6 rounded-xl border border-white/10 p-5">
          <h2 className="font-display text-sm font-bold tracking-wide text-white/80">5. ON-CHAIN STATUS</h2>
          <p className="mt-3 text-sm">
            {onchainStatus === null ? (
              "watching…"
            ) : (
              <>
                <span className="font-mono text-accent">
                  {STATUS_LABELS[onchainStatus] ?? onchainStatus}
                </span>
                {polling && <span className="ml-2 text-xs text-white/40">(polling every 5s)</span>}
              </>
            )}
          </p>
        </section>
      )}

      {/* Step 6 — redeem */}
      {orderResult != null && (
        <section className="mt-6 rounded-xl border border-white/10 p-5">
          <h2 className="font-display text-sm font-bold tracking-wide text-white/80">6. REDEEM</h2>
          <button
            onClick={handleRedeem}
            disabled={redeemLoading || !canRedeem}
            className="glass-pill mt-3 rounded-full px-5 py-2 text-xs font-semibold tracking-wide disabled:opacity-50"
          >
            {redeemLoading ? "REDEEMING…" : canRedeem ? "REDEEM POSITION" : "WAITING FOR SETTLEMENT"}
          </button>
          {redeemResult != null && (
            <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-white/5 p-3 text-[11px] text-white/70">
              {JSON.stringify(redeemResult, bigintReplacer, 2)}
            </pre>
          )}
        </section>
      )}

      {/* Explanation log */}
      {log.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xs font-bold tracking-wide text-white/40">DECISION LOG</h2>
          <ul className="mt-3 space-y-3 text-xs leading-relaxed text-white/55">
            {log.map((l, i) => (
              <li key={i} className="border-l-2 border-accent/30 pl-3">
                {l}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
