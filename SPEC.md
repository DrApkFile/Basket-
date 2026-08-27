# SPEC.md — Basket: AI-Constructed Risk-Smoothed Event Contract Baskets

Built for: Somnia × DreamDEX Event Contracts Hackathon (testnet submission)

## What it does

Lets a user express a directional view (e.g. "BTC will trend up this
week") as a basket of several correlated DreamDEX Event Contract windows
instead of one all-or-nothing bet. An AI agent selects which live windows
to combine and their weights, shows its reasoning and worst-case exposure
before purchase, then narrates the basket's live state in plain language
as individual legs settle.

## Who it's for

Retail users who want directional exposure without single-window
all-or-nothing variance — the same instinct behind a sports parlay,
applied to on-chain, permissionlessly-resolved prediction markets.

## Prior art / honesty note

Structured/basket products for prediction markets are NOT novel in
general (Senthos, Cesto — both Solana, both funded). What's genuinely new
here is doing this specifically for DreamDEX/Somnia Event Contracts, with
an AI layer that shows its reasoning rather than acting as a black box.
Do not claim first-of-its-kind in the write-up beyond that specific scope.

## Core mechanic

1. User states a view + risk tolerance (simple form, not free text for v1).
2. Server-side AI constructor (see Stack below) queries live Trading-status
   markets for the relevant asset via the SDK, selects N windows, returns
   structured reasoning: why these windows (timing spread across expiries,
   not fake diversification within one identical window), combined
   worst-case and best-case payout.
3. User reviews and approves → app places N orders via `placeOrders`
   (batch), tracking each `marketId` under one `basketId` in Firestore.
4. AI monitor (also server-side) watches each leg's on-chain status; as
   legs resolve, produces plain-language basket status updates ("3 of 5
   settled, net +12%, 2 pending") pushed to the client via Firestore
   `onSnapshot`.
5. On full settlement, app surfaces a one-click redeem flow covering all
   legs — using the explicit-outcome-index redeem pattern from the
   knowledge base (remember: settled markets vanish from `loadMarkets()`,
   query `listBinaryMarkets({status:"Finalized"})` directly instead).

## Stack

- **Frontend/backend:** Next.js (App Router)
- **Chain interaction:** `@somnia-chain/markets-sdk` (>=0.25.0 — hard
  version floor, older versions can't read markets at all) + `viem`
- **AI:** Gemini API, called **server-side only**, via two separate Next.js
  API routes — never from the client:
  - `POST /api/basket/construct` — takes user's view + risk tolerance,
    server fetches live on-chain market state itself (never trusts
    client-supplied market data), calls Gemini with structured/JSON output
    mode for window selection + reasoning, returns the proposal to the
    client for approval.
  - `POST /api/basket/narrate` — takes a basketId, server reads current
    on-chain leg statuses itself, calls Gemini to produce the plain-
    language status update, writes result to Firestore.
  - Gemini API key lives in server env vars only, never exposed to the
    client bundle.
- **State:** Firestore — `baskets/{basketId}` documents with a
  `legs/{marketId}` subcollection. Firestore is a **UI cache synced FROM
  on-chain reads** — never the reverse. All writes happen only after the
  server has independently verified on-chain status via
  `getMarketOnchain()`. The client never writes basket/leg status directly.
- **Auth:** Firebase Auth (anonymous auth is sufficient for hackathon
  scope) — used to scope baskets to a user, not for security-critical
  logic.

## Custody / risk

- No custody beyond a normal DreamDEX order — user signs each transaction
  from their own wallet (MetaMask or equivalent). No session keys / no
  autonomous signing in v1 — keep this simple and safe for the timeline.
- Hard constraint enforced in code (server-side, not just prompted): the
  AI constructor can only select from windows the server itself fetched as
  currently `Trading` status, and cannot exceed a max basket size or a
  max total spend passed in by the user.

## Explicitly out of scope (v1)

- No new smart contract, no atomic on-chain basket settlement — baskets
  are an application-layer grouping over independent Event Contracts.
- No cross-asset correlation modeling — same-asset sequential windows only
  for v1. Don't overclaim sophisticated correlation math that isn't
  actually validated.
- No mainnet deployment — testnet (Somnia Shannon, chain ID 50312) only.
- No free-text risk input in v1 — structured form (asset, number of
  windows, max spend, risk slider) to keep the AI's job well-bounded.

## What "done" looks like for the demo

One full basket lifecycle recorded end to end: construction with visible
AI reasoning → user approval → on-chain batch order placement → at least
one leg settling live during the demo window with a narrated status
update → full redeem.

## Build phases (for Claude Code — stop for sign-off between each)

1. **SDK plumbing only.** Connect to testnet, discover live markets, read
   a book, place/cancel one manual test order. No AI, no Firebase yet.
2. **Batch orders + Firestore state**, still no AI — hardcode which
   windows go in a test basket, verify the redeem flow works end to end
   on a market you manually let expire.
3. **AI constructor** — `/api/basket/construct`, structured output,
   enforced constraints (live markets only, max spend/size).
4. **AI monitor** — `/api/basket/narrate` + Firestore `onSnapshot` wiring
   to the frontend.
5. **UI polish** — this is where UX (20% of judging) is won or lost.
6. **Demo recording + SDK/docs feedback report.**

For every security- or correctness-relevant decision (order quantization,
redeem outcome-index logic, the never-trust-client-Firestore rule),
explain it back in plain language before moving to the next phase.
