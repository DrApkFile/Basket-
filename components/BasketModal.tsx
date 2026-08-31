"use client";

import { useState, useRef, useEffect } from "react";
import { useAccount, useWalletClient, useChainId, useSwitchChain } from "wagmi";
import { X } from "lucide-react";
import { createExchange } from "@/lib/somnia";
import { placeBatchOrders, verifyMarketsTrading } from "@/lib/batch-orders";
import type { BasketConstructInput, BasketProposal } from "@/lib/firestore-types";
import type { BatchOrderResult } from "@/lib/batch-orders";
import PositionCard from "./PositionCard";

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
    <>
      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
        }

        .modal {
          position: relative;
          width: 100%;
          max-width: 520px;
          max-height: 90vh;
          overflow-y: auto;
          margin: 20px;
          padding: 32px;
          background: linear-gradient(145deg, rgba(20, 18, 24, 0.95), rgba(8, 10, 12, 0.98));
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          box-shadow:
            0 24px 80px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .modal-close {
          position: absolute;
          top: 20px;
          right: 20px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          transition: all 200ms;
        }

        .modal-close:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .modal-title {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 8px;
          background: linear-gradient(135deg, #FF6B35, #00E28A);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .modal-subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 28px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 8px;
        }

        .form-label span {
          color: #FF6B35;
        }

        .form-input,
        .form-select {
          width: 100%;
          padding: 14px 16px;
          font-size: 15px;
          color: #fff;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          outline: none;
          transition: all 200ms;
        }

        .form-input:focus,
        .form-select:focus {
          border-color: rgba(255, 107, 53, 0.4);
          background: rgba(255, 255, 255, 0.06);
        }

        .form-select option {
          background: #1a1a1e;
          color: #fff;
        }

        .form-checkbox {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          background: linear-gradient(135deg, rgba(255, 107, 53, 0.06), rgba(0, 226, 138, 0.03));
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          cursor: pointer;
        }

        .form-checkbox input {
          width: 18px;
          height: 18px;
          margin-top: 2px;
          accent-color: #FF6B35;
        }

        .form-checkbox-label {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
        }

        .form-checkbox-desc {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          margin-top: 4px;
        }

        .btn-primary {
          width: 100%;
          padding: 16px;
          font-size: 15px;
          font-weight: 600;
          color: #000;
          background: linear-gradient(135deg, #FF6B35, #FF8B5A);
          border: none;
          border-radius: 14px;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(255, 107, 53, 0.35);
          transition: all 250ms;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(255, 107, 53, 0.45);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          padding: 14px 24px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          cursor: pointer;
          transition: all 200ms;
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .btn-success {
          flex: 1;
          padding: 14px 24px;
          font-size: 14px;
          font-weight: 600;
          color: #000;
          background: linear-gradient(135deg, #00E28A, #00C77A);
          border: none;
          border-radius: 12px;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(0, 226, 138, 0.3);
          transition: all 200ms;
        }

        .btn-success:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(0, 226, 138, 0.4);
        }

        .btn-row {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .alert {
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 20px;
          font-size: 14px;
        }

        .alert-warning {
          background: rgba(255, 184, 0, 0.1);
          border: 1px solid rgba(255, 184, 0, 0.2);
          color: #FFB800;
        }

        .alert-error {
          background: rgba(255, 70, 70, 0.1);
          border: 1px solid rgba(255, 70, 70, 0.2);
          color: #FF5050;
        }

        .alert button {
          margin-left: 12px;
          padding: 4px 12px;
          font-size: 12px;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 6px;
          color: inherit;
          cursor: pointer;
        }

        .loading-state {
          text-align: center;
          padding: 48px 20px;
        }

        .loading-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }

        .loading-text {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.6);
        }

        .loading-subtext {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.4);
          margin-top: 8px;
        }

        .loading-bar {
          width: 200px;
          height: 4px;
          margin: 20px auto 0;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
        }

        .loading-bar-fill {
          height: 100%;
          width: 50%;
          background: linear-gradient(90deg, #FF6B35, #00E28A);
          border-radius: 2px;
          animation: loading 1.5s ease-in-out infinite;
        }

        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }

        .proposal-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 16px;
          margin-bottom: 24px;
        }

        .proposal-stat {
          text-align: center;
        }

        .proposal-stat-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .proposal-stat-value {
          font-size: 20px;
          font-weight: 700;
          margin-top: 4px;
        }

        .proposal-stat-value.cost {
          color: #FF6B35;
        }

        .proposal-stat-value.worst {
          color: #FF5050;
        }

        .proposal-stat-value.best {
          color: #00E28A;
        }

        .positions-list {
          max-height: 200px;
          overflow-y: auto;
          margin-bottom: 20px;
        }

        .positions-list > * + * {
          margin-top: 8px;
        }

        .reasoning {
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          margin-bottom: 20px;
        }

        .reasoning-label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .reasoning-text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.6;
          max-height: 100px;
          overflow-y: auto;
        }

        .success-state {
          text-align: center;
          padding: 32px 20px;
        }

        .success-icon {
          width: 72px;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          background: linear-gradient(135deg, rgba(0, 226, 138, 0.15), rgba(0, 226, 138, 0.05));
          border-radius: 20px;
          font-size: 32px;
        }

        .success-title {
          font-size: 20px;
          font-weight: 600;
          color: #00E28A;
          margin-bottom: 8px;
        }

        .success-subtitle {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.4);
          font-family: monospace;
        }
      `}</style>

      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>

          {/* Network Warning */}
          {isWrongNetwork && address && (
            <div className="alert alert-warning">
              Wrong network — switch to Somnia Shannon
              <button onClick={() => switchChain?.({ chainId: SOMNIA_SHANNON_CHAIN_ID })}>
                Switch
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="alert alert-error">
              {error}
              <button onClick={handleReset}>Try again</button>
            </div>
          )}

          {/* Form */}
          {step === "form" && (
            <>
              <h2 className="modal-title">Create Basket</h2>
              <p className="modal-subtitle">AI will construct a diversified prediction basket</p>

              <div className="form-group">
                <label className="form-label">
                  Asset {marketCount > 0 && <span>({marketCount} markets)</span>}
                </label>
                <select
                  className="form-select"
                  value={asset}
                  onChange={(e) => setAsset(e.target.value)}
                >
                  {availableAssets.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-checkbox">
                  <input
                    type="checkbox"
                    checked={crossAsset}
                    onChange={(e) => setCrossAsset(e.target.checked)}
                  />
                  <div>
                    <div className="form-checkbox-label">Cross-asset (BTC + ETH)</div>
                    <div className="form-checkbox-desc">Spread across both assets for more windows</div>
                  </div>
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Windows (2-5)</label>
                <input
                  type="number"
                  className="form-input"
                  min={2}
                  max={5}
                  value={numWindows}
                  onChange={(e) => setNumWindows(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Max Spend (USDC)</label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  value={maxSpend}
                  onChange={(e) => setMaxSpend(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Risk Tolerance</label>
                <select
                  className="form-select"
                  value={risk}
                  onChange={(e) => setRisk(e.target.value as "low" | "medium" | "high")}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <button
                className="btn-primary"
                onClick={handleConstruct}
                disabled={!address}
              >
                {address ? "Construct Basket" : "Connect Wallet First"}
              </button>
            </>
          )}

          {/* Loading */}
          {step === "loading" && (
            <div className="loading-state">
              <div className="loading-icon">🤖</div>
              <p className="loading-text">AI is analyzing markets...</p>
              <div className="loading-bar">
                <div className="loading-bar-fill" />
              </div>
            </div>
          )}

          {/* Proposal */}
          {step === "proposal" && proposal && (
            <>
              <h2 className="modal-title">Basket Proposal</h2>

              <div className="proposal-stats">
                <div className="proposal-stat">
                  <div className="proposal-stat-label">Cost</div>
                  <div className="proposal-stat-value cost">${proposal.totalCost.toFixed(2)}</div>
                </div>
                <div className="proposal-stat">
                  <div className="proposal-stat-label">Worst</div>
                  <div className="proposal-stat-value worst">${proposal.worstCase.toFixed(2)}</div>
                </div>
                <div className="proposal-stat">
                  <div className="proposal-stat-label">Best</div>
                  <div className="proposal-stat-value best">${proposal.bestCase.toFixed(2)}</div>
                </div>
              </div>

              <div className="positions-list">
                {proposal.legs.map((leg, i) => (
                  <PositionCard
                    key={i}
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
                ))}
              </div>

              <div className="reasoning">
                <div className="reasoning-label">AI Reasoning</div>
                <p className="reasoning-text">{proposal.reasoning}</p>
              </div>

              <div className="btn-row">
                <button className="btn-success" onClick={handleApprove}>
                  Approve & Place
                </button>
                <button className="btn-secondary" onClick={handleReject}>
                  Reject
                </button>
              </div>
            </>
          )}

          {/* Placing */}
          {step === "placing" && (
            <div className="loading-state">
              <div className="loading-icon">⏳</div>
              <p className="loading-text">{progress}</p>
              <p className="loading-subtext">Sign each transaction in your wallet</p>
            </div>
          )}

          {/* Done */}
          {step === "done" && (
            <div className="success-state">
              <div className="success-icon">
                {orderResults?.allSucceeded ? "✅" : "⚠️"}
              </div>
              <h3 className="success-title">
                Basket created with {orderResults?.successCount ?? 0} positions
              </h3>
              <p className="success-subtitle">ID: {basketId}</p>
              <button className="btn-primary" onClick={onClose} style={{ marginTop: 24 }}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
