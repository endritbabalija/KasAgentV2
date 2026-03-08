 Codebase Health Report
                                                                                                                                                                                                   Total codebase: ~4,000 lines of app code (excluding ABIs). It's in good shape overall — no major rot, no dead files. But there are clear patterns of copy-paste duplication that'll compound as   you build Phase 2.

  ---
  The Issues (Ranked)

  Tier 1 — Copy-Paste Duplication (biggest smell)

  ┌─────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────┐
  │            What             │                                          Where                                           │                Copies                │
  ├─────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
  │ formatAmount()              │ 7 card components + 1 shared export they ignore                                          │ 8x                                   │
  ├─────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
  │ TokenBadge component        │ SwapQuoteCard, SwapExecutionCard + shared export                                         │ 3x                                   │
  ├─────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
  │ shortenAddress()            │ lib/format.ts, ExecutionCardParts.tsx, TransactionHistoryCard.tsx, SwapExecutionCard.tsx │ 4x (with different implementations!) │
  ├─────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
  │ Gas estimation try/catch    │ swap, liquidity(2x), farms(2x), staking(2x)                                              │ 7x                                   │
  ├─────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
  │ Slippage calculation        │ swap, liquidity(2x)                                                                      │ 3x                                   │
  ├─────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
  │ Allowance check pattern     │ swap, liquidity(2x), farms, staking(2x)                                                  │ 6x                                   │
  ├─────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
  │ addrToSym inline function   │ farms.ts lines 143 and 280                                                               │ 2x (identical)                       │
  ├─────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
  │ getPair + getReserves chain │ swap, liquidity(2x), helpers, yield                                                      │ 5x                                   │
  └─────────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────┘

  Tier 2 — Dead Code

  ┌────────────────────────┬───────────────────────────────────────────────┐
  │          What          │                     Where                     │
  ├────────────────────────┼───────────────────────────────────────────────┤
  │ TOKEN_BY_SYMBOL export │ config/tokens.ts:49-51 — never imported       │
  ├────────────────────────┼───────────────────────────────────────────────┤
  │ ActionButtons export   │ ExecutionCardParts.tsx — never used           │
  ├────────────────────────┼───────────────────────────────────────────────┤
  │ Debug console.log      │ api/chat/route.ts:22-23 — logs wallet address │
  └────────────────────────┴───────────────────────────────────────────────┘

  Tier 3 — Minor Smells

  - RPC URL hardcoded in 2 places (chains.ts + wagmi.ts)
  - usePortfolio only checks errors from 2 of 4 sub-hooks
  - yield.ts is a single 402-line function
  - No request body validation in API route
  - fmt() wrapper in serializers.ts adds nothing over formatUnits()

  ---
  Phased Strategy

  Each phase is one focused session, touching a small set of files, easily fits in context.

  Phase 1: Card Component Cleanup (~15 min)

  Files: 8 card components + ExecutionCardParts.tsx

  - Delete duplicate formatAmount() from 7 cards → import from shared
  - Delete duplicate TokenBadge from SwapQuoteCard + SwapExecutionCard → import from shared
  - Delete duplicate shortenAddress() from TransactionHistoryCard → import from lib/format.ts
  - Delete unused ActionButtons from ExecutionCardParts
  - ~130 lines removed, zero behavior change

  Phase 2: Tool Helper Extraction (~25 min)

  Files: helpers.ts + swap.ts + liquidity.ts + farms.ts + staking.ts

  - Extract estimateGasCost(gasUnits, fallback) → replace 7 identical try/catch blocks
  - Extract calculateMinAmount(rawAmount, slippagePercent) → replace 3 slippage calcs
  - Extract checkAllowance(token, owner, spender, amount) → replace 6 allowance patterns
  - Move addrToSym to helpers (delete the duplicate in farms.ts)
  - ~200 lines removed, cleaner tool files

  Phase 3: Dead Code + Small Fixes (~10 min)

  Files: config/tokens.ts, api/chat/route.ts, usePortfolio.ts

  - Delete TOKEN_BY_SYMBOL from tokens.ts
  - Remove debug console.log from API route
  - Fix usePortfolio error propagation (add missing 2 hooks to isError check)
  - Quick wins, minimal risk

  Phase 4 (optional): yield.ts Decomposition (~20 min)

  Files: yield.ts only

  - Break 402-line function into: fetchOnChainData(), derivePrices(), buildOpportunities(), rankAndFilter()
  - No behavior change, just readability
  - Only do this if you plan to extend yield logic for Phase 2

  ---
  What I'd NOT do

  - Don't extract useWaterfallFetch or generic hook abstractions — you have 2 hooks using the pattern, not 10. Wait until you feel the pain.
  - Don't centralize the RPC URL — it's in 2 places and won't change often.
  - Don't add Zod validation to the API route — your client is your own app.
  - Don't create a CardWrapper component — the Tailwind classes are fine inline.