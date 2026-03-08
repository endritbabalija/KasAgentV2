 KasAgent UI Redesign: Structured Conversation + Bloomberg Light                                                                                                                   
 Context

 KasAgent is an AI DeFi Copilot for Kasplex L2. The user just finished F3 (AI Chat Interface) from the PRD. The current UI is a plain single-column chat — all AI responses render
  as markdown text blobs, tool invocation results are invisible to the user, and there's no persistent portfolio context. The goal is to transform this into a data-forward,
 card-based chat interface with a portfolio sidebar — combining Direction 4 (Structured Conversation) and Direction 1 (Bloomberg Light).

 The single highest-impact change: ChatMessage.tsx currently filters out tool invocation parts entirely (part.type === "text" only). The AI already calls tools like getSwapQuote,
  getActiveFarms, etc. that return structured data — we just need to render those results as visual cards instead of throwing them away.

 ---
 Phase 1: Structured AI Response Cards (Highest Impact)

 Render tool results as visual card components inline in the chat. No layout changes needed — this phase is self-contained.

 1.1 Create tool result type definitions

 New file: lib/ai/tool-types.ts

 Define TypeScript interfaces matching the exact return shapes from lib/ai/tools.ts:
 - SwapQuoteResult — { tokenIn, tokenOut, amountIn, amountOut, path, error? }
 - PoolReservesResult — { pair, pairAddress, reserveA, reserveB, totalLpSupply, error? }
 - ActiveFarmsResult — { rewardToken, rewardPerBlock, totalAllocPoint, farms[], error? }
 - InfinityPoolRatesResult — { pools[], error? }

 1.2 Create card components

 New directory: components/chat/cards/

 Each card has 3 states: loading (tool in progress), success (result available), error.

 ┌─────────────────────────────────┬──────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │            New File             │     Renders For      │                                             Visual Design                                             │
 ├─────────────────────────────────┼──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ cards/SwapQuoteCard.tsx         │ getSwapQuote         │ Two token symbols with amounts, arrow between them, price ratio footer. Teal/cyan accent for amounts. │
 ├─────────────────────────────────┼──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ cards/PoolReservesCard.tsx      │ getPoolReserves      │ Pair name header, reserve amounts for each token, total LP supply.                                    │
 ├─────────────────────────────────┼──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ cards/FarmsTableCard.tsx        │ getActiveFarms       │ "Active Farms" header, table with Pool ID, Alloc %, Total Deposited, reward info.                     │
 ├─────────────────────────────────┼──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ cards/InfinityPoolRatesCard.tsx │ getInfinityPoolRates │ 3 mini-cards in a row (ZEAL, NACHO, KASPER) showing exchange rate + total staked.                     │
 ├─────────────────────────────────┼──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ cards/ToolCardSkeleton.tsx      │ Any tool (loading)   │ Pulsing skeleton with humanized label ("Fetching swap quote...").                                     │
 ├─────────────────────────────────┼──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ cards/ToolErrorCard.tsx         │ Any tool (error)     │ Red-tinted card with error message.                                                                   │
 └─────────────────────────────────┴──────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────┘

 Styling: Cards use bg-zinc-800/80 border border-zinc-700/50 rounded-xl — visually distinct from text bubbles. Data values use font-mono text-teal-400 for emphasis. Token symbols
  reference TOKEN_BY_SYMBOL from config/tokens.ts for names. No token images (they don't exist in public/tokens/ yet) — use text symbols with colored circles as placeholders.

 1.3 Create tool part dispatcher

 New file: components/chat/ToolPartRenderer.tsx

 Takes a tool part and dispatches to the correct card based on toolName:
 - Check part state → show skeleton if still loading
 - Check for error → show error card
 - Switch on toolName → render specific card
 - Unknown tools → fallback JSON display

 1.4 Rewrite ChatMessage to render all parts

 Modify: components/chat/ChatMessage.tsx

 Current: extracts ALL text, concatenates, renders once. Tool parts are discarded.

 New: iterate through message.parts in order:
 - type === "text" → render with MarkdownRenderer (as before, in its own bubble)
 - Tool invocation parts → render via ToolPartRenderer (as inline card)
 - User messages unchanged (text-only bubble)

 This means an AI response like "Here's the quote: [tool result] As you can see..." renders as: text bubble → swap card → text bubble. Natural conversation flow with structured
 data interspersed.

 Note: AI SDK v6 tool parts may use type: "tool-invocation" with toolInvocation property. Will verify exact type at build time and handle accordingly.

 ---
 Phase 2: Portfolio Sidebar (Bloomberg Light)

 2.1 Extract shared utility

 New file: lib/token-utils.ts

 Extract getTokenSymbol(address) function (currently duplicated in PortfolioDashboard.tsx:11 and lib/ai/serializers.ts:14).

 Modify: lib/ai/serializers.ts and components/PortfolioDashboard.tsx — import from shared location.

 2.2 Create sidebar state hook

 New file: hooks/useSidebarState.ts

 Simple useState toggle: { isOpen, toggle, open, close }. Default open on desktop.

 2.3 Create PortfolioSidebar component

 New file: components/sidebar/PortfolioSidebar.tsx

 Adapts rendering patterns from the existing components/PortfolioDashboard.tsx into a narrow sidebar format:

 - Fixed width w-72 when open, w-0 when collapsed with transition-all duration-300
 - Toggle button persists when collapsed (small icon button on the edge)
 - Sections: Token Balances, LP Positions, Farm Positions, Staking Positions
 - Uses formatTokenAmount from lib/format.ts and getTokenSymbol from new lib/token-utils.ts
 - Accepts portfolio data as props (doesn't call hooks itself)
 - Shows "Connect Wallet" prompt when not connected

 2.4 Restructure page layout

 Modify: app/page.tsx

 Lift usePortfolio() and useInfinityPoolData() calls from ChatContainer to page.tsx so data is available for both sidebar and chat.

 New layout:
 <div h-screen flex flex-col>
   <AppHeader />
   <div flex-1 flex overflow-hidden>
     <PortfolioSidebar />
     <main flex-1 overflow-hidden>
       <ChatContainer />  // receives portfolio as props now
     </main>
   </div>
 </div>

 2.5 Refactor ChatContainer to accept props

 Modify: components/chat/ChatContainer.tsx

 - Remove internal usePortfolio() and useInfinityPoolData() calls
 - Accept portfolio and pools as props
 - Keep serialization refs and transport creation logic (chat-specific)

 2.6 Add readable width constraint to messages

 Modify: components/chat/MessageList.tsx

 Add max-w-3xl mx-auto wrapper inside the scrollable area so messages stay readable when chat area expands (sidebar takes away width).

 ---
 Phase 3: Enhanced Header

 3.1 Create NetworkStatus component

 New file: components/header/NetworkStatus.tsx

 - Green pulsing dot + "Kasplex L2" when connected to chain 202555
 - Orange dot + "Wrong Network" when on wrong chain
 - Gray dot + "Disconnected" when no wallet
 - Uses useAccount() and useChainId() from wagmi

 3.2 Create AppHeader component

 New file: components/header/AppHeader.tsx

 Layout: [Sidebar Toggle] [KasAgent logo] ... [NetworkStatus] [KAS Balance pill] [ConnectButton]

 - Sidebar toggle: hamburger/chevron icon button
 - KAS balance: prominent pill showing XX.XXXX KAS from portfolio data
 - Accepts props: { portfolio, onSidebarToggle, isSidebarOpen }

 3.3 Replace inline header in page.tsx

 Modify: app/page.tsx

 Replace the current <header> block (lines 9-12) with <AppHeader />.

 ---
 Phase 4: Quick Action Buttons

 4.1 Define quick actions per tool

 New file: lib/ai/quick-actions.ts

 Map toolName + output → suggested follow-up actions:
 - getSwapQuote → "Check staking rates for [tokenOut]", "Find better rate"
 - getPoolReserves → "Check farms for this pair"
 - getActiveFarms → "Compare with staking"
 - getInfinityPoolRates → "Best yield opportunity"

 Each action is { label: string, message: string } — clicking sends the message to the AI.

 4.2 Create QuickActions component

 New file: components/chat/QuickActions.tsx

 Horizontal row of pill buttons, styled like WelcomeScreen suggestion chips. Only shown after the last AI message when not loading.

 4.3 Wire into MessageList

 Modify: components/chat/MessageList.tsx

 - Add onSendMessage prop
 - After the last assistant message, extract tool parts → generate quick actions → render QuickActions

 Modify: components/chat/ChatContainer.tsx

 - Pass handleSubmit to MessageList as onSendMessage

 ---
 Implementation Order

 Phase 1 (Cards)  →  Phase 2 (Sidebar)  →  Phase 3 (Header)  →  Phase 4 (Quick Actions)

 Each phase is independently deployable. Phase 1 is the highest-impact, lowest-risk change.

 File Summary

 New files (14):
 - lib/ai/tool-types.ts
 - lib/ai/quick-actions.ts
 - lib/token-utils.ts
 - hooks/useSidebarState.ts
 - components/chat/ToolPartRenderer.tsx
 - components/chat/QuickActions.tsx
 - components/chat/cards/SwapQuoteCard.tsx
 - components/chat/cards/PoolReservesCard.tsx
 - components/chat/cards/FarmsTableCard.tsx
 - components/chat/cards/InfinityPoolRatesCard.tsx
 - components/chat/cards/ToolCardSkeleton.tsx
 - components/chat/cards/ToolErrorCard.tsx
 - components/sidebar/PortfolioSidebar.tsx
 - components/header/AppHeader.tsx
 - components/header/NetworkStatus.tsx

 Modified files (5):
 - components/chat/ChatMessage.tsx — iterate all parts, render tool cards
 - components/chat/MessageList.tsx — add max-w constraint, add onSendMessage prop, render quick actions
 - components/chat/ChatContainer.tsx — accept portfolio/pools as props, pass sendMessage down
 - app/page.tsx — lift hooks, add sidebar + header, flex layout
 - lib/ai/serializers.ts — import getTokenSymbol from shared util

 Verification

 After each phase:
 1. npm run build — verify no TypeScript errors
 2. Run the app, connect wallet, send a chat message that triggers tool calls (e.g., "What can I do with my tokens?" triggers pool/farm lookups)
 3. Phase 1: Verify tool results render as cards inline between text
 4. Phase 2: Verify sidebar shows portfolio data, collapses/expands, chat still works
 5. Phase 3: Verify header shows network status and KAS balance
 6. Phase 4: Verify quick action buttons appear after tool responses and send messages on click