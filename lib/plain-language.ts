/**
 * Plain-language translation layer for basket positions.
 * Deterministic formatting — no AI calls.
 */

export interface PlainLanguagePosition {
  question: string;       // "Will BTC be above its reference price by 11:00 PM today?"
  confidence: string;     // "64% market confidence"
  windowLabel: string;    // "1-hour window"
  contractsLabel: string; // "8 contracts"
}

export interface PositionInput {
  symbol: string;      // e.g., "BTC-0-25AUG26-2300/tUSDC"
  side: "YES" | "NO";
  expiry: number;      // unix timestamp
  price: number;       // 0-1, implied probability
  quantity: number;
  interval?: string;   // e.g., "1h", "5m", "24h"
}

/**
 * Convert a position to plain language.
 * Pure function — deterministic, instant, no AI.
 */
export function toPlainLanguage(position: PositionInput): PlainLanguagePosition {
  // Extract asset from symbol (e.g., "BTC-0-25AUG26-2300/tUSDC" -> "BTC")
  const asset = position.symbol.split("-")[0];

  // Direction based on side
  const direction = position.side === "YES" ? "above" : "below";

  // Format expiry as human-readable local time
  const expiryDate = new Date(position.expiry * 1000);
  const now = new Date();
  const isToday = expiryDate.toDateString() === now.toDateString();
  const isTomorrow = expiryDate.toDateString() === new Date(now.getTime() + 86400000).toDateString();

  const timeStr = expiryDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  let dateStr: string;
  if (isToday) {
    dateStr = `by ${timeStr} today`;
  } else if (isTomorrow) {
    dateStr = `by ${timeStr} tomorrow`;
  } else {
    const dayStr = expiryDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    dateStr = `by ${timeStr} on ${dayStr}`;
  }

  // Build the question
  const question = `Will ${asset} be ${direction} its reference price ${dateStr}?`;

  // Confidence from price (price ≈ implied probability)
  const confidencePct = Math.round(position.price * 100);
  const confidence = `${confidencePct}% market confidence`;

  // Window label from interval or calculate from expiry
  let windowLabel: string;
  if (position.interval) {
    windowLabel = formatInterval(position.interval);
  } else {
    const minutesToExpiry = Math.max(0, Math.round((position.expiry - Date.now() / 1000) / 60));
    if (minutesToExpiry < 60) {
      windowLabel = `${minutesToExpiry}-minute window`;
    } else if (minutesToExpiry < 1440) {
      const hours = Math.round(minutesToExpiry / 60);
      windowLabel = `${hours}-hour window`;
    } else {
      const days = Math.round(minutesToExpiry / 1440);
      windowLabel = `${days}-day window`;
    }
  }

  // Contracts label
  const contractsLabel = position.quantity === 1
    ? "1 contract"
    : `${position.quantity} contracts`;

  return {
    question,
    confidence,
    windowLabel,
    contractsLabel,
  };
}

/**
 * Format interval string to human-readable.
 */
function formatInterval(interval: string): string {
  const match = interval.match(/^(\d+)([mhd])$/i);
  if (!match) return interval;

  const [, num, unit] = match;
  const n = parseInt(num, 10);

  switch (unit.toLowerCase()) {
    case "m":
      return n === 1 ? "1-minute window" : `${n}-minute window`;
    case "h":
      return n === 1 ? "1-hour window" : `${n}-hour window`;
    case "d":
      return n === 1 ? "1-day window" : `${n}-day window`;
    default:
      return interval;
  }
}

/**
 * Get a short summary for list views.
 */
export function toShortSummary(position: PositionInput): string {
  const asset = position.symbol.split("-")[0];
  const direction = position.side === "YES" ? "UP" : "DOWN";
  const confidencePct = Math.round(position.price * 100);
  return `${asset} ${direction} @ ${confidencePct}%`;
}
