Frontend Code Health Report
                                                                                                                                                                                     Tier 1 — Execution Card Duplication (Critical, ~300+ lines)                                                                                                                                                                                                                                                                                                           All 7 execution cards (SwapExecution, AddLiquidity, RemoveLiquidity, FarmStake, FarmUnstake, InfinityStake, InfinityUnstake) copy-paste:                                                                                                                                                                                                                              ┌────────────────────────────────────────────────────────────────────────────────┬────────┐                                                                                        │                                      What                                      │ Copies │                                                                                        ├────────────────────────────────────────────────────────────────────────────────┼────────┤
  │ State machine (idle → approving → action → success/error/cancelled)            │ 7x     │
  ├────────────────────────────────────────────────────────────────────────────────┼────────┤                                                                                        │ handleExecute() / handleRetry() / error parsing logic                          │ 7x     │                                                                                        ├────────────────────────────────────────────────────────────────────────────────┼────────┤                                                                                        │ Confirm button classes (bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-700...) │ 7x     │                                                                                        ├────────────────────────────────────────────────────────────────────────────────┼────────┤                                                                                        │ Cancel button classes                                                          │ 7x     │                                                                                        ├────────────────────────────────────────────────────────────────────────────────┼────────┤
  │ Loading spinner (h-3.5 w-3.5 rounded-full border-2...animate-spin)             │ 7x     │
  ├────────────────────────────────────────────────────────────────────────────────┼────────┤
  │ Card wrapper (bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4)         │ 14x    │
  ├────────────────────────────────────────────────────────────────────────────────┼────────┤
  │ Connect wallet / success / error conditional rendering                         │ 7x     │
  └────────────────────────────────────────────────────────────────────────────────┴────────┘

  Fix: A single ExecutionCardTemplate component that owns the state machine + button area, and each card just provides its content and transaction config.

  Tier 2 — SwapExecutionCard is the worst offender

  SwapExecutionCard.tsx (317 lines) reimplements inline what ExecutionCardParts.tsx already exports:
  - riskBannerColors / riskIconColors — duplicated at lines 11-21
  - Risk flag rendering — duplicated at lines 186-209 (should use RiskFlagList)
  - Contract accordion — duplicated at lines 212-246 (should use ContractInfoAccordion)
  - Success/error states — duplicated at lines 254-281 (should use SuccessState / ErrorState)

  This was likely the first card built before shared parts existed, and never got updated.

  Tier 3 — Formatter & Color Map Duplication

  ┌───────────────────────────────────┬────────────────────────────────────────────────────┬────────────────────────────┐
  │               What                │                       Where                        │           Copies           │
  ├───────────────────────────────────┼────────────────────────────────────────────────────┼────────────────────────────┤
  │ formatAmount()                    │ ExecutionCardParts, TransactionHistoryCard (local) │ 2x                         │
  ├───────────────────────────────────┼────────────────────────────────────────────────────┼────────────────────────────┤
  │ formatKas() (same logic)          │ YieldOpportunitiesCard (local)                     │ variant                    │
  ├───────────────────────────────────┼────────────────────────────────────────────────────┼────────────────────────────┤
  │ tokenColors Record                │ ExecutionCardParts, TransactionHistoryCard         │ 2x identical               │
  ├───────────────────────────────────┼────────────────────────────────────────────────────┼────────────────────────────┤
  │ riskBannerColors + riskIconColors │ ExecutionCardParts, SwapExecutionCard              │ 2x identical               │
  ├───────────────────────────────────┼────────────────────────────────────────────────────┼────────────────────────────┤
  │ shortenAddress()                  │ ExecutionCardParts, lib/format.ts                  │ 2x (leftover from Phase 1) │
  └───────────────────────────────────┴────────────────────────────────────────────────────┴────────────────────────────┘

  Tier 4 — Minor Smells

  - Hook patterns: All data hooks repeat the same isLoading: a || b || c and refetch aggregation — not painful yet with ~5 hooks, but will be if Phase 2 adds more
  - TransactionHistoryCard (253 lines): Has 4 inline sub-components + local formatters, could be split
  - ToolCardSkeleton (30 lines) and ToolErrorCard (11 lines) are separate files — fine for now

  ---
  What I'd do (and what I wouldn't)

  Do (in order of impact):
  1. Refactor SwapExecutionCard to use existing shared parts (RiskFlagList, ContractInfoAccordion, SuccessState, ErrorState, CancelledState) — biggest single win, ~100 lines
  removed
  2. Extract ExecutionCardTemplate — a wrapper component that handles the state machine, buttons, wallet check, and success/error/cancel rendering. Each card just renders its
  content
  3. Centralize formatters — move formatAmount, formatKas, formatApy, timeAgo to lib/format.ts
  4. Centralize color maps — single tokenColors and riskColors export in shared parts

  Don't:
  - Don't create a generic <Button variant="primary"> component — Tailwind classes inline are fine at this scale
  - Don't abstract the hook loading/error pattern — you have 5 hooks, not 50
  - Don't merge ToolCardSkeleton/ToolErrorCard — small standalone files are fine
  - Don't split TransactionHistoryCard into multiple files — its sub-components are tightly coupled