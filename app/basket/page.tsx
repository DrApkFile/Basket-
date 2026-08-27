"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAccount, useWalletClient, useChainId, useSwitchChain } from "wagmi";
import { createExchange, somniaShannon } from "@/lib/somnia";
import { placeBatchOrders, verifyMarketsTrading } from "@/lib/batch-orders";
import type { BasketConstructInput, BasketProposal, BasketDoc } from "@/lib/firestore-types";
import type { BatchOrderResult } from "@/lib/batch-orders";
import DashboardTopBar from "@/components/DashboardTopBar";
import LiveMarketsSidebar from "@/components/LiveMarketsSidebar";
import MyBasketsPanel from "@/components/MyBasketsPanel";
import PositionCard from "@/components/PositionCard";

type Step = "form" | "loading" | "proposal" | "placing" | "done" | "error";

interface MarketsInfo {
  count: number;
  availableAssets: string[];
}

interface UserBasket extends BasketDoc {
  id: string;
  legCount: number;
  pendingCount: number;
  settledCount: number;
  redeemableCount: number;
}

const SOMNIA_SHANNON_CHAIN_ID = 50312;

export default function BasketPage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const isWrongNetwork = chainId !== SOMNIA_SHANNON_CHAIN_ID;

  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<BasketProposal | null>(null);
  const [basketId, setBasketId] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");
  const [marketsInfo, setMarketsInfo] = useState<MarketsInfo | null>(null);
  const [orderResults, setOrderResults] = useState<BatchOrderResult | null>(null);

  // User baskets state
  const [userBaskets, setUserBaskets] = useState<UserBasket[]>([]);
  const [basketsLoading, setBasketsLoading] = useState(false);

  // Form state
  const [asset, setAsset] = useState<string>("BTC");
  const [crossAsset, setCrossAsset] = useState(false);
  const [numWindows, setNumWindows] = useState(3);
  const [maxSpend, setMaxSpend] = useState(10);
  const [risk, setRisk] = useState<"low" | "medium" | "high">("medium");

  const exchangeRef = useRef(createExchange());

  // Fetch user baskets
  const fetchUserBaskets = useCallback(async () => {
    if (!address) return;
    setBasketsLoading(true);
    try {
      const res = await fetch(`/api/basket/list?userId=${address}`);
      if (res.ok) {
        const data = await res.json();
        setUserBaskets(data.baskets || []);
      }
    } catch (err) {
      console.error("Failed to fetch baskets:", err);
    } finally {
      setBasketsLoading(false);
    }
  }, [address]);

  // Fetch baskets when address changes
  useEffect(() => {
    fetchUserBaskets();
  }, [fetchUserBaskets]);

  // Fetch available markets on mount
  useEffect(() => {
    fetch("/api/markets")
      .then((res) => res.json())
      .then((data) => {
        setMarketsInfo(data);
        if (data.availableAssets?.length > 0 && !data.availableAssets.includes(asset)) {
          setAsset(data.availableAssets[0]);
        }
      })
      .catch(console.error);
  }, []);

  // Bind wallet and load markets when available
  useEffect(() => {
    if (walletClient && exchangeRef.current) {
      exchangeRef.current.setSigner({ walletClient });
      // Load markets registry (required before placing orders)
      exchangeRef.current.loadMarkets().catch((err) => {
        console.error("Failed to load markets:", err);
      });
    }
  }, [walletClient]);

  // Handle market hint from sidebar
  function handleMarketHint(hintAsset: string) {
    setAsset(hintAsset);
  }

  async function handleConstruct() {
    setStep("loading");
    setError(null);

    try {
      const input: BasketConstructInput = {
        asset: crossAsset ? "BTC+ETH" : asset,
        numWindows,
        maxSpend,
        riskTolerance: risk,
        crossAsset,
      };

      const res = await fetch("/api/basket/construct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to construct basket");
      }

      const data = (await res.json()) as BasketProposal;
      setProposal(data);
      setStep("proposal");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("error");
    }
  }

  async function handleApprove() {
    if (!proposal || !address || !walletClient) return;

    // Check network first
    if (isWrongNetwork) {
      setError(`Wrong network. Please switch to Somnia Shannon (chain ID ${SOMNIA_SHANNON_CHAIN_ID})`);
      setStep("error");
      return;
    }

    setStep("placing");
    setProgress("Loading markets...");

    try {
      const exchange = exchangeRef.current;

      // Ensure markets are loaded (required by SDK before createOrder)
      await exchange.loadMarkets();

      setProgress("Verifying markets...");

      // Verify all markets are still Trading
      const verification = await verifyMarketsTrading(exchange, proposal.legs);
      if (!verification.allTrading) {
        throw new Error(`Some markets no longer trading: ${verification.failedMarkets.join(", ")}`);
      }

      // Place batch orders
      setProgress("Placing orders...");
      const batchResult = await placeBatchOrders(exchange, proposal.legs, (done, total, current) => {
        setProgress(`Placing order ${done + 1}/${total}: ${current}`);
      });

      if (!batchResult.allSucceeded) {
        const failed = batchResult.results.filter((r) => !r.success);
        console.warn("Some orders failed:", failed);
        // Show first error message to user
        const firstError = failed[0]?.error;
        if (firstError) {
          console.error("First order error:", firstError);
        }
      }

      // Store order results for done screen
      setOrderResults(batchResult);

      if (batchResult.successCount === 0) {
        // Get the actual error messages from failed orders
        const failed = batchResult.results.filter((r) => !r.success);
        const errorMsg = failed[0]?.error || "All orders failed";
        throw new Error(errorMsg);
      }

      // Create basket in Firestore
      setProgress("Saving basket...");
      const approveRes = await fetch("/api/basket/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: address,
          proposal,
          orderResults: batchResult.results,
        }),
      });

      if (!approveRes.ok) {
        const data = await approveRes.json();
        throw new Error(data.error || "Failed to save basket");
      }

      const { basketId: newBasketId } = await approveRes.json();
      setBasketId(newBasketId);
      setStep("done");
      fetchUserBaskets(); // Refresh baskets list
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("error");
    }
  }

  function handleReject() {
    setProposal(null);
    setStep("form");
  }

  function handleReset() {
    setStep("form");
    setError(null);
    setProposal(null);
    setBasketId(null);
    setProgress("");
    setOrderResults(null);
  }

  // Summary stats for top bar
  const totalBaskets = userBaskets.length;
  const totalPending = userBaskets.filter((b) => b.status === "active").length;
  const totalRedeemable = userBaskets.reduce((sum, b) => sum + b.redeemableCount, 0);

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0f] font-sans text-white">
      {/* Top Bar */}
      <DashboardTopBar
        totalBaskets={totalBaskets}
        totalPending={totalPending}
        totalRedeemable={totalRedeemable}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Live Markets */}
        <div className="w-56 flex-shrink-0">
          <LiveMarketsSidebar onMarketHint={handleMarketHint} />
        </div>

        {/* Center Panel - Constructor */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl">
            {/* Network Warning */}
            {isWrongNetwork && address && (
              <div className="mb-6 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-yellow-400">Wrong Network</p>
                    <p className="text-xs text-yellow-400/70">
                      Switch to Somnia Shannon testnet (chain ID {SOMNIA_SHANNON_CHAIN_ID}) to place orders
                    </p>
                  </div>
                  <button
                    onClick={() => switchChain?.({ chainId: SOMNIA_SHANNON_CHAIN_ID })}
                    className="rounded bg-yellow-500/20 px-3 py-1.5 text-xs font-semibold text-yellow-400 hover:bg-yellow-500/30"
                  >
                    Switch Network
                  </button>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
                <button onClick={handleReset} className="ml-4 underline">
                  Try again
                </button>
              </div>
            )}

            {/* Step: Form */}
            {step === "form" && (
              <section className="rounded-xl border border-white/10 p-5">
                <h2 className="font-display text-sm font-bold tracking-wide text-white/80">
                  AI BASKET CONSTRUCTOR
                </h2>
                <p className="mt-1 text-xs text-white/40">
                  Build a diversified prediction market basket across multiple time windows.
                </p>

                <div className="mt-5 grid gap-4">
                  <label className="block">
                    <span className="text-xs text-white/60">
                      Asset{" "}
                      {marketsInfo && (
                        <span className="text-accent">({marketsInfo.count} markets)</span>
                      )}
                    </span>
                    <select
                      value={asset}
                      onChange={(e) => setAsset(e.target.value)}
                      className="mt-1 block w-full rounded border border-white/15 bg-transparent px-3 py-2 text-sm"
                    >
                      {marketsInfo?.availableAssets?.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      )) ?? (
                        <>
                          <option value="BTC">BTC</option>
                          <option value="ETH">ETH</option>
                        </>
                      )}
                    </select>
                  </label>

                  {/* Cross-asset toggle */}
                  <label className="flex items-center gap-3 rounded border border-white/10 bg-white/5 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={crossAsset}
                      onChange={(e) => setCrossAsset(e.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-transparent accent-accent"
                    />
                    <div>
                      <span className="text-xs text-white/80">Cross-asset basket (BTC + ETH)</span>
                      <p className="text-[10px] text-white/40">
                        Spread across both assets for more available windows
                      </p>
                    </div>
                  </label>

                  <label className="block">
                    <span className="text-xs text-white/60">Number of Windows (2-5)</span>
                    <input
                      type="number"
                      min={2}
                      max={5}
                      value={numWindows}
                      onChange={(e) => setNumWindows(Number(e.target.value))}
                      className="mt-1 block w-full rounded border border-white/15 bg-transparent px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs text-white/60">Max Spend (USDC)</span>
                    <input
                      type="number"
                      min={1}
                      value={maxSpend}
                      onChange={(e) => setMaxSpend(Number(e.target.value))}
                      className="mt-1 block w-full rounded border border-white/15 bg-transparent px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs text-white/60">Risk Tolerance</span>
                    <select
                      value={risk}
                      onChange={(e) => setRisk(e.target.value as "low" | "medium" | "high")}
                      className="mt-1 block w-full rounded border border-white/15 bg-transparent px-3 py-2 text-sm"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                </div>

                <button
                  onClick={handleConstruct}
                  disabled={!address}
                  className="glass-pill mt-6 w-full rounded-full px-6 py-2.5 text-sm font-semibold tracking-wide disabled:opacity-50"
                >
                  {address ? "CONSTRUCT BASKET" : "CONNECT WALLET FIRST"}
                </button>
              </section>
            )}

            {/* Step: Loading */}
            {step === "loading" && (
              <section className="rounded-xl border border-white/10 p-8 text-center">
                <div className="text-2xl">🤖</div>
                <p className="mt-3 text-sm text-white/60">
                  AI is analyzing markets and constructing your basket...
                </p>
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-accent" />
                </div>
              </section>
            )}

            {/* Step: Proposal */}
            {step === "proposal" && proposal && (
              <section className="rounded-xl border border-white/10 p-5">
                <h2 className="font-display text-sm font-bold tracking-wide text-white/80">
                  BASKET PROPOSAL
                  {proposal.asset.includes("+") && (
                    <span className="ml-2 rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-400">
                      CROSS-ASSET
                    </span>
                  )}
                </h2>

                {/* Availability Note - when fewer windows than requested */}
                {proposal.availabilityNote && (
                  <div className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
                    <div className="flex items-start gap-2">
                      <span className="text-yellow-400">⚠</span>
                      <div>
                        <p className="text-xs font-medium text-yellow-400">
                          {proposal.availabilityNote.available} of {proposal.availabilityNote.requested} windows available
                        </p>
                        <p className="mt-1 text-[11px] text-yellow-400/70">
                          {proposal.availabilityNote.message}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Summary Stats */}
                <div className="mt-4 rounded-lg bg-white/5 p-4">
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div>
                      <div className="text-xs text-white/40">Total Cost</div>
                      <div className="font-mono text-accent">
                        ${proposal.totalCost.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-white/40">Worst Case</div>
                      <div className="font-mono text-red-400">
                        ${proposal.worstCase.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-white/40">Best Case</div>
                      <div className="font-mono text-green-400">
                        ${proposal.bestCase.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Risk Comparison Card */}
                {proposal.riskComparison && (
                  <div className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                    <div className="text-xs font-bold text-blue-400">ESTIMATED SWING</div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <div>
                        <span className="text-white/60">This basket: </span>
                        <span className="font-mono text-white">
                          ±${proposal.riskComparison.basketStdDev.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/60">Single bet: </span>
                        <span className="font-mono text-white">
                          ±${proposal.riskComparison.singleBetStdDev.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    {proposal.riskComparison.varianceReductionPct > 0 && (
                      <div className="mt-2 text-[10px] text-blue-400/70">
                        Spreading across {proposal.legs.length} windows reduces variance by{" "}
                        {proposal.riskComparison.varianceReductionPct.toFixed(0)}% vs. all-in.
                        This is a statistical estimate, not a guarantee.
                      </div>
                    )}
                  </div>
                )}

                {/* Positions - Plain language first */}
                <div className="mt-4">
                  <div className="text-xs font-bold text-white/60">
                    POSITIONS ({proposal.legs.length})
                  </div>
                  <ul className="mt-2 space-y-3">
                    {proposal.legs.map((leg, i) => (
                      <li key={i}>
                        <PositionCard
                          position={{
                            symbol: leg.symbol,
                            side: leg.side,
                            expiry: leg.expiry,
                            price: leg.price,
                            quantity: leg.quantity,
                            interval: leg.interval,
                            cost: leg.cost,
                            liquidityNote: leg.liquidityNote,
                            liquidityLabel: leg.liquidityLabel,
                          }}
                          showCost={true}
                          showLiquidity={true}
                        />
                      </li>
                    ))}
                  </ul>
                </div>

                {/* AI Reasoning */}
                <div className="mt-4">
                  <div className="text-xs font-bold text-white/60">AI REASONING</div>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-white/70">
                    {proposal.reasoning}
                  </p>
                </div>

                {/* Proposal Hash */}
                {proposal.proposalHash && (
                  <div className="mt-4 flex items-center gap-2 text-[10px] text-white/30">
                    <span>Fingerprint:</span>
                    <code className="font-mono">
                      {proposal.proposalHash.slice(0, 8)}...
                      {proposal.proposalHash.slice(-8)}
                    </code>
                    <span>—</span>
                    <span>{new Date(proposal.proposalTimestamp).toLocaleString()}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(proposal.proposalHash)}
                      className="ml-1 rounded border border-white/10 px-1.5 py-0.5 text-white/40 hover:bg-white/5"
                    >
                      copy
                    </button>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={handleApprove}
                    className="flex-1 rounded-full bg-green-600/20 px-6 py-2.5 text-sm font-semibold tracking-wide text-green-400 hover:bg-green-600/30"
                  >
                    APPROVE & PLACE ORDERS
                  </button>
                  <button
                    onClick={handleReject}
                    className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold tracking-wide text-white/60 hover:bg-white/5"
                  >
                    REJECT
                  </button>
                </div>
              </section>
            )}

            {/* Step: Placing Orders */}
            {step === "placing" && (
              <section className="rounded-xl border border-white/10 p-8 text-center">
                <div className="text-2xl">⏳</div>
                <p className="mt-3 text-sm text-white/60">{progress}</p>
                <p className="mt-1 text-xs text-white/40">
                  Sign each transaction in your wallet
                </p>
              </section>
            )}

            {/* Step: Done */}
            {step === "done" && (
              <section className="rounded-xl border border-green-500/30 bg-green-500/10 p-6">
                <div className="text-center">
                  <div className="text-2xl">{orderResults?.allSucceeded ? "✅" : "⚠️"}</div>
                  <p className="mt-3 text-sm text-green-400">
                    Basket created with {orderResults?.successCount ?? 0} of{" "}
                    {orderResults?.results.length ?? 0} positions
                  </p>
                  <p className="mt-1 font-mono text-xs text-white/40">ID: {basketId}</p>
                </div>

                {/* Order breakdown */}
                {orderResults && !orderResults.allSucceeded && (
                  <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                    <p className="text-xs font-semibold text-yellow-400">
                      {orderResults.failCount} order{orderResults.failCount > 1 ? "s" : ""} failed
                    </p>
                    <ul className="mt-2 space-y-1 text-[11px] text-yellow-400/80">
                      {orderResults.results
                        .filter((r) => !r.success)
                        .map((r, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-yellow-400/60">•</span>
                            <span>
                              {r.symbol}: {r.error || "Unknown error"}
                            </span>
                          </li>
                        ))}
                    </ul>
                    <p className="mt-2 text-[10px] text-yellow-400/60">
                      Only successful orders are tracked in your basket.
                    </p>
                  </div>
                )}

                {/* Positions placed */}
                {orderResults && orderResults.successCount > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-white/60">POSITIONS PLACED</p>
                    <ul className="mt-2 space-y-1 text-[11px]">
                      {orderResults.results
                        .filter((r) => r.success)
                        .map((r, i) => (
                          <li
                            key={i}
                            className="flex items-center justify-between rounded bg-white/5 px-2 py-1.5"
                          >
                            <span className="font-mono text-accent">{r.symbol}</span>
                            <span className="text-white/40">
                              {r.filled > 0 ? `${r.filled} filled` : "pending fill"}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                <p className="mt-4 text-center text-xs text-white/50">
                  View your basket in the panel on the right →
                </p>
                <button
                  onClick={handleReset}
                  className="glass-pill mt-4 w-full rounded-full px-6 py-2 text-sm font-semibold tracking-wide"
                >
                  CREATE ANOTHER
                </button>
              </section>
            )}
          </div>
        </main>

        {/* Right Panel - My Baskets */}
        {address && (
          <div className="w-72 flex-shrink-0">
            <MyBasketsPanel
              baskets={userBaskets}
              loading={basketsLoading}
              onRefresh={fetchUserBaskets}
            />
          </div>
        )}
      </div>
    </div>
  );
}
