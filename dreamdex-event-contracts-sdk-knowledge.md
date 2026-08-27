# DreamDEX Event Contracts — Developer Knowledge Base

Researched: 2026-08-20
Primary source: docs.dreamdex.io/developers (Event Contracts, Recipes, Market
Structure & Lifecycle, Contracts & Addresses pages — pasted in full by the
user after the automated fetch was blocked by robots.txt).

**Correction to earlier research pass:** the previous knowledge file
speculated Event Contracts might share the spot HTTP-API's
prepare-transaction pattern. That's wrong — confirmed directly from the
docs: *"the HTTP API covers spot only and has no event-contract
endpoints."* Event Contracts are accessed exclusively through the
`@somnia-chain/markets-sdk` TypeScript package. Anything in the earlier file
implying an HTTP order-prep flow for Event Contracts should be disregarded.

## What it actually is

Event Contracts are binary (Up/Down) markets trading on a dedicated on-chain
order book, structurally distinct from DreamDEX's spot product even though
both run on the same underlying CLOB matching engine. A trader takes a
position that a price will be above or below a reference at a fixed
expiry. Winners redeem 1 USDso per contract; on a voided market both sides
redeem at 0.5.

## Install and version gate (hard requirement)

```bash
npm install @somnia-chain/markets-sdk viem
```

**Must be v0.25.0 or newer.** Anything below v0.23.0 cannot read markets at
all — the indexer dropped a column (`longOpenInterest`) that older SDK
versions still query for, so `loadMarkets` and `listBinaryMarkets` both
fail outright. This is a hard version floor, not a nice-to-have — check
`package.json` before debugging anything else if market discovery isn't
working.

## The three SDK tiers — use all of them, on purpose

| Tier | Reach it with | Use for |
|---|---|---|
| Unified | `exchange.*` | Trading by symbol in human units — most of your bot |
| Client (reads) | `exchange.client.*` | On-chain truth: market status, outcome balances |
| Trader (writes) | `exchange.trader.*` | Writes the unified tier doesn't model — notably **redeeming a specific outcome** and precise price/quantity control |

Don't try to do everything through the unified tier — the redeem flow and
exact tick-grid pricing specifically require dropping to the trader tier.

## Core mechanics you need before writing any trading logic

- **One book, two sides.** Up and Down trade on a single order book, quoted
  in Up-probability terms (0,1). A Down price is always `1 − Up price` —
  reading the Down book is just the same book from the other side.
- **No naked shorts — inventory comes from minting.** You can only sell an
  outcome token you hold. New tokens come from `mintCompleteSet`: 1 USDso
  in → 1 Up + 1 Down out. `burnCompleteSet` reverses it.
- **Mint-a-pair is the cold-start/zero-inventory mechanism.** Two
  opposite-side buyers (Buy Up × Buy Down) need no seller at all — the pool
  mints a fresh pair from their combined collateral. This means **a resting
  Buy-Up at `p` plus a resting Buy-Down at `1−p` is already a complete
  two-sided quote with zero inventory** — directly relevant if your use
  case involves any market-making behavior.
- **Four crossing paths total:** Buy Up×Sell Up and Buy Down×Sell Down are
  direct token/collateral swaps; Buy Up×Buy Down mints a pair; Sell Up×Sell
  Down burns a pair and pays out both sellers their share.
- **Outcome tokens are one shared ERC-6909, not per-market ERC-20s.**
  Position balances are token *ids* on a single contract
  (`OutcomeToken6909`), read via `getOutcomeBalance(outcomeToken, address,
  id)` — not a standard `balanceOf` per market.

## Market lifecycle (numeric states — read the live status before every write)

```
Listed(0) → Trading(1) → Locked(2) → Resolved(4) | Voided(5)
```
- Only **Trading (1)** accepts new orders.
- **Locked (2)**: window ended, no new orders, but cancels still work —
  awaiting settlement price.
- **Resolved (4)**: winning side fixed, redeemable at 1 USDso/contract
  (0 settlement fee on DreamDEX).
- **Voided (5)**: no reliable settlement price found in the window — both
  sides redeem at 0.5.
- A `Settling(3)` state exists in the enum but is essentially never
  observable in practice.
- **The indexed/off-chain status lags the on-chain status by seconds** —
  always re-check `getMarketOnchain()` immediately before a write, don't
  trust a cached read.

## Settlement / resolution — fully permissionless, no keeper needed

Each market's settlement question is scheduled on an oracle hub at
creation, with resolution gas pre-reserved. When the oracle posts the
answer, Somnia's on-chain **Reactivity** precompile delivers it straight to
the hub's callback automatically — no cron job, no keeper, no operator
action required for the common case. Two permissionless backstops exist if
the automatic path is ever missed:
- `pokeOracle(questionId)` — anyone can manually pull a posted answer and
  resolve the market.
- `voidExpired()` — once the settlement window passes with no answer,
  anyone can call this to void the market (both sides redeem at 0.5).

**Auditability is a first-class, linkable feature.** Every market row
carries an `oracleQuestionId`. You can deep-link straight to that
question's resolution pipeline (every price source, its returned value, the
median, the minimum sources required) at:
```
https://prd.oracle.somnia.host/questions/{oracleQuestionId}?view=graph
```
This is explicitly flagged in the docs as *"worth surfacing in any
interface you build on top of event contracts"* — a strong, low-effort
trust/UX signal for a hackathon entry (Judging criteria: UX 20%, Business
Impact 20% both reward this kind of thing).

## The redeem gotcha ("the step people miss")

**A settled market disappears from `loadMarkets()`.** The registry sweep
behind `loadMarkets()` skips finalized binary markets entirely — so a naive
"scan active markets, redeem what's mine" bot will silently report nothing
to claim while real winnings sit unredeemed. The fix: query the client tier
directly for finalized markets —

```ts
const settled = await exchange.client.listBinaryMarkets({
  venueId,
  status: "Finalized",
  limit: 120,
});
```

Then redeem through the **trader** tier with an **explicit outcome index**
— the convenience redeem method infers the winner from the market, which is
meaningless on a voided market where both sides pay 0.5. Redeeming a losing
position doesn't revert — it succeeds and pays nothing, so check the
outcome before spending gas on it.

This single gotcha is a genuinely good candidate for a hackathon feature:
an interface/bot that correctly surfaces and auto-claims settled positions
is solving a real, documented, easy-to-miss problem — strong "business &
ecosystem impact" story (reduces unclaimed winnings, a real user pain
point).

## The pricing precision trap (read before sending any real order)

On an 18-decimal venue, `createOrder`'s naive price conversion
(`parseUnits(price.toFixed(18), 18)`) breaks for almost every realistic
probability — `(0.05).toFixed(18)` lands three wei off the tick grid and
gets rejected with `InvalidPrice`. Of fifteen ordinary probabilities tested,
only 0.25, 0.5, and 0.75 survive, because those are the only ones binary
floating point represents exactly. **This does not affect the 6-decimal
testnet collateral** — the trap is specific to 18-decimal venues.

Fix: snap price to a whole number of ticks yourself and send it as a
`bigint` through the trader tier:

```ts
const ONE = 10n ** 18n;                 // 1e6 on testnet instead
const TICK = 1_000_000_000_000_000n;    // 1e15 = 0.001 tick here
const ticks = (p: number) => BigInt(Math.round(p * Number(ONE / TICK))) * TICK;
const lots  = (q: number) => BigInt(Math.floor(q * Number(ONE / TICK) + 1e-9)) * TICK;

await exchange.trader.placeOrder({
  pool: onchain.pool,
  side: "BUY_YES",                 // or SELL_YES / BUY_NO / SELL_NO
  price: ticks(0.05),              // always in YES/Up terms — a NO/Down
                                    // price is `ONE - ticks(p)`
  quantity: lots(5),
  orderType: ORDER_TYPE.POST_ONLY, // LIMIT | MARKET (IOC) | FILL_OR_KILL | POST_ONLY
  expireTimestampNs: BigInt(Math.floor(Date.now()/1000) + 300) * 1_000_000_000n,
});
```

## Volume/analytics data (useful for an analytics-tool style entry)

Per-market volume is a direct read, not something you aggregate yourself:
`cumulativeQuoteVolume` (collateral, counts each fill once), `cumulativeBaseVolume`
(contracts traded), `tradeCount`, `lastPrice`, `lastTradeAt` are all fields
on `listBinaryMarkets` rows. Server-side sort options: `newest`,
`closingSoon`, `volume`, `tradeCount`. **Divide by the collateral's actual
decimals — 18 on mainnet USDso, 6 on the testnet faucet token** — this is a
second, separate place the decimal difference bites if missed.

For a quick ccxt-shaped view, `fetchTicker(outcomeSymbol)` returns
`baseVolume`/`quoteVolume` already scaled — no manual decimal math needed
for that path.

## No rate limits — a real architectural fact, not marketing

Market data *is* the chain itself, and public RPC is unthrottled. The
docs explicitly recommend: **snapshot once and stay current from on-chain
events/live watches**, rather than polling. This favors an event-driven
bot architecture over a polling loop — worth building correctly from the
start rather than retrofitting.

## Contract addresses (identical on testnet 50312 and mainnet 5031 — CREATE3 deploy)

| Contract | Address |
|---|---|
| BinaryMarketsModule | `0x3ecC694Cef705358864a646142ac17A90E29e388` |
| MarketsCore | `0x2802504314685D89bF6C992CA5a8e7cC78bc0294` |
| BinarySettlement | `0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23` |
| OutcomeToken6909 | `0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9` |
| OracleHub | `0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b` |
| CollateralRouter | `0xbC0C9834B15ACE38bB50dDaa7d7f7C7CC4DC183C` |

**Never hardcode per-market or per-pool addresses** — pools are recycled
across successive windows of a series; read them from the module registry
or SDK at runtime. These six core addresses are stable proxies (implementation
can upgrade, address doesn't move) — safe to hardcode only these six.

**Collateral differs by network, not just in decimals but in asset:**
mainnet uses real USDso (`0x00000022dA000002656c64D9eA6011ea952D008A`, 18
decimals); testnet uses a faucet-enabled test USDC (6 decimals) — a
different token, not just a different balance.

## Non-JS stacks

The SDK package exports raw ABIs (`binaryModuleReadAbi`,
`binaryModuleWriteAbi`, `binarySettlementAbi`, `erc6909Abi`,
`oracleHubAbi`) — usable from any RPC client if you're not building in
TypeScript.

## Known gaps still open

- The full realtime-watch and React-hooks surface is only in the npm
  package README, not fetched here — read it directly if your use case
  needs live streaming UI updates (very likely, given the UX judging
  criterion).
- The "Gotchas" doc page is referenced repeatedly ("Read the Gotchas before
  sending a real order") but wasn't itself pasted in — worth fetching next,
  it likely contains more traps beyond the pricing/redeem ones captured
  here.
- A pre-built **"dex-spot-router-interaction" Claude skill** is mentioned in
  the spot-router docs as "self-contained reference... any agent can load
  to integrate with the router without cloning the protocol repo" — this is
  for the *spot* router specifically, not Event Contracts, but worth
  checking whether an equivalent exists for markets-sdk / Event Contracts
  before building your own reference from scratch.
- Exact `dreambot-builder.vercel.app` behavior is still unresearched.

## Explicitly out of scope for this file

- Full spot SpotPool/SpotRouter contract API (separate product line,
  separate docs pages) — only relevant if a use case deliberately spans
  both spot and Event Contracts (e.g., a builder-fee-earning aggregator).
- Stop-order mechanics (`SpotStopOrderRegistry`) — spot-only feature, not
  applicable to Event Contracts' fixed-expiry structure.
