KasAgentV2 — Full Dependency Map

  Directory Overview (68+ files)

  KasAgentV2/
  ├── app/           8 files   Pages + API routes
  ├── components/   34 files   UI layer
  ├── config/       15 files   Chain, contracts, ABIs, wagmi
  ├── hooks/        13 files   On-chain data + UI state
  ├── lib/          23 files   Core logic, AI tools, utilities
  └── root configs   6 files   next, tsconfig, package, eslint, postcss

  ---
  Layer Architecture & Data Flow

  ┌─────────────────────────────────────────────────────────────┐
  │  CONFIG LAYER  (config/)                                    │
  │  chains, contracts, tokens, abis, wagmi                     │
  │  ↓ imported by everything below                             │
  ├─────────────────────────────────────────────────────────────┤
  │  LIB LAYER  (lib/)                                          │
  │  viem-client, env, supabase, format, validation, multicall  │
  │  discount, token-registry                                   │
  │  ↓                                                          │
  │  AI SUB-LAYER  (lib/ai/)                                    │
  │  system-prompt, serializers, tool-types, quick-actions       │
  │  tools/{swap,liquidity,farms,staking,yield,history,          │
  │         membership,spy,oracle}                               │
  ├─────────────────────────────────────────────────────────────┤
  │  HOOKS LAYER  (hooks/)                                      │
  │  Discovery: useAllPairs → useTokenRegistry                  │
  │             useActiveFarms, useInfinityPoolData              │
  │  Wallet:    useTokenBalances, useLpPositions,                │
  │             useFarmPositions, useStakingPositions             │
  │  Aggregator: usePortfolio                                    │
  │  UI State:   useSidebarState, useConversations,              │
  │              useAnimatedText, useReconnectOnFocus             │
  ├─────────────────────────────────────────────────────────────┤
  │  COMPONENTS  (components/)                                   │
  │  header/, sidebar/, chat/ (messages, cards, execution)       │
  ├─────────────────────────────────────────────────────────────┤
  │  APP LAYER  (app/)                                           │
  │  page.tsx (orchestrator)                                     │
  │  api/chat/          → AI streaming + tools                   │
  │  api/conversations/ → CRUD persistence                       │
  │  api/execution-states/ → tx state tracking                   │
  └─────────────────────────────────────────────────────────────┘

  ---
  Hook Dependency Tree

  Discovery (no wallet):
    useAllPairs ──────────┬──→ useTokenRegistry
                          └──→ useLpPositions
    useActiveFarms ───────────→ useFarmPositions
    useInfinityPoolData ──────→ useStakingPositions

  Wallet (requires address):
    useTokenRegistry ─────────→ useTokenBalances
    useAllPairs ──────────────→ useLpPositions
    useActiveFarms ───────────→ useFarmPositions
    useInfinityPoolData ──────→ useStakingPositions

  Aggregator:
    usePortfolio
      ├── useTokenBalances
      ├── useLpPositions
      ├── useFarmPositions
      └── useStakingPositions

  UI State (no chain deps):
    useConversations  (Supabase API calls)
    useSidebarState   (local state)
    useAnimatedText   (rAF animation)
    useReconnectOnFocus (wagmi reconnect)

  ---
  AI Tool → API Route → UI Data Flow

  User types message
    → ChatContainer.handleSubmit()
      → serializes portfolio + pools (bigint→string)
      → POST /api/chat  { walletAddress, messages, portfolio, infinityPools }
        → buildSystemPrompt(portfolio, pools)
          → calls token-registry (5-min cache)
          → calls checkDiscountEligibility()
          → returns 3-part prompt (static / protocol / wallet context)
        → streamText(claude-sonnet, aiTools, messages)
          → Claude calls tools (e.g. prepareSwap)
            → tool reads on-chain via viem-client
            → tool returns typed result
          → streamed back as tool parts
      → ChatContainer receives stream
        → ToolPartRenderer routes to correct card
          → Execution cards use wagmi hooks to write txs
          → ExecutionStateContext tracks state
          → POST /api/execution-states persists to Supabase
      → useConversations.saveConversation()
        → POST /api/conversations/save

  ---
  Protocol-Specific vs Protocol-Agnostic Classification

  PROTOCOL-SPECIFIC (ZealousSwap / Kasplex L2)

  These files contain hardcoded addresses, ABIs, or logic tied to the specific protocol:

  ┌───────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────┐
  │                     File                      │                                               Why                                               │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ config/contracts.ts                           │ All 10 contract addresses                                                                       │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ config/chains.ts                              │ Chain ID 202555, Kasplex RPC/explorer                                                           │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ config/tokens.ts                              │ KAS_NATIVE definition, TOKEN_LOGOS map                                                          │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ config/abis/*.ts                              │ All 11 ABI files (Router, Factory, MasterChef, InfinityPools, Discount, Membership, NFTStaking) │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ config/wagmi.ts                               │ Wired to kasplexL2 chain                                                                        │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ lib/discount.ts                               │ Calls DiscountManager contract                                                                  │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ lib/token-registry.ts                         │ Reads Factory.allPairs, pair details — assumes Uniswap-V2-style factory                         │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ lib/ai/system-prompt.ts                       │ "ZealousSwap" identity, protocol rules, token table                                             │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ lib/ai/tools/swap.ts                          │ WKAS routing, Router ABI calls, fee model (0.2%/0.3%)                                           │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ lib/ai/tools/liquidity.ts                     │ Router addLiquidity/removeLiquidity                                                             │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ lib/ai/tools/farms.ts                         │ MasterChef deposit/withdraw/claim                                                               │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ lib/ai/tools/staking.ts                       │ InfinityPool stake/unstake (ZEAL/NACHO/KASPER)                                                  │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ lib/ai/tools/yield.ts                         │ WKAS-based pricing, MasterChef + InfinityPool APY calc                                          │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ lib/ai/tools/membership.ts                    │ Membership + NFT staking contracts                                                              │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ lib/ai/tools/spy.ts                           │ Reads all protocol contracts for any wallet                                                     │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ lib/ai/tools/oracle.ts                        │ WKAS pair pricing                                                                               │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ lib/ai/tools/history.ts                       │ BlockScout explorer API, method selector labels                                                 │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ lib/ai/tools/helpers.ts                       │ findBestPath (WKAS hop), Router getAmountsOut                                                   │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ hooks/useAllPairs.ts                          │ Factory.allPairs enumeration                                                                    │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ hooks/useActiveFarms.ts                       │ MasterChef.getActivePools                                                                       │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ hooks/useInfinityPoolData.ts                  │ 3 InfinityPool contracts                                                                        │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ hooks/useFarmPositions.ts                     │ MasterChef.userInfo/pendingReward                                                               │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ hooks/useStakingPositions.ts                  │ InfinityPool xToken balances                                                                    │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ hooks/useLpPositions.ts                       │ Pair.balanceOf per LP                                                                           │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ hooks/useTokenRegistry.ts                     │ Factory pair discovery + ERC20 metadata                                                         │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ hooks/useTokenBalances.ts                     │ Reads token list from registry                                                                  │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ components/header/NetworkStatus.tsx           │ Checks chain ID 202555                                                                          │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ components/chat/cards/SwapExecutionCard.tsx   │ Router ABI calls for swaps                                                                      │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ components/chat/cards/AddLiquidityCard.tsx    │ Router ABI calls                                                                                │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ components/chat/cards/RemoveLiquidityCard.tsx │ Router ABI calls                                                                                │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ components/chat/cards/FarmStakeCard.tsx       │ MasterChef ABI                                                                                  │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ components/chat/cards/FarmUnstakeCard.tsx     │ MasterChef ABI                                                                                  │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ components/chat/cards/InfinityStakeCard.tsx   │ InfinityPool ABIs                                                                               │
  ├───────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ components/chat/cards/InfinityUnstakeCard.tsx │ InfinityPool ABIs                                                                               │
  └───────────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────┘

  PROTOCOL-AGNOSTIC (reusable across any EVM DeFi)

  ┌──────────────────────────────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────┐
  │                                       File                                       │                                    Why                                    │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ app/layout.tsx                                                                   │ Standard Next.js layout                                                   │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ app/providers.tsx                                                                │ Generic wagmi/RainbowKit/TanStack wrapper                                 │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ app/page.tsx                                                                     │ UI orchestration — could work with any portfolio hook                     │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ app/api/conversations/*.ts                                                       │ Generic CRUD — wallet-keyed chat persistence                              │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ app/api/execution-states/route.ts                                                │ Generic tx state tracking                                                 │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ app/api/chat/route.ts                                                            │ Generic AI streaming shell (tools are injected)                           │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ lib/env.ts                                                                       │ Env validation (zod)                                                      │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ lib/supabase.ts                                                                  │ Generic Supabase client                                                   │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ lib/format.ts                                                                    │ formatTokenAmount, shortenAddress — works for any EVM                     │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ lib/multicall.ts                                                                 │ Generic multicall result extractor                                        │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ lib/validation.ts                                                                │ ETH address regex                                                         │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ lib/viem-client.ts                                                               │ Generic viem client (chain injected from config)                          │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ lib/ai/serializers.ts                                                            │ Converts bigint→string (generic shape)                                    │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ lib/ai/tool-types.ts                                                             │ Type definitions only                                                     │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ lib/ai/quick-actions.ts                                                          │ Tool name → suggestion mapping                                            │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ lib/ai/tools/index.ts                                                            │ Re-export aggregator                                                      │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ hooks/usePortfolio.ts                                                            │ Aggregates sub-hooks (generic pattern)                                    │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ hooks/useConversations.ts                                                        │ API-backed conversation state                                             │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ hooks/useSidebarState.ts                                                         │ UI toggle state                                                           │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ hooks/useAnimatedText.ts                                                         │ Text animation                                                            │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ hooks/useReconnectOnFocus.ts                                                     │ Wagmi reconnect on tab focus                                              │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ components/chat/ChatInput.tsx                                                    │ Generic textarea + send                                                   │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ components/chat/ChatMessage.tsx                                                  │ Generic message renderer                                                  │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ components/chat/MessageList.tsx                                                  │ Auto-scroll message list                                                  │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ components/chat/AnimatedMarkdown.tsx                                             │ Streaming text animation                                                  │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ components/chat/MarkdownRenderer.tsx                                             │ Generic markdown display                                                  │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ components/chat/QuickActions.tsx                                                 │ Generic action buttons                                                    │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ components/chat/WelcomeScreen.tsx                                                │ Suggestion prompts (text is protocol-specific but structure is generic)   │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ components/chat/ExecutionStateContext.tsx                                        │ Generic state tracking context                                            │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ components/chat/cards/ToolCardSkeleton.tsx                                       │ Generic loading skeleton                                                  │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ components/chat/cards/ToolErrorCard.tsx                                          │ Generic error display                                                     │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ components/chat/cards/shared/ExecutionCardParts.tsx                              │ Reusable card UI primitives                                               │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ components/sidebar/ConversationList.tsx                                          │ Generic conversation list                                                 │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ components/sidebar/PortfolioSidebar.tsx                                          │ Generic tabbed sidebar (displays protocol data but structure is reusable) │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ components/header/AppHeader.tsx                                                  │ Generic header (wallet button, sidebar toggle)                            │
  ├──────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ Display cards (SwapQuoteCard, PriceCard, PoolReservesCard, FarmsTableCard, etc.) │ Render typed props — display-only, no ABI coupling                        │
  └──────────────────────────────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────────┘

  BOUNDARY FILES (thin adapter layer)

  ┌──────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────┐                                    │                 File                 │                                                 Role                                                 │
  ├──────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ components/chat/ToolPartRenderer.tsx │ Router — maps tool names to card components. This is the seam between protocol tools and generic UI. │
  ├──────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ components/chat/ChatContainer.tsx    │ Orchestrator — serializes protocol data for AI, manages execution state persistence.                 │
  └──────────────────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                                                                                                                                                     ---
  Key Insight

  The codebase has a clean separation. ~35 files are protocol-specific (config, ABIs, on-chain hooks, AI tools, execution cards) and ~33 files are protocol-agnostic (chat UI,
  persistence, layout, utilities). The boundary is thin — ToolPartRenderer and ChatContainer are the main adapter points. To support a new protocol you'd primarily need new         entries in config/, new tool modules in lib/ai/tools/, new execution cards, and updated hook implementations.