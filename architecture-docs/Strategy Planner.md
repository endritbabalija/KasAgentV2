Multi-Step Strategy Planner with Sequential Execution

  Right now KasAgent is a brilliant one-shot DeFi assistant — the user asks for one thing, the AI calls one tool, the user signs one transaction. But real DeFi is multi-step. To
  go from holding KAS to farming the highest-yield opportunity, today the user needs 4 separate conversation turns:

  1. "Find the best yield" → read the YieldOpportunities card
  2. "Swap half my KAS to USDT" → approve + sign
  3. "Add liquidity to KAS/USDT" → approve + sign
  4. "Stake my LP in the farm" → approve + sign

  The Strategy Planner collapses this to one intent:

  ▎ "Put 1000 KAS into the highest-yield farm"

  The AI responds with a StrategyPlanCard showing all steps with estimated amounts, fees, and expected APR. User clicks "Execute Strategy". Steps execute sequentially — each
  waiting for the prior tx to confirm, feeding real outputs (actual swap amounts, LP tokens received) into the next step. One intent, one approval flow, full autonomy.

  Why this is the smartest move:

  - It's what makes an "agent" an agent. Every other DeFi chatbot is just a tool-calling wrapper. Multi-step planning is the gap between "chatbot with DeFi tools" and "autonomous
  DeFi copilot." This is the differentiator.
  - It leverages 100% of existing infrastructure. Every step in a strategy maps to a tool you already have. The strategy planner is an orchestration layer on top, not a rewrite.
  Swap → AddLiquidity → FarmStake are all tools with cards already built.
  - It unlocks combinatorial value. 20 tools used individually = 20 features. 20 tools composed into strategies = unlimited features. "Unwind my worst-performing farm and move it
  to the best one" becomes a single conversation.
  - It's the hardest thing for competitors to copy. The planning intelligence requires deep integration between AI reasoning, on-chain data, and transaction sequencing. It's not
  something you can bolt on — it requires the exact architecture you've already built.

  What it looks like architecturally:

  New tool:   createStrategy (AI plans steps from existing tools)
  New card:   StrategyPlanCard → StrategyExecutionCard
  New lib:    lib/ai/strategy.ts (step sequencing, output chaining)

  Each step in the plan is a reference to an existing tool (e.g., zealous_prepareSwap, zealous_prepareAddLiquidity, zealous_prepareFarmStake). The StrategyExecutionCard runs them
  in sequence, passing real tx results forward. The AI handles the planning; the existing tools handle the execution.

  Example strategies it enables out of the box:

  ┌───────────────────────────────────────────────────┬────────────────────────────────────────────────────────────┐
  │                     User says                     │                     Steps the AI plans                     │
  ├───────────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
  │ "Farm 1000 KAS at the best yield"                 │ swap → addLiquidity → farmStake                            │
  ├───────────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
  │ "Exit my USDT/KAS farm and go all-in on KAS"      │ farmUnstake → removeLiquidity → swap                       │
  ├───────────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
  │ "Move my liquidity from ZealousSwap to KrokoSwap" │ removeLiquidity → kroko_prepareSwap (or addLiq on kroko)   │
  ├───────────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
  │ "Rebalance: sell my worst token and stake KAS"    │ swap → infinityStake                                       │
  ├───────────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
  │ "Unwind everything and convert to KAS"            │ farmUnstake → removeLiquidity → infinityUnstake → swap × N │
  └───────────────────────────────────────────────────┴────────────────────────────────────────────────────────────┘

  What Already Works

  The AI can already chain tools. route.ts:68 has stopWhen: stepCountIs(5), meaning Claude can call up to 5 tools sequentially in a single response. It sees each tool's output
  before calling the next. So Claude could today do: discoverYield → prepareSwap → prepareAddLiquidity → prepareFarmStake — all in one streamed response, producing 4 cards.

  The system prompt just doesn't tell it to. Every behavior rule in system-prompt.ts is single-action: "when the user wants to swap, use X." No strategy chaining instructions
  exist.

  The Real Blocker: Stale Amounts

  Here's the problem that killed my original pitch's simplicity:

  1. Claude calls zealous_prepareSwap(500 KAS → USDT) — gets amountOut: "1234.56 USDT"
  2. Claude uses that to call zealous_prepareAddLiquidity(500 KAS + 1234.56 USDT) — gets estimatedLpTokens: "789.01"
  3. Claude calls zealous_prepareFarmStake(789.01 LP, PID 3)
  4. All 3 execution cards render in the chat

  But the user hasn't signed anything yet. All amounts are estimates. When they finally click "Execute" on card 1, the actual swap might yield 1230 USDT (price moved). Now card 2
  says "add 1234.56 USDT" — which they don't have. Card 2 fails.

  The cards are islands — each manages its own idle → approving → executing → success state via useWriteContract. ExecutionStateContext only tracks {state, txHash} per toolCallId.
   No card reads another card's result. No card can re-prepare itself with fresh amounts.

  Three Real Options

  Option A: Conversational Multi-Turn (smallest change, reliable)

  - Add strategy instructions to the system prompt
  - Claude presents the full plan as text, then prepares only step 1
  - User executes → portfolio.refetch() fires (already happens on success at ChatContainer.tsx:116)
  - User clicks a "Continue strategy" quick-action button → new request
  - New request carries fresh portfolio (balances updated) → Claude prepares step 2 with real amounts
  - Repeat until done

  Pros: Amounts are always accurate. Uses 100% existing architecture. Quick to ship.
  Cons: Multiple conversation turns. User clicks "Continue" between each step.

  Option B: StrategyExecutionCard (big build, best UX)

  - New createStrategy tool that returns a structured multi-step plan
  - New StrategyExecutionCard component that:
    - Renders a visual step pipeline
    - "Execute Strategy" button
    - After step 1 tx confirms → parses receipt logs for actual amounts → calls server API to re-prepare step 2 → auto-executes step 2 → repeat
    - Handles partial failure (step 1 succeeded, step 2 failed — shows state)
  - Needs a new /api/strategy/prepare-step endpoint for dynamic re-preparation

  Pros: One-click execution of entire multi-step flows. Best UX.
  Cons: Significant new code (~500-700 lines). Receipt parsing per action type. New API. Complex error states.

  Option C: Hybrid Plan Card + Guided Turns (moderate build, good UX)

  - New planStrategy tool → returns a read-only StrategyPlanCard (no execution, just visualization)
  - Plan card shows numbered steps with estimated amounts and a "Start Execution" button
  - Button sends step 1 as a chat message → Claude prepares it with fresh data → execution card renders
  - After success, quick-action: "Next: Add Liquidity" → fresh preparation → execute
  - Plan card updates visually (step 1 checkmark, step 2 active)

  Pros: Visual plan + accurate amounts. Moderate code. Graceful failure (user just stops).
  Cons: Still multi-turn, but guided with visual progress.

  ---
  My Recommendation

  Option C is the sweet spot — it's the one that delivers 80% of the "wow" factor of Option B at 30% of the cost, with zero stale-amount risk. The plan card makes it feel like a
  unified strategy, the quick-actions make it smooth, and every step uses fresh on-chain data.