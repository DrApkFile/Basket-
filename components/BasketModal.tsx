"use client";

import { useState, useRef, useEffect } from "react";
import { useAccount, useWalletClient, useChainId, useSwitchChain } from "wagmi";
import { X } from "lucide-react";
import { createExchange } from "@/lib/somnia";
import { placeBatchOrders, verifyMarketsTrading } from "@/lib/batch-orders";
import type { BasketConstructInput, BasketProposal } from "@/lib/firestore-types";
import type { BatchOrderResult } from "@/lib/batch-orders";
import PositionCard from "./PositionCard";
import { LoomIcon } from "./icons";

type Step = "form" | "loading" | "proposal" | "placing" | "done" | "error";

const SOMNIA_SHANNON_CHAIN_ID = 50312;

interface BasketModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAsset?: string;
  availableAssets?: string[];
  marketCount?: number;
  onBasketCreated?: () => void;
}

export default function BasketModal({
  isOpen,
  onClose,
  defaultAsset = "BTC",
  availableAssets = ["BTC", "ETH"],
  marketCount = 0,
  onBasketCreated,
}: BasketModalProps) {
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
  const [orderResults, setOrderResults] = useState<BatchOrderResult | null>(null);

  const [asset, setAsset] = useState(defaultAsset);
  const [crossAsset, setCrossAsset] = useState(false);
  const [numWindows, setNumWindows] = useState(3);
  const [maxSpend, setMaxSpend] = useState(10);
  const [risk, setRisk] = useState<"low" | "medium" | "high">("medium");
  const [maxExpiryMinutes, setMaxExpiryMinutes] = useState<number | null>(null);

  const exchangeRef = useRef(createExchange());

  useEffect(() => {
    if (isOpen) {
      setStep("form");
      setError(null);
      setProposal(null);
      setBasketId(null);
      setProgress("");
      setOrderResults(null);
      setAsset(defaultAsset);
    }
  }, [isOpen, defaultAsset]);

  useEffect(() => {
    if (walletClient && exchangeRef.current) {
      exchangeRef.current.setSigner({ walletClient });
      exchangeRef.current.loadMarkets().catch(console.error);
    }
  }, [walletClient]);

  async function handleConstruct() {
    setStep("loading");
    setError(null);

    try {
      const input: BasketConstructInput & { maxExpiryMinutes?: number } = {
        asset: crossAsset ? "BTC+ETH" : asset,
        numWindows,
        maxSpend,
        riskTolerance: risk,
        crossAsset,
        ...(maxExpiryMinutes && { maxExpiryMinutes }),
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

    if (isWrongNetwork) {
      setError(`Wrong network. Please switch to Somnia Shannon`);
      setStep("error");
      return;
    }

    setStep("placing");
    setProgress("Loading markets...");

    try {
      const exchange = exchangeRef.current;
      await exchange.loadMarkets();

      setProgress("Verifying markets...");
      const verification = await verifyMarketsTrading(exchange, proposal.legs);
      if (!verification.allTrading) {
        throw new Error(`Some markets no longer trading`);
      }

      setProgress("Placing orders...");
      const batchResult = await placeBatchOrders(exchange, proposal.legs, (done, total, current) => {
        setProgress(`Placing ${done + 1}/${total}: ${current}`);
      });

      setOrderResults(batchResult);

      if (batchResult.successCount === 0) {
        const failed = batchResult.results.filter((r) => !r.success);
        throw new Error(failed[0]?.error || "All orders failed");
      }

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
      onBasketCreated?.();
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
    setProgress("");
    setOrderResults(null);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0f0f14] p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Network Warning */}
        {isWrongNetwork && address && (
          <div className="mb-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-yellow-400">Wrong Network</p>
                <p className="text-xs text-yellow-400/70">Switch to Somnia Shannon testnet</p>
              </div>
              <button
                onClick={() => switchChain?.({ chainId: SOMNIA_SHANNON_CHAIN_ID })}
                className="rounded bg-yellow-500/20 px-3 py-1.5 text-xs font-semibold text-yellow-400 hover:bg-yellow-500/30"
              >
                Switch
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
            <button onClick={handleReset} className="ml-4 underline">
              Try again
            </button>
          </div>
        )}

        {/* Step: Form */}
        {step === "form" && (
          <>
            <h2 className="text-lg font-bold text-white">Create Basket</h2>
            <p className="mt-1 text-sm text-white/50">
              AI will construct a diversified prediction basket
            </p>

            <div className="mt-5 grid gap-4">
              <label className="block">
                <span className="text-xs text-white/60">
                  Asset {marketCount > 0 && <span className="text-accent">({marketCount} markets)</span>}
                </span>
                <select
                  value={asset}
                  onChange={(e) => setAsset(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                >
                  {availableAssets.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={crossAsset}
                  onChange={(e) => setCrossAsset(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-transparent accent-orange-500"
                />
                <div>
                  <span className="text-xs text-white/80">Cross-asset (BTC + ETH)</span>
                  <p className="text-[10px] text-white/40">Spread across both assets</p>
                </div>
              </label>

              <label className="block">
                <span className="text-xs text-white/60">Windows (2-5)</span>
                <input
                  type="number"
                  min={2}
                  max={5}
                  value={numWindows}
                  onChange={(e) => setNumWindows(Number(e.target.value))}
                  className="mt-1 block w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                />
              </label>

              <label className="block">
                <span className="text-xs text-white/60">Max Spend (USDC)</span>
                <input
                  type="number"
                  min={1}
                  value={maxSpend}
                  onChange={(e) => setMaxSpend(Number(e.target.value))}
                  className="mt-1 block w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                />
              </label>

              <label className="block">
                <span className="text-xs text-white/60">Risk Tolerance</span>
                <select
                  value={risk}
                  onChange={(e) => setRisk(e.target.value as "low" | "medium" | "high")}
                  className="mt-1 block w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>

              <div className="block">
                <span className="text-xs text-white/60">Max Expiry Time (for demo)</span>
                <p className="mb-2 text-[10px] text-white/40">Only use markets expiring within this time</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: null, label: "Any" },
                    { value: 5, label: "5 min" },
                    { value: 10, label: "10 min" },
                    { value: 15, label: "15 min" },
                    { value: 30, label: "30 min" },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setMaxExpiryMinutes(opt.value)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        maxExpiryMinutes === opt.value
                          ? "bg-gradient-to-r from-orange-500 to-green-500 text-black"
                          : "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleConstruct}
              disabled={!address}
              className="mt-6 w-full rounded-lg bg-gradient-to-r from-orange-500 to-green-500 px-6 py-3 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
            >
              {address ? "Construct Basket" : "Connect Wallet First"}
            </button>
          </>
        )}

        {/* Step: Loading */}
        {step === "loading" && (
          <div className="py-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center">
              <LoomIcon size={48} active />
            </div>
            <p className="mt-4 text-sm text-white/60">AI is analyzing markets...</p>
            <div className="mx-auto mt-4 h-1 w-48 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-orange-500 to-green-500" />
            </div>
          </div>
        )}

        {/* Step: Proposal */}
        {step === "proposal" && proposal && (
          <>
            <h2 className="text-lg font-bold text-white">Basket Proposal</h2>

            {/* Summary */}
            <div className="mt-4 grid grid-cols-3 gap-4 rounded-lg bg-white/5 p-4 text-center text-sm">
              <div>
                <div className="text-xs text-white/40">Cost</div>
                <div className="font-mono text-orange-400">${proposal.totalCost.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-white/40">Worst</div>
                <div className="font-mono text-red-400">${proposal.worstCase.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-white/40">Best</div>
                <div className="font-mono text-green-400">${proposal.bestCase.toFixed(2)}</div>
              </div>
            </div>

            {/* Positions */}
            <div className="mt-4">
              <div className="text-xs font-bold text-white/60">POSITIONS ({proposal.legs.length})</div>
              <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
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
                      }}
                      showCost={true}
                      compact={true}
                    />
                  </li>
                ))}
              </ul>
            </div>

            {/* Reasoning */}
            <div className="mt-4">
              <div className="text-xs font-bold text-white/60">AI REASONING</div>
              <p className="mt-2 max-h-24 overflow-y-auto text-xs leading-relaxed text-white/70">
                {proposal.reasoning}
              </p>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleApprove}
                className="flex-1 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
              >
                Approve & Place
              </button>
              <button
                onClick={handleReject}
                className="rounded-lg border border-white/20 px-6 py-2.5 text-sm font-semibold text-white/60 hover:bg-white/5"
              >
                Reject
              </button>
            </div>
          </>
        )}

        {/* Step: Placing */}
        {step === "placing" && (
          <div className="py-12 text-center">
            <div className="text-3xl">⏳</div>
            <p className="mt-4 text-sm text-white/60">{progress}</p>
            <p className="mt-1 text-xs text-white/40">Sign each transaction in your wallet</p>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="py-8 text-center">
            <div className="text-3xl">{orderResults?.allSucceeded ? "✅" : "⚠️"}</div>
            <p className="mt-4 text-sm text-green-400">
              Basket created with {orderResults?.successCount ?? 0} positions
            </p>
            <p className="mt-1 font-mono text-xs text-white/40">ID: {basketId}</p>
            <button
              onClick={onClose}
              className="mt-6 rounded-lg bg-gradient-to-r from-orange-500 to-green-500 px-6 py-2.5 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
