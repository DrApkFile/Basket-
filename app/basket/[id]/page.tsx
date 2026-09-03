"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import PositionCard from "@/components/PositionCard";
import type { ProposedLeg, LiquidityLabel } from "@/lib/firestore-types";

const SOMNIA_SHANNON_CHAIN_ID = 50312;

interface BasketData {
  asset: string;
  totalSpent: number;
  maxSpend: number;
  aiReasoning: string;
  status: string;
  createdAt: string;
  userId: string;
}

interface LegData {
  marketId: string;
  symbol: string;
  side: "YES" | "NO";
  quantity: number;
  price: number;
  cost: number;
  interval: string;
  expiry: number;
  outcome: string | null;
}

interface CopyResult {
  draft: {
    asset: string;
    crossAsset: boolean;
    legs: ProposedLeg[];
    totalCost: number;
    worstCase: number;
    bestCase: number;
    originalReasoning: string;
  };
  droppedLegs: Array<{ symbol: string; reason: string }>;
  droppedCount: number;
  originalLegCount: number;
  copiedLegCount: number;
  message: string;
}

interface AskResponse {
  answer: string;
  questionsRemaining: number;
}

export default function SharedBasketPage() {
  const params = useParams();
  const router = useRouter();
  const basketId = params.id as string;

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const isWrongNetwork = chainId !== SOMNIA_SHANNON_CHAIN_ID;

  const [basket, setBasket] = useState<BasketData | null>(null);
  const [legs, setLegs] = useState<LegData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Copy state
  const [copying, setCopying] = useState(false);
  const [copyResult, setCopyResult] = useState<CopyResult | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  // Ask-AI state
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [conversation, setConversation] = useState<Array<{ q: string; a: string }>>([]);
  const [questionsRemaining, setQuestionsRemaining] = useState(5);
  const [askError, setAskError] = useState<string | null>(null);

  // Fetch basket data
  const fetchBasket = useCallback(async (skipNarration = false) => {
    try {
      // Fetch basket narration which includes legs
      const res = await fetch("/api/basket/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basketId, skipNarration }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Basket not found");
      }

      const data = await res.json();

      // Also fetch the basket doc itself for reasoning
      const basketRes = await fetch(`/api/basket/get?basketId=${basketId}`);
      let basketData: BasketData | null = null;

      if (basketRes.ok) {
        const bData = await basketRes.json();
        basketData = {
          asset: bData.asset,
          totalSpent: bData.totalSpent,
          maxSpend: bData.maxSpend,
          aiReasoning: bData.aiReasoning,
          status: bData.status,
          createdAt: bData.createdAt,
          userId: bData.userId || "",
        };
      }

      setBasket(
        basketData || {
          asset: data.legs[0]?.symbol.split("-")[0] || "Unknown",
          totalSpent: data.summary.totalCost,
          maxSpend: data.summary.totalCost,
          aiReasoning: "",
          status: data.status,
          createdAt: "",
          userId: "",
        }
      );

      setLegs(
        data.legs.map((l: LegData & { price?: number; interval?: string; expiry?: number }) => ({
          marketId: l.marketId,
          symbol: l.symbol,
          side: l.side,
          quantity: l.quantity || 0,
          price: l.price || 0,
          cost: l.cost || 0,
          interval: l.interval || "?",
          expiry: l.expiry || 0,
          outcome: l.outcome,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load basket");
    } finally {
      setLoading(false);
    }
  }, [basketId]);

  // Initial fetch and polling for status updates
  useEffect(() => {
    if (basketId) {
      fetchBasket(false); // Initial fetch with narration

      // Poll every 10 seconds for status updates (skip narration for speed)
      const interval = setInterval(() => fetchBasket(true), 10000);
      return () => clearInterval(interval);
    }
  }, [basketId]);

  // Handle copy to my basket
  async function handleCopy() {
    if (!isConnected) return;

    setCopying(true);
    setCopyError(null);
    setCopyResult(null);

    try {
      const res = await fetch("/api/basket/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basketId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Copy failed");
      }

      setCopyResult(data);

      // Store draft in sessionStorage for constructor to pick up
      sessionStorage.setItem("basketDraft", JSON.stringify(data.draft));
      sessionStorage.setItem("basketDraftDropped", JSON.stringify(data.droppedLegs));
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : "Copy failed");
    } finally {
      setCopying(false);
    }
  }

  // Navigate to constructor with draft
  function handleEditDraft() {
    router.push("/basket?mode=draft");
  }

  // Handle ask question
  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || asking || questionsRemaining <= 0) return;

    setAsking(true);
    setAskError(null);

    try {
      const res = await fetch("/api/basket/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basketId, question: question.trim() }),
      });

      const data: AskResponse & { error?: string } = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to get answer");
      }

      setConversation((prev) => [...prev, { q: question.trim(), a: data.answer }]);
      setQuestionsRemaining(data.questionsRemaining);
      setQuestion("");
    } catch (err) {
      setAskError(err instanceof Error ? err.message : "Failed to ask");
    } finally {
      setAsking(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] p-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-white/60">Loading basket...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] p-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="text-red-400">{error}</p>
            <Link href="/basket" className="mt-4 inline-block text-sm text-accent hover:underline">
              ← Back to constructor
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/basket" className="text-sm text-white/40 hover:text-white/60">
            ← Back to constructor
          </Link>
          <ConnectButton showBalance={false} />
        </div>

        {/* Basket Card */}
        <div className="mt-6 rounded-xl border border-white/10 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-lg font-bold text-white">
                {basket?.asset} BASKET
              </h1>
              <p className="mt-1 font-mono text-xs text-white/40">{basketId.slice(0, 12)}...</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                basket?.status === "redeemed"
                  ? "bg-green-500/20 text-green-400"
                  : basket?.status === "settled"
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-yellow-500/20 text-yellow-400"
              }`}
            >
              {basket?.status?.toUpperCase()}
            </span>
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-2 gap-4 text-center text-sm">
            <div className="rounded bg-white/5 p-3">
              <div className="text-xs text-white/40">Total Spent</div>
              <div className="font-mono text-accent">${basket?.totalSpent.toFixed(2)}</div>
            </div>
            <div className="rounded bg-white/5 p-3">
              <div className="text-xs text-white/40">Positions</div>
              <div className="font-mono text-white">{legs.length}</div>
            </div>
          </div>

          {/* Positions */}
          <div className="mt-6">
            <h2 className="text-xs font-bold text-white/60">POSITIONS</h2>
            <ul className="mt-3 space-y-2">
              {legs.map((leg) => (
                <li key={leg.marketId}>
                  <PositionCard
                    position={{
                      symbol: leg.symbol,
                      side: leg.side,
                      expiry: leg.expiry,
                      price: leg.price,
                      quantity: leg.quantity,
                      interval: leg.interval,
                      outcome: leg.outcome ?? undefined,
                    }}
                    showCost={true}
                    showLiquidity={false}
                    showOutcome={!!leg.outcome}
                    compact={true}
                  />
                </li>
              ))}
            </ul>
          </div>

          {/* AI Reasoning */}
          {basket?.aiReasoning && (
            <div className="mt-6">
              <h2 className="text-xs font-bold text-white/60">AI REASONING</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/70">
                {basket.aiReasoning}
              </p>
            </div>
          )}
        </div>

        {/* Copy to My Basket Section - hide for basket owner */}
        {!(address && basket?.userId && address.toLowerCase() === basket.userId.toLowerCase()) && (
        <div className="mt-6 rounded-xl border border-white/10 p-6">
          <h2 className="font-display text-sm font-bold text-white/80">COPY TO MY BASKET</h2>
          <p className="mt-1 text-xs text-white/50">
            Creates an editable draft with live prices. You review and approve before any order is
            placed.
          </p>

          {!isConnected ? (
            <div className="mt-4 rounded bg-white/5 p-4 text-center">
              <p className="text-xs text-white/60">Connect your wallet to copy this basket</p>
              <div className="mt-3">
                <ConnectButton />
              </div>
            </div>
          ) : isWrongNetwork ? (
            <div className="mt-4 rounded border border-yellow-500/30 bg-yellow-500/10 p-4">
              <p className="text-xs text-yellow-400">Switch to Somnia Shannon testnet first</p>
              <button
                onClick={() => switchChain?.({ chainId: SOMNIA_SHANNON_CHAIN_ID })}
                className="mt-2 rounded bg-yellow-500/20 px-3 py-1.5 text-xs font-semibold text-yellow-400"
              >
                Switch Network
              </button>
            </div>
          ) : copyResult ? (
            <div className="mt-4 space-y-3">
              {/* Success message */}
              <div className="rounded border border-green-500/30 bg-green-500/10 p-3">
                <p className="text-sm text-green-400">{copyResult.message}</p>
              </div>

              {/* Dropped legs warning */}
              {copyResult.droppedCount > 0 && (
                <div className="rounded border border-yellow-500/30 bg-yellow-500/10 p-3">
                  <p className="text-xs font-semibold text-yellow-400">
                    {copyResult.droppedCount} window{copyResult.droppedCount > 1 ? "s" : ""} couldn't
                    be copied:
                  </p>
                  <ul className="mt-2 space-y-1 text-[11px] text-yellow-400/80">
                    {copyResult.droppedLegs.map((dl, i) => (
                      <li key={i}>• {dl.symbol}: {dl.reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Live price preview */}
              <div className="rounded bg-white/5 p-3">
                <p className="text-xs font-semibold text-white/60">DRAFT PREVIEW (LIVE PRICES)</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-white/40">Windows:</span>{" "}
                    <span className="text-white">{copyResult.copiedLegCount}</span>
                  </div>
                  <div>
                    <span className="text-white/40">Est. Cost:</span>{" "}
                    <span className="font-mono text-accent">
                      ${copyResult.draft.totalCost.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleEditDraft}
                className="w-full rounded-full bg-green-600/20 px-6 py-2.5 text-sm font-semibold text-green-400 hover:bg-green-600/30"
              >
                EDIT & PLACE ORDERS →
              </button>
            </div>
          ) : (
            <button
              onClick={handleCopy}
              disabled={copying}
              className="mt-4 w-full rounded-full bg-accent/20 px-6 py-2.5 text-sm font-semibold text-accent hover:bg-accent/30 disabled:opacity-50"
            >
              {copying ? "Fetching live prices..." : "COPY TO MY BASKET"}
            </button>
          )}

          {copyError && (
            <div className="mt-3 rounded border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
              {copyError}
            </div>
          )}
        </div>
        )}

        {/* Ask-AI Section */}
        {basket?.aiReasoning && (
          <div className="mt-6 rounded-xl border border-white/10 p-6">
            <h2 className="font-display text-sm font-bold text-white/80">ASK ABOUT THIS BASKET</h2>
            <p className="mt-1 text-xs text-white/50">
              Ask questions about the reasoning. Cannot give new predictions or trading advice.
            </p>

            {/* Conversation history */}
            {conversation.length > 0 && (
              <div className="mt-4 space-y-3">
                {conversation.map((item, i) => (
                  <div key={i} className="space-y-2">
                    <div className="rounded bg-accent/10 p-2 text-xs text-accent">
                      <span className="font-semibold">You:</span> {item.q}
                    </div>
                    <div className="rounded bg-white/5 p-2 text-xs text-white/80">
                      <span className="font-semibold text-white/60">AI:</span> {item.a}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Question input */}
            <form onSubmit={handleAsk} className="mt-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Why did the AI choose this interval?"
                  maxLength={500}
                  disabled={asking || questionsRemaining <= 0}
                  className="flex-1 rounded border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder-white/30 focus:border-accent focus:outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={asking || !question.trim() || questionsRemaining <= 0}
                  className="rounded bg-accent/20 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/30 disabled:opacity-50"
                >
                  {asking ? "..." : "Ask"}
                </button>
              </div>
              <p className="mt-2 text-[10px] text-white/30">
                {questionsRemaining} question{questionsRemaining !== 1 ? "s" : ""} remaining this
                session
              </p>
            </form>

            {askError && (
              <div className="mt-2 text-xs text-red-400">{askError}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
