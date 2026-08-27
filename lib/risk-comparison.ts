/**
 * Variance comparison for basket vs single all-in bet.
 * Uses standard Bernoulli variance formula for binary payoffs.
 */

export interface PositionInput {
  price: number; // ask price, treated as implied probability
  cost: number;  // allocation in dollars
}

export interface RiskComparison {
  basketVariance: number;
  basketStdDev: number;
  singleBetVariance: number;
  singleBetStdDev: number;
  varianceReductionPct: number;
}

/**
 * Compute variance comparison between a diversified basket and a single all-in bet.
 *
 * For a single position: spend `a` on market priced at `p`.
 * - Quantity = a / p
 * - Profit if win = (a/p) - a = a(1-p)/p
 * - Profit if loss = -a
 * - Variance = (a/p)^2 * p * (1-p)
 *
 * For basket: sum of individual variances (positions are independent).
 * Single bet comparison: full budget on the highest-allocated position's price.
 */
export function computeRiskComparison(
  positions: PositionInput[],
  totalBudget: number
): RiskComparison {
  if (positions.length === 0) {
    return {
      basketVariance: 0,
      basketStdDev: 0,
      singleBetVariance: 0,
      singleBetStdDev: 0,
      varianceReductionPct: 0,
    };
  }

  // Compute basket variance: sum of each position's variance
  let basketVariance = 0;
  for (const pos of positions) {
    const a = pos.cost;
    const p = pos.price;
    // Variance = (a/p)^2 * p * (1-p)
    const variance = Math.pow(a / p, 2) * p * (1 - p);
    basketVariance += variance;
  }

  // Find highest-allocated position for single-bet comparison
  const highestAllocation = positions.reduce(
    (max, pos) => (pos.cost > max.cost ? pos : max),
    positions[0]
  );

  // Single bet: full budget at the highest-allocated position's price
  const singleA = totalBudget;
  const singleP = highestAllocation.price;
  const singleBetVariance = Math.pow(singleA / singleP, 2) * singleP * (1 - singleP);

  const basketStdDev = Math.sqrt(basketVariance);
  const singleBetStdDev = Math.sqrt(singleBetVariance);

  // Variance reduction percentage
  const varianceReductionPct =
    singleBetVariance > 0
      ? ((singleBetVariance - basketVariance) / singleBetVariance) * 100
      : 0;

  return {
    basketVariance,
    basketStdDev,
    singleBetVariance,
    singleBetStdDev,
    varianceReductionPct,
  };
}
