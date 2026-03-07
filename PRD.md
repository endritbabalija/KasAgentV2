# KasAgent — Product Requirements Document

> **AI DeFi Copilot for Kasplex L2**
> Version 1.2 · March 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [Target Users & Personas](#4-target-users--personas)
5. [Product Phases & Roadmap](#5-product-phases--roadmap)
6. [Detailed Feature Specs (Phase 1 MVP)](#6-detailed-feature-specs-phase-1-mvp)
7. [User Flows](#7-user-flows)
8. [Technical Architecture](#8-technical-architecture)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Success Metrics & KPIs](#10-success-metrics--kpis)
11. [Risks & Mitigations](#11-risks--mitigations)
12. [Dependencies & Assumptions](#12-dependencies--assumptions)
13. [Out of Scope (Phase 1)](#13-out-of-scope-phase-1)
14. [UI/UX Design System](#14-uiux-design-system)
15. [Key Implementation Decisions](#15-key-implementation-decisions)
16. [Open Questions](#16-open-questions)

---

## 1. Executive Summary

**Product Name:** KasAgent

**One-Liner:** An AI-powered DeFi copilot that lets you manage your crypto portfolio through natural language on Kasplex L2.

**Vision Statement:** DeFi today is complex, fragmented, and intimidating. KasAgent removes the complexity by putting an intelligent assistant between the user and the blockchain. Instead of navigating multiple dApps, reading contract ABIs, and manually hunting for yield, users simply ask — and the AI analyzes, suggests, explains, and executes. KasAgent starts as a copilot for Kasplex L2 and evolves into an autonomous wallet agent that manages DeFi strategies on the user's behalf.

**Platform:** Web application (browser-based chat UI with wallet connection).

**Initial DEX Integration:** ZealousSwap (Uniswap V2 fork on Kasplex L2).

---

## 2. Problem Statement

### Current DeFi UX Pain Points

- **Manual protocol discovery** — Users must find and evaluate DeFi protocols on their own, across scattered interfaces with no unified entry point.
- **Fragmented yield information** — Yield opportunities (LP farming, staking, infinity pools) are spread across different dApps and dashboards with no aggregated view.
- **Opaque transactions** — Users are asked to sign transactions they don't fully understand. Token amounts, fees, slippage, and risks are buried in raw contract data.
- **Unclear smart contract risk** — There is no plain-language risk assessment before execution. Users either trust blindly or avoid DeFi entirely.
- **Constant monitoring required** — Portfolio management, reward harvesting, and position rebalancing demand continuous manual attention.

### Impact

| Impact Area | Effect |
|---|---|
| **Capital Efficiency** | Users leave funds idle because they can't find or evaluate opportunities |
| **User Frustration** | Complexity drives users away from DeFi or into costly mistakes |
| **Adoption** | The Kasplex L2 ecosystem loses potential users who are intimidated by the UX |
| **Ecosystem Growth** | Protocols on Kasplex receive less liquidity and fewer users than they could |

---

## 3. Solution Overview

### AI DeFi Copilot

KasAgent is an AI-powered chat interface that connects to the user's wallet and acts as a financial assistant for all DeFi activity on Kasplex L2.

### How It Works

1. **User connects wallet** — KasAgent reads token balances, LP positions, and staking data.
2. **User asks a question or gives a command** in natural language (e.g., "What can I do with my tokens?" or "Swap 200 USDC to KAS").
3. **AI analyzes** — The reasoning engine interprets intent, scans available protocols, and generates a structured execution plan.
4. **AI explains** — Before any transaction, KasAgent provides a plain-language breakdown: tokens involved, expected output, fees, and risks.
5. **User confirms** — The transaction is sent to the user's wallet for signing. KasAgent never has custody of funds.

### Key Differentiator

**Natural language → DeFi execution.** Users don't need to understand AMM mechanics, contract addresses, or function signatures. They describe what they want in plain English, and KasAgent handles the rest — from opportunity discovery to transaction construction.

---

## 4. Target Users & Personas

### Primary Users

| Persona | Description | Goals | Pain Points |
|---|---|---|---|
| **The DeFi Beginner** | New to crypto, owns some tokens, has heard about "yield" but doesn't know where to start | Earn passive income, understand what their tokens can do | Overwhelmed by DeFi interfaces, afraid of making costly mistakes |
| **The Crypto Investor** | Holds a portfolio across multiple tokens, comfortable with basic swaps | Optimize returns, find the best yields, manage portfolio efficiently | Too many dApps to track, misses opportunities, manual process is time-consuming |
| **The Kasplex Explorer** | Early adopter excited about the Kaspa/Kasplex ecosystem | Discover and use every protocol on Kasplex L2 | New ecosystem with limited tooling, hard to find what's available |

### Secondary Users

| Persona | Description | Goals | Pain Points |
|---|---|---|---|
| **The Power User** | Experienced DeFi user who wants automation | Set up automated strategies (auto-compound, rebalance), save time | Repetitive manual tasks, can't monitor 24/7 |
| **The Portfolio Manager** | Manages funds for others or runs multiple wallets | Unified view across positions, quick execution, clear reporting | Fragmented dashboards, slow manual execution across wallets |

---

## 5. Product Phases & Roadmap

### Phase 1 — AI DeFi Copilot (MVP)

The core product: a chat-based AI assistant connected to the user's wallet on Kasplex L2.

**Capabilities:**
- Wallet connection (MetaMask / WalletConnect)
- Portfolio analysis and visualization
- AI-powered chat interface for natural language DeFi interaction
- Structured data cards for tool results (swap quotes, pool reserves, farms, staking rates)
- Token swaps via ZealousSwap
- DeFi opportunity discovery (pools, farms, staking)
- Transaction explanation before signing
- Transaction building and wallet submission

**UI Enhancements (within Phase 1):**
- Portfolio sidebar with persistent wallet overview (Bloomberg Light)
- Enhanced header with network status and KAS balance
- Contextual quick action buttons after AI responses

**Initial Protocol Integration:** ZealousSwap (Router, Factory, Farms/MasterChef, InfinityPools)

### Phase 2 — AI Wallet Agent

The copilot evolves into an autonomous agent that can execute strategies within user-defined safety policies.

**Capabilities:**
- User-defined safety policies (max transaction size, approved protocols, asset restrictions, daily spending limits)
- Automated strategy execution (e.g., "compound my rewards every week")
- Conditional triggers (e.g., "move funds if yield drops below 5%")
- Auto-compounding for farms and infinity pools
- Strategy templates and presets

### Phase 3 — Multi-Chain Expansion

Extend the agent to additional Kaspa L2 ecosystems and beyond.

**Capabilities:**
- Igra Labs L2 integration (iKAS native token, Galleon testnet → mainnet)
- Other EVM-compatible L2s in the Kaspa ecosystem
- Cross-chain opportunity comparison
- Unified multi-chain portfolio view

### Architectural Direction

**Current approach: Chain-First Vertical Slices (Direction 3)**, with Universal Interface (Direction 2) as the north star vision.

The rule: *duplication is far cheaper than the wrong abstraction.* With only 1 chain and 1 protocol, building adapter interfaces or registries before a second concrete implementation would mean guessing at the right abstractions. Instead:

1. **Now** — Build on Kasplex. Organize code into modular per-domain files (`lib/ai/tools/swap.ts`, `farms.ts`, etc.) but don't over-architect.
2. **When Igra Labs drops** — Build a second vertical slice. Copy patterns from Kasplex, adapt them. The real shared vs. protocol-specific boundaries will become visible.
3. **After 2+ chains work** — Extract common patterns into adapter interfaces. The abstractions write themselves from real examples.

Chain-level capabilities (e.g., transaction history via Blockscout) are the one exception — parameterized by explorer URL now because every EVM L2 will have an identical explorer API.

---

## 6. Detailed Feature Specs (Phase 1 MVP)

### F1: Wallet Connection

**Description:** Allow users to connect their EVM-compatible wallet to KasAgent on Kasplex L2.

| Aspect | Detail |
|---|---|
| **Supported wallets** | MetaMask, WalletConnect-compatible wallets |
| **Network** | Kasplex L2 Mainnet (Chain ID: `202555`, RPC: `https://evmrpc.kasplex.org`) |
| **Capabilities** | Read balances (native KAS + ERC-20 tokens), sign transactions, execute contract interactions |
| **Auto-detection** | Prompt user to add/switch to Kasplex L2 if not configured |
| **Session persistence** | Maintain connection across page reloads |

**Acceptance Criteria:**
- User can connect via MetaMask or WalletConnect in under 3 clicks
- Connected wallet address is displayed in the UI
- Network mismatch is detected and user is prompted to switch
- Disconnection is clean and clears session state

---

### F2: Portfolio Dashboard

**Description:** Display a comprehensive view of the user's on-chain holdings and positions on Kasplex L2.

| Aspect | Detail |
|---|---|
| **Token balances** | Native KAS balance + all ERC-20 token balances with USD values (where available) |
| **LP positions** | ZealousSwap LP token holdings with underlying token breakdown |
| **Farm positions** | MasterChef staked LP amounts, pending rewards, pool APY |
| **Staking positions** | InfinityPool staked amounts (xZEAL, xNACHO, xKASPER) with exchange rates |
| **Distribution chart** | Visual breakdown of portfolio allocation by asset/position type |

**Data Sources:**
- `balanceOf()` calls for KAS and ERC-20 tokens
- ZealousSwap Factory `getPair()` + Pair `getReserves()` for LP valuation
- MasterChef `userInfo(pid, user)` and `pendingReward(pid, user)` for farm positions
- InfinityPool `balanceOf()` and `getExchangeRate()` for staking positions

**Acceptance Criteria:**
- Portfolio loads within 3 seconds of wallet connection
- All token balances display with correct decimals
- LP positions show both underlying tokens and their amounts
- Farm positions show staked amount and claimable rewards
- Staking positions reflect current exchange rate

---

### F3: AI Chat Interface

**Description:** A conversational interface where users interact with their DeFi positions using natural language. The chat renders AI responses as a mix of text bubbles and structured data cards, creating a data-forward experience where tool results (swap quotes, pool data, farm listings, staking rates) are visualized inline rather than hidden or flattened into plain text.

| Aspect | Detail |
|---|---|
| **Input** | Free-text natural language input |
| **Output** | Mixed-content responses: markdown text interleaved with structured data cards rendered from tool results |
| **Conversation history** | Persisted per session, scrollable, with clear message attribution (user vs. AI) |
| **Context awareness** | AI has access to connected wallet data, available protocols, and current conversation context |
| **Example prompts** | "What can I do with my tokens?", "Find the best yield", "Swap 200 USDC to KAS", "Explain this transaction" |

**Response Types:**
- **Informational** — Portfolio summaries, yield comparisons, protocol explanations
- **Actionable** — Swap proposals, liquidity provision plans, staking suggestions (with "Execute" button)
- **Explanatory** — Transaction breakdowns, risk assessments, fee explanations
- **Confirmation** — Post-execution transaction receipts with explorer links

#### Structured Data Cards

The AI uses tool-calling to query on-chain data (swap quotes, pool reserves, farm info, staking rates). Instead of discarding these tool results or rendering them as raw text, the chat renders each tool result as a purpose-built visual card inline within the conversation flow.

An AI response like *"Here's the quote: [tool result] As you can see..."* renders as: **text bubble → swap card → text bubble** — natural conversation with structured data interspersed.

**Card Types:**

| Card | Renders For | Visual Design |
|---|---|---|
| **SwapQuoteCard** | `getSwapQuote` | Two token badges with amounts, directional arrow between them, price ratio footer. Teal/cyan accent for amounts. |
| **PoolReservesCard** | `getPoolReserves` | Pair name header, reserve amounts for each token, total LP supply. |
| **FarmsTableCard** | `getActiveFarms` | "Active Farms" header, table with Pool ID, Alloc %, Total Deposited, reward info. |
| **InfinityPoolRatesCard** | `getInfinityPoolRates` | Three mini-cards in a row (ZEAL, NACHO, KASPER) showing exchange rate and total staked. |
| **ToolCardSkeleton** | Any tool (loading) | Animated pulsing skeleton with contextual label (e.g., "Fetching swap quote..."). |
| **ToolErrorCard** | Any tool (error) | Red-tinted card with error message. |

**Card States:** Each card has three states:
1. **Loading** — Tool call is in progress; displays animated skeleton with a humanized label
2. **Success** — Tool returned data; renders the appropriate typed card
3. **Error** — Tool returned an error payload (`{ error: "..." }`); renders error card

**Card Dispatch:** A `ToolPartRenderer` component inspects each tool invocation part, checks its state (loading/error/done), and routes to the correct card component. Unknown or future tools fall back to a formatted JSON display rather than being silently dropped.

**Card Styling:**
- Cards use `bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4` — visually distinct from text bubbles
- Data values use `font-mono text-teal-400` for emphasis
- Token badges are color-coded: emerald (KAS), blue (ZEAL), orange (NACHO), purple (KASPER)
- Token symbols are resolved dynamically from the on-chain token registry

**Message Rendering:** `ChatMessage` iterates through `message.parts` in order:
- `type === "text"` → renders via MarkdownRenderer (in its own bubble)
- Tool invocation parts → renders via `ToolPartRenderer` (as inline card)
- User messages are unchanged (text-only bubble)
- Empty text parts are skipped

**Acceptance Criteria:**
- AI responds within 5 seconds for informational queries
- AI correctly interprets swap commands with token names and amounts
- AI provides actionable suggestions with one-click execution
- Conversation history persists within a session
- AI gracefully handles ambiguous or unsupported requests
- Tool results render as visual cards inline in the conversation, not as raw text or hidden data
- Cards display loading skeletons while tool calls are in progress
- Tool errors surface via a dedicated error card, not silently swallowed
- Unknown tools render a JSON fallback rather than being discarded

---

### F4: Token Swaps

**Description:** Execute token swaps on ZealousSwap through the AI chat interface.

| Aspect | Detail |
|---|---|
| **DEX** | ZealousSwap Router (`0xA5B0946D31aD2d251e0fe2dfEA8808BFd475e607`) |
| **Swap types** | Token → Token (`swapExactTokensForTokens`), KAS → Token (`swapExactKASForTokens`), Token → KAS (`swapTokensForExactKAS`) |
| **Quote preview** | Show estimated output via `getAmountsOut()` before execution (with `isDiscountEligible: false` by default) |
| **Slippage settings** | User-configurable slippage tolerance (default: 0.5%, options: 0.1%, 0.5%, 1%, custom) |
| **Deadline** | Configurable transaction deadline (default: 20 minutes) |
| **Token approval** | Auto-detect and prompt for ERC-20 `approve()` if allowance is insufficient |
| **WKAS handling** | Automatic wrapping/unwrapping via WKAS (`0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e`) when swapping native KAS |
| **Multi-hop routing** | If no direct liquidity pair exists, the system automatically routes through WKAS as an intermediary (e.g., NACHO → WKAS → KASPER). Fee and gas estimates adjust for multi-hop paths. |

**User Flow:**
1. User says: "Swap 200 USDC to KAS"
2. AI fetches quote via `findBestPath()` — tries direct pair first, falls back to WKAS intermediary route
3. AI displays: expected KAS output, price impact, DEX fee (0.3% per hop), gas estimate
4. User clicks "Execute" or confirms in chat
5. If approval needed: wallet prompts for token approval first
6. Wallet prompts for swap transaction signature
7. AI displays transaction hash + explorer link on success

**Acceptance Criteria:**
- Swap quotes are accurate within 1% of on-chain execution
- Token approval is handled seamlessly when needed
- Failed transactions show clear error messages
- Transaction confirmation includes explorer link (`https://explorer.kasplex.org`)

---

### F5: DeFi Opportunity Discovery

**Description:** Scan ZealousSwap protocols and surface yield/APY data to the user.

| Aspect | Detail |
|---|---|
| **Liquidity pools** | List active ZealousSwap pairs via Factory `allPairs()`, show reserves and volume |
| **Farms** | Fetch active farms via MasterChef `getActivePools()`, show APY based on `rewardPerBlock()` and pool allocation |
| **InfinityPools** | Show ZEAL, NACHO, KASPER staking with current exchange rates and projected yields |
| **Yield comparison** | Rank opportunities by APY, sorted and filterable |
| **Risk indicators** | Flag low-liquidity pools, new/unverified tokens, impermanent loss exposure |

**Data Sources:**
- MasterChef: `poolInfo(pid)`, `getActivePools()`, `rewardPerBlock()`, `totalAllocPoint()`
- InfinityPools: `getExchangeRate()`, `totalStaked()`, `zealPerBlock()` (ZEAL pool), `getPendingEmissions()`
- Factory: `allPairsLength()`, `allPairs(index)` → Pair `getReserves()`, `token0()`, `token1()`

**Acceptance Criteria:**
- All active ZealousSwap pools and farms are discovered
- APY calculations are based on current on-chain data
- Opportunities are presented in a clear, comparable format
- User can ask "Find the best yield for stablecoins" and get filtered results

---

### F6: Transaction Explanation

**Description:** Before any transaction is signed, provide a plain-language breakdown of what will happen.

| Aspect | Detail |
|---|---|
| **Tokens involved** | Input token, output token, amounts with USD equivalents |
| **Fees** | DEX fee (0.3% for ZealousSwap), estimated gas fee in KAS/USD |
| **Expected output** | Minimum received after slippage, price impact percentage |
| **Risks** | Low liquidity warnings, high slippage alerts, large price impact flags |
| **Contract interaction** | Which contract is being called, what function, simplified explanation |

**Example Output:**
```
You are about to swap:
  200 USDC → ~198.5 KAS

  DEX Fee: 0.3% (0.60 USDC)
  Gas Fee: ~0.02 KAS (~$0.01)
  Minimum Received: 197.5 KAS (0.5% slippage)
  Price Impact: 0.12%

  ⚠ No risks detected. Pool has sufficient liquidity.

  [Confirm] [Cancel]
```

**Acceptance Criteria:**
- Every transaction has a human-readable explanation before wallet prompt
- Fee breakdown is accurate
- Risk warnings trigger for price impact > 3%, liquidity below threshold, or unusual conditions
- User can cancel at the explanation step without any on-chain interaction

---

### F7: Transaction Builder

**Description:** Construct transactions from AI-generated execution plans and submit them to the user's wallet for signature.

| Aspect | Detail |
|---|---|
| **Plan → Transaction** | Convert structured AI plans (e.g., "swap X for Y on ZealousSwap") into encoded contract calls |
| **Multi-step plans** | Support sequential operations (e.g., approve → swap, or swap → add liquidity) |
| **Protocol adapters** | Standardized adapter interface per protocol; ZealousSwap adapter is the first implementation |
| **Gas estimation** | Estimate gas before submission using `eth_estimateGas` |
| **Error handling** | Catch revert reasons, decode error messages, present user-friendly explanations |
| **Confirmation** | After successful tx, display receipt: tx hash, block number, tokens transferred, explorer link |

**Adapter Interface (ZealousSwap):**

The ZealousSwap adapter must support:
- `swap(params)` — Build swap transaction (exact-in or exact-out, KAS or token)
- `addLiquidity(params)` — Build add liquidity transaction (token pair or KAS pair)
- `removeLiquidity(params)` — Build remove liquidity transaction
- `stakeFarm(pid, amount)` — Build MasterChef deposit transaction
- `unstakeFarm(pid, amount)` — Build MasterChef withdraw transaction
- `claimRewards(pid)` — Build MasterChef claim transaction
- `stakeInfinityPool(pool, amount)` — Build InfinityPool stake transaction
- `unstakeInfinityPool(pool, amount)` — Build InfinityPool unstake transaction
- `getQuote(params)` — Fetch swap quote via `getAmountsOut`/`getAmountsIn`

**Acceptance Criteria:**
- All ZealousSwap operations (swap, liquidity, farm, stake) can be built and submitted
- Multi-step transactions execute in correct order
- Gas estimation is shown before submission
- Failed transactions provide actionable error messages
- Successful transactions link to Kasplex explorer

---

### F8: UI Layout & Experience Enhancements

**Description:** A set of UI improvements that transform the single-column chat into a data-forward application layout. These enhancements build on the structured card system (F3) and portfolio dashboard (F2) to provide persistent context, network awareness, and guided interaction. Implemented incrementally across three sub-phases.

#### F8.1: Portfolio Sidebar (Bloomberg Light)

A persistent sidebar that displays the user's on-chain portfolio alongside the chat, eliminating the need to switch between a dashboard view and the conversation.

| Aspect | Detail |
|---|---|
| **Width** | Fixed `w-72` when open, `w-0` when collapsed with `transition-all duration-300` |
| **Toggle** | Persistent icon button on the sidebar edge; default open on desktop |
| **Sections** | Token Balances, LP Positions, Farm Positions, Staking Positions |
| **Data source** | Receives portfolio data as props from page-level hooks (`usePortfolio`, `useInfinityPoolData`) |
| **Empty state** | "Connect Wallet" prompt when no wallet is connected |

**Layout restructure:** Portfolio data hooks are lifted from `ChatContainer` to `page.tsx` so that both the sidebar and the chat can consume the same data. The page layout becomes:

```
┌─────────────────────────────────────────────────┐
│                   AppHeader                      │
├──────────┬──────────────────────────────────────┤
│ Portfolio│                                       │
│ Sidebar  │          Chat Area                    │
│ (w-72)   │      (flex-1, max-w-3xl msgs)        │
│          │                                       │
└──────────┴──────────────────────────────────────┘
```

Chat messages are constrained to `max-w-3xl mx-auto` within the expanded chat area so text remains readable when the sidebar is open.

**Acceptance Criteria:**
- Sidebar shows all token balances, LP, farm, and staking positions
- Sidebar collapses and expands smoothly with animation
- Chat remains fully functional with sidebar open or closed
- Portfolio data stays in sync — sidebar and chat share the same data source

---

#### F8.2: Enhanced Header

A redesigned application header that surfaces network status and key wallet info at a glance.

| Aspect | Detail |
|---|---|
| **Layout** | `[Sidebar Toggle] [KasAgent Logo] ... [NetworkStatus] [KAS Balance Pill] [ConnectButton]` |
| **Network status** | Green pulsing dot + "Kasplex L2" when connected to chain 202555; orange dot + "Wrong Network" on mismatch; gray dot + "Disconnected" when no wallet |
| **KAS balance** | Prominent pill showing `XX.XXXX KAS` from portfolio data |
| **Data** | Uses `useAccount()` and `useChainId()` from wagmi; accepts portfolio data as props |

**Acceptance Criteria:**
- Network status accurately reflects wallet connection and chain state
- KAS balance updates when portfolio data refreshes
- Sidebar toggle button controls the portfolio sidebar
- Header is visually consistent with the overall dark theme

---

#### F8.3: Quick Action Buttons

Contextual follow-up suggestions that appear after AI responses containing tool results, guiding users toward logical next steps.

| Aspect | Detail |
|---|---|
| **Trigger** | Displayed after the last AI message when it contains tool results and the AI is not loading |
| **Actions** | Derived from tool name + output (e.g., `getSwapQuote` → "Check staking rates for [tokenOut]") |
| **Format** | Horizontal row of pill buttons styled like suggestion chips |
| **Behavior** | Clicking a button sends the corresponding message to the AI as if the user typed it |

**Action Mapping:**

| Tool Result | Suggested Actions |
|---|---|
| `getSwapQuote` | "Check staking rates for [tokenOut]", "Find better rate" |
| `getPoolReserves` | "Check farms for this pair" |
| `getActiveFarms` | "Compare with staking" |
| `getInfinityPoolRates` | "Best yield opportunity" |

**Acceptance Criteria:**
- Quick action buttons appear only after AI messages with tool results
- Buttons disappear when the AI is processing a new request
- Clicking a button sends the correct message and triggers an AI response
- Actions are contextually relevant to the preceding tool result

---

## 7. User Flows

### Flow 1: First-Time User

```
1. User visits KasAgent web app
2. Landing page explains the product with a "Connect Wallet" CTA
3. User clicks "Connect Wallet" → MetaMask popup → selects account → confirms
4. If wrong network: header shows orange "Wrong Network" indicator → prompted to switch to Kasplex L2
5. Portfolio sidebar loads: token balances, LP/farm/staking positions
   Header shows green "Kasplex L2" status + KAS balance pill
6. Chat opens with welcome message:
   "Welcome! I can see your portfolio. Ask me anything —
    try 'What can I do with my tokens?' or 'Find the best yield.'"
7. User types: "What can I do with my 1200 USDC?"
8. AI responds with text + inline data cards (pool reserves, farm rates, staking rates)
   Quick action buttons appear: "Swap USDC to KAS", "Find best yield", "Provide liquidity"
9. User clicks quick action or types: "Swap 500 USDC to KAS"
10. AI calls getSwapQuote → SwapQuoteCard renders inline (amounts, price ratio)
    AI explains fees, risks, slippage in text below the card
11. User clicks "Confirm"
12. MetaMask prompts for approval (if needed) → then swap transaction
13. User signs → tx submitted → AI shows confirmation with explorer link
    Sidebar portfolio updates to reflect new balances
```

### Flow 2: Returning User — Yield Discovery

```
1. User opens KasAgent → wallet auto-reconnects
2. Sidebar loads with updated balances; header shows KAS balance
3. User types: "Where can I earn the best yield on my KAS?"
4. AI calls getActiveFarms and getInfinityPoolRates
5. AI responds with:
   - FarmsTableCard: table of active farms with Pool ID, Alloc %, Deposited
   - InfinityPoolRatesCard: 3 mini-cards (ZEAL, NACHO, KASPER) with exchange rates
   - Text summary ranking opportunities by estimated APY
   Quick action buttons: "Stake in ZEAL pool", "Compare farms", "Best yield opportunity"
6. User clicks "Stake in ZEAL pool" or types: "Stake some KAS in the ZEAL pool"
7. AI proposes plan: wrap KAS → swap half to ZEAL → stake in InfinityPool
8. AI explains each step with fees and expected outcome
9. User confirms → sequential transactions execute
10. AI confirms completion with new portfolio summary
```

### Flow 3: Transaction Explanation

```
1. User types: "Provide liquidity to the KAS/USDC pool on ZealousSwap"
2. AI calculates optimal amounts based on current reserves and user balances
3. AI presents full plan:
   Step 1: Approve USDC for Router contract
   Step 2: Add liquidity — 500 USDC + 505 KAS
   Expected LP tokens: ~XXX
   Your share of pool: X.XX%
   Fees earned: proportional to 0.3% of pool volume
   ⚠ Impermanent loss risk: moderate (KAS/stablecoin pair)
4. User reviews and clicks "Confirm"
5. Transactions execute sequentially with status updates
6. AI shows final confirmation with LP position details
```

---

## 8. Technical Architecture

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Web App)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Chat UI     │  │  Portfolio   │  │  Wallet       │  │
│  │  Component   │  │  Dashboard   │  │  Connector    │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                │                   │          │
│         └────────────────┼───────────────────┘          │
│                          │                              │
└──────────────────────────┼──────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│                     AI LAYER                             │
│  ┌──────────────────────────────────────────────────┐   │
│  │  LLM Reasoning Engine                            │   │
│  │  • Intent parsing (NL → structured command)      │   │
│  │  • Strategy generation                           │   │
│  │  • Transaction explanation                       │   │
│  │  • Risk assessment                               │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                               │
└─────────────────────────┼───────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│                  EXECUTION LAYER                         │
│  ┌────────────────┐  ┌────────────────┐                 │
│  │ Chain Module    │  │  Protocol      │                 │
│  │ (Kasplex L2)   │  │  Adapters      │                 │
│  │ • Chain ID      │  │ ┌────────────┐ │                 │
│  │ • RPC endpoint  │  │ │ ZealousSwap│ │                 │
│  │ • Gas config    │  │ │  Adapter   │ │                 │
│  │ • Explorer URL  │  │ └────────────┘ │                 │
│  │ • Native token  │  │ ┌────────────┐ │                 │
│  └────────────────┘  │ │  (Future   │ │                 │
│                       │ │  Adapters) │ │                 │
│  ┌────────────────┐  │ └────────────┘ │                 │
│  │ Transaction    │  └────────────────┘                 │
│  │ Builder        │                                     │
│  │ • Encode calls │                                     │
│  │ • Estimate gas │                                     │
│  │ • Submit to    │                                     │
│  │   wallet       │                                     │
│  └────────────────┘                                     │
└──────────────────────────────────────────────────────────┘
```

### Frontend

| Aspect | Choice |
|---|---|
| **Framework** | React / Next.js |
| **Wallet integration** | wagmi + viem (industry standard for EVM wallet connection) |
| **Chat UI** | Custom chat component with markdown rendering, inline data cards for tool results, and action buttons |
| **State management** | React context + wagmi hooks for wallet state; portfolio hooks lifted to page level for shared access |
| **Styling** | Tailwind CSS with dark theme (zinc-800/900 base, teal-400 data accents) |

**Component Architecture:**

```
app/page.tsx (layout orchestrator, owns portfolio hooks)
├── components/header/AppHeader.tsx (logo, network status, KAS balance, sidebar toggle)
│   └── components/header/NetworkStatus.tsx (chain connection indicator)
├── components/sidebar/PortfolioSidebar.tsx (collapsible portfolio panel)
└── components/chat/ChatContainer.tsx (chat logic, AI transport, message handling)
    └── components/chat/MessageList.tsx (scrollable messages, max-w-3xl constraint)
        ├── components/chat/ChatMessage.tsx (iterates message.parts → text or tool card)
        │   ├── MarkdownRenderer (text parts)
        │   └── components/chat/ToolPartRenderer.tsx (tool part dispatcher)
        │       ├── cards/SwapQuoteCard.tsx
        │       ├── cards/SwapExecutionCard.tsx
        │       ├── cards/PoolReservesCard.tsx
        │       ├── cards/FarmsTableCard.tsx
        │       ├── cards/InfinityPoolRatesCard.tsx
        │       ├── cards/YieldOpportunitiesCard.tsx
        │       ├── cards/AddLiquidityCard.tsx
        │       ├── cards/RemoveLiquidityCard.tsx
        │       ├── cards/FarmStakeCard.tsx / FarmUnstakeCard.tsx
        │       ├── cards/InfinityStakeCard.tsx / InfinityUnstakeCard.tsx
        │       ├── cards/TransactionHistoryCard.tsx
        │       ├── cards/ToolCardSkeleton.tsx
        │       └── cards/ToolErrorCard.tsx
        └── components/chat/QuickActions.tsx (contextual follow-up buttons)
```

**AI Tools (modular, per-domain):**

```
lib/ai/tools/
├── index.ts       — re-exports aggregated aiTools object
├── helpers.ts     — re-exports async token resolution from lib/token-registry, findBestPath (multi-hop routing), calculatePriceImpact, checkAllowance
├── swap.ts        — getSwapQuote, prepareSwap
├── liquidity.ts   — getPoolReserves, prepareAddLiquidity, prepareRemoveLiquidity
├── farms.ts       — getActiveFarms, prepareFarmStake, prepareFarmUnstake
├── staking.ts     — getInfinityPoolRates, prepareInfinityStake, prepareInfinityUnstake
├── yield.ts       — discoverYieldOpportunities
└── history.ts     — getTransactionHistory (Blockscout API, chain-level)
```

Previously a single monolithic `lib/ai/tools.ts`. Split into per-domain modules to improve navigability and prepare for multi-chain vertical slices (each chain will have its own tools directory).

**Shared Utilities:**
- `lib/ai/tool-types.ts` — TypeScript interfaces matching tool return shapes (all `*Result` types)
- `lib/token-registry.ts` — Server-side dynamic token discovery from Factory pairs (5-min cache). Exports async `resolveTokenAddress()`, `addressToSymbol()`, `getTokenDecimals()`, `getAllTokens()`
- `lib/viem-client.ts` — Single shared viem public client instance (used by both AI tools and token registry)
- `hooks/useTokenRegistry.ts` — Client-side token discovery hook (reads Factory pairs + ERC-20 metadata via `useReadContracts`). Returns `tokens[]`, `tokenMap`, `getTokenSymbol()`
- `lib/ai/quick-actions.ts` — Maps tool name + output to suggested follow-up actions

### AI Layer

| Aspect | Detail |
|---|---|
| **LLM** | Cloud-hosted LLM (e.g., Claude API) for reasoning, intent parsing, and explanation generation |
| **Intent parsing** | Natural language → structured command (action type, tokens, amounts, protocol) |
| **Execution planning** | Multi-step plan generation (e.g., approve → swap → add liquidity) |
| **Context injection** | Wallet balances, available protocols, pool data, and conversation history fed as context |
| **Tool use** | LLM uses tool-calling to invoke protocol adapters and chain queries |

### Protocol Adapters

Each supported protocol exposes a standardized interface:

```
ProtocolAdapter {
  // Discovery
  getAvailablePools() → Pool[]
  getPoolDetails(poolId) → PoolDetail
  getUserPositions(address) → Position[]

  // Execution
  buildSwapTx(params) → TransactionRequest
  buildAddLiquidityTx(params) → TransactionRequest
  buildRemoveLiquidityTx(params) → TransactionRequest
  buildStakeTx(params) → TransactionRequest
  buildUnstakeTx(params) → TransactionRequest
  buildClaimTx(params) → TransactionRequest

  // Quotes
  getSwapQuote(params) → Quote
  getLiquidityQuote(params) → Quote
}
```

**ZealousSwap Adapter** is the first implementation, covering:
- Router swaps (token↔token, KAS↔token)
- Factory pair discovery
- Pair reserve queries
- MasterChef farm operations (deposit, withdraw, claim)
- InfinityPool staking (ZEAL, NACHO, KASPER)

### Chain Modules

Each supported chain has a configuration module:

```
ChainModule {
  chainId: number          // 202555 for Kasplex Mainnet
  name: string             // "Kasplex L2"
  rpcUrl: string           // "https://evmrpc.kasplex.org"
  explorerUrl: string      // "https://explorer.kasplex.org"
  nativeToken: {
    symbol: string         // "KAS"
    decimals: number       // 18
  }
  wrappedNativeToken: address  // WKAS address
  protocols: ProtocolAdapter[]
}
```

### Execution Layer

| Component | Responsibility |
|---|---|
| **Transaction Builder** | Encodes contract calls from adapter output, attaches gas parameters |
| **Gas Estimator** | Calls `eth_estimateGas` and applies buffer for safety |
| **Wallet Submitter** | Sends transaction to connected wallet via wagmi/viem for user signature |
| **Receipt Handler** | Monitors transaction status, decodes logs, formats confirmation |

---

## 9. Non-Functional Requirements

### Security

| Requirement | Detail |
|---|---|
| **Non-custodial** | KasAgent never holds, stores, or has access to private keys. All transaction signing happens in the user's wallet. |
| **No private key storage** | No seed phrases, private keys, or wallet credentials are ever transmitted to or stored on KasAgent servers. |
| **Transaction signing** | All transactions require explicit user approval via their wallet (MetaMask popup or WalletConnect). |
| **Token approvals** | Approve exact amounts where possible; avoid unlimited approvals. Display approval amounts clearly. |
| **API security** | All API communication over HTTPS. LLM API keys stored server-side, never exposed to client. |
| **Input validation** | All user inputs sanitized before processing. AI outputs validated before transaction construction. |
| **Smart contract interaction** | Only interact with verified, known contract addresses (hardcoded in protocol adapters). |

### Performance

| Metric | Target |
|---|---|
| **Initial page load** | < 3 seconds |
| **Wallet connection** | < 2 seconds (after user approval) |
| **Portfolio load** | < 3 seconds |
| **AI response (informational)** | < 5 seconds |
| **AI response (with on-chain query)** | < 8 seconds |
| **Swap quote** | < 2 seconds |
| **Transaction submission** | < 1 second (to wallet; on-chain confirmation depends on network) |

### Scalability

| Aspect | Approach |
|---|---|
| **Concurrent users** | Stateless frontend; AI layer scales horizontally |
| **RPC load** | Batch RPC calls where possible; cache pool/token data with short TTL |
| **Conversation state** | Client-side session storage; no persistent backend database required for MVP |

### Accessibility

| Aspect | Target |
|---|---|
| **Keyboard navigation** | Full keyboard support for chat and wallet actions |
| **Screen reader** | ARIA labels on key interactive elements |
| **Color contrast** | WCAG AA compliance |
| **Responsive design** | Functional on desktop and tablet viewports (mobile optimization deferred to Phase 3) |

---

## 10. Success Metrics & KPIs

### Primary Metrics

| Metric | Definition | Phase 1 Target |
|---|---|---|
| **Wallets Connected** | Unique wallets that have connected at least once | 1,000 in first 3 months |
| **Transactions Executed** | Total transactions submitted through KasAgent | 5,000 in first 3 months |
| **TVL Routed** | Total value of assets transacted through KasAgent | $500K cumulative in first 3 months |
| **Weekly Active Users** | Unique wallets interacting per week | 200 by end of month 3 |

### Secondary Metrics

| Metric | Definition | Target |
|---|---|---|
| **Retention (Week 1)** | % of users returning within 7 days | > 30% |
| **Avg. Session Duration** | Time spent per visit | > 5 minutes |
| **Queries per Session** | Average AI chat interactions per session | > 3 |
| **Transaction Success Rate** | % of submitted transactions that confirm on-chain | > 95% |
| **AI Accuracy** | % of AI responses that correctly interpret user intent | > 90% |
| **NPS** | Net Promoter Score from user surveys | > 40 |

---

## 11. Risks & Mitigations

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| **Smart contract exploit** (ZealousSwap or other integrated protocol is compromised) | High | Low | Only integrate audited protocols. Display risk warnings. Never hold user funds. Monitor for known exploits. |
| **AI hallucination** (AI suggests incorrect swap amounts, wrong tokens, or non-existent pools) | High | Medium | Validate all AI outputs against on-chain data before transaction construction. Require explicit user confirmation. Show exact contract calls in explanation. |
| **Regulatory uncertainty** (AI financial advice classification) | Medium | Medium | Include disclaimers that KasAgent is an informational tool, not financial advice. No custody = no money transmitter risk. Consult legal counsel before launch. |
| **Low liquidity on Kasplex L2** (thin pools cause high slippage) | Medium | Medium | Show liquidity depth and price impact prominently. Warn on large trades. Suggest splitting orders. |
| **RPC reliability** (Kasplex L2 RPC downtime or rate limits) | Medium | Medium | Implement RPC fallback endpoints. Cache data aggressively. Show clear "network unavailable" states. |
| **User adoption** (users don't trust AI with their wallet) | Medium | Medium | Emphasize non-custodial design. Show exactly what each transaction does. Build trust through transparency. |
| **LLM API cost** (high usage = expensive API bills) | Low | Medium | Optimize prompts. Cache common queries. Implement rate limiting. Consider self-hosted models for Phase 2. |
| **Wallet compatibility** (edge cases with certain wallet providers) | Low | Low | Test extensively with MetaMask. WalletConnect provides broad compatibility. Maintain known-issues list. |

---

## 12. Dependencies & Assumptions

### Dependencies

| Dependency | Status | Risk |
|---|---|---|
| **ZealousSwap contracts on Kasplex Mainnet** | Deployed and verified (Router, Factory, MasterChef, InfinityPools) | Low — contracts are live |
| **Kasplex L2 RPC** (`https://evmrpc.kasplex.org`) | Operational | Medium — uptime and rate limits TBD |
| **Kasplex Block Explorer** (`https://explorer.kasplex.org`) | Operational | Low — for transaction links only |
| **LLM API** (Claude or equivalent) | Available | Low — multiple providers available |
| **wagmi/viem libraries** | Stable, widely used | Low |
| **MetaMask / WalletConnect** | Industry standard | Low |

### Assumptions

- Kasplex L2 mainnet remains stable and accessible via public RPC.
- ZealousSwap contracts remain unchanged (no migration to V3 or contract upgrades during Phase 1).
- Users have MetaMask or a WalletConnect-compatible wallet installed.
- Users have KAS for gas fees on Kasplex L2.
- The ZealousSwap Router's `isDiscountEligible` parameter can default to `false` for standard users.
- Token metadata (symbol, decimals) can be reliably read from on-chain ERC-20 contracts.
- The MasterChef `rewardPerBlock()` and pool allocations provide sufficient data to estimate farm APY.

---

## 13. Out of Scope (Phase 1)

The following are explicitly **not** included in the Phase 1 MVP:

| Item | Rationale | Phase |
|---|---|---|
| **Autonomous agent execution** | Requires trust framework, safety policies, and auditing — Phase 2 feature | Phase 2 |
| **Multi-chain support** | Focus on proving value on Kasplex L2 first | Phase 3 |
| **Mobile app** | Web app covers initial launch; mobile optimization later | Phase 3+ |
| **Fiat on/off ramp** | Requires payment processor integration and compliance | Future |
| **Social features** (sharing strategies, leaderboards) | Not core to MVP value proposition | Future |
| **Custom token imports** | Support known tokens first; custom tokens add complexity | Post-MVP |
| **Limit orders / advanced order types** | ZealousSwap is AMM-based; no order book available | Future |
| **Historical analytics** (P&L tracking, trade history charts) | Valuable but not core to MVP copilot functionality | Post-MVP |
| **Fervent Finance integration** | Contracts not yet deployed on Kasplex L2 | When available |
| **Igra Labs L2** | Testnet only (Galleon testnet, Chain ID: 38836); no ZealousSwap deployment | Phase 3 |

---

## 14. UI/UX Design System

### Design Philosophy

KasAgent follows a **"Structured Conversation + Bloomberg Light"** design approach. The interface combines a conversational AI chat with data-dense financial UI elements, ensuring that users always have context about their portfolio and on-chain data without leaving the conversation flow.

### Design Principles

1. **Data-forward, not data-hidden** — Tool results (swap quotes, pool data, farm listings) are rendered as visual cards inline in the conversation, never discarded or flattened into plain text.
2. **Persistent context** — Portfolio data is always accessible via the sidebar, eliminating the need to ask the AI for information that should be visible at a glance.
3. **Progressive disclosure** — The chat starts simple (text input/output) but reveals structured data and quick actions as the conversation deepens.
4. **Guided exploration** — Quick action buttons surface logical next steps after each AI response, lowering the barrier for users who don't know what to ask next.

### Visual Language

| Element | Style |
|---|---|
| **Base theme** | Dark (zinc-800/900 backgrounds) |
| **Data accent** | Teal/cyan (`text-teal-400`) for numeric values and key data |
| **Card containers** | `bg-zinc-800/80 border border-zinc-700/50 rounded-xl` — distinct from text bubbles |
| **Typography** | Sans-serif for prose, monospace (`font-mono`) for data values |
| **Token colors** | Emerald (KAS), Blue (ZEAL), Orange (NACHO), Purple (KASPER) |
| **Status indicators** | Green (connected), Orange (wrong network), Gray (disconnected) |
| **Message width** | `max-w-3xl mx-auto` within the chat area for readability |

### Implementation Phases

The UI redesign is implemented incrementally, with each phase independently deployable:

| Phase | Scope | Status |
|---|---|---|
| **Phase 1: Structured Cards** | Tool result cards inline in chat (F3 enhancement) | Implemented |
| **Phase 2: Portfolio Sidebar** | Persistent sidebar with wallet overview (F8.1) | Planned |
| **Phase 3: Enhanced Header** | Network status, KAS balance pill (F8.2) | Planned |
| **Phase 4: Quick Actions** | Contextual follow-up buttons (F8.3) | Planned |

---

## 15. Key Implementation Decisions

This section defines important implementation choices for the MVP in order to reduce ambiguity during development.

### Token Discovery Strategy

Tokens are discovered **dynamically from on-chain data** rather than maintained as a hardcoded list. The system reads all trading pairs from the ZealousSwap Factory contract and extracts unique token addresses, then batch-reads ERC-20 `name()`, `symbol()`, and `decimals()` for each.

**Two discovery layers:**
- **Server-side** (`lib/token-registry.ts`): Used by AI tools and the system prompt. In-memory cache with 5-minute TTL. Always includes KAS (native) and WKAS.
- **Client-side** (`hooks/useTokenRegistry.ts`): Used by UI components. Builds on the existing `useAllPairs` hook and wagmi's `useReadContracts` for ERC-20 metadata batch reads.

**What remains static:**
- `config/tokens.ts` exports `KAS_NATIVE` (the native token constant) and `TOKEN_LOGOS` (a small address-to-logo-path map for known tokens). Logos are the only metadata that cannot come from on-chain.

This approach means any new token listed on ZealousSwap is automatically supported by KasAgent without code changes.

### ZealousSwap Discount Handling

The ZealousSwap router includes an `isDiscountEligible` parameter in pricing functions.

For the MVP, the system will assume:

`isDiscountEligible = false`

until the exact discount conditions are confirmed.

Engineering should review the ZealousSwap smart contracts and documentation to determine the exact eligibility criteria, which may depend on holding or staking ZEAL tokens.

### RPC Infrastructure

Development will initially use the public RPC endpoint:

`https://evmrpc.kasplex.org`

For production environments, the system should support:
- Multiple RPC providers
- Automatic RPC failover
- Retry logic for failed requests

The architecture should allow switching RPC providers without modifying application logic.

### Token Price Data

Token prices for the MVP will be derived from **DEX liquidity pools on ZealousSwap**.

Prices will be calculated using the reserve ratio of token pairs, prioritizing pools paired with stablecoins such as USDC. If stablecoin pools are unavailable, prices may be approximated using KAS-based pairs.

Future versions may integrate external price APIs or on-chain oracle solutions.

### LLM Provider

The initial AI reasoning layer will use the **Claude API** due to its strong reasoning and planning capabilities.

The system will implement a provider abstraction layer so the LLM backend can be swapped easily. Possible fallback providers include:
- OpenAI
- Self-hosted models

The reasoning system should rely on structured tools and deterministic planning rather than free-form responses to reduce cost and improve reliability.

### InfinityPool APY Calculation

APY calculations for InfinityPools will depend on the reward mechanism.

**For pools with `zealPerBlock()` emissions:**

```
APY = (rewardPerBlock × blocksPerYear × tokenPrice) / TVL
```

**For pools with manual reward distributions:**

APY will be calculated using:
- Reward distribution schedule
- Pool total value locked

All displayed values will be labeled as **Estimated APY** and refreshed periodically.

### User Authentication

The MVP will not implement traditional user accounts. User identity will be based solely on wallet connection.

User preferences and conversation history may be stored using:
- Local browser storage
- Optional backend session storage linked to wallet signatures

Full account systems may be introduced later if cross-device persistence becomes necessary.

### Gas Sponsorship

Gas sponsorship will **not** be implemented in the initial MVP.

User feedback will be collected to evaluate whether gas costs create onboarding friction. If necessary, a later version may introduce limited gas sponsorship, such as covering the first few transactions per wallet.

### Legal Disclaimers

The product must clearly state that:
- The AI provides informational assistance only
- The system does not provide financial advice
- Users are fully responsible for transactions they sign

A legal review will be conducted before public launch.

### Analytics and Telemetry

The system will use a **privacy-focused analytics platform**. Recommended tools include:
- PostHog
- Plausible

Tracked events may include:
- Wallet connected
- Strategy suggested
- Transaction prepared
- Transaction executed

Wallet addresses will **not** be stored in analytics logs in order to protect user privacy.

### Modular Tool Architecture

The AI tool definitions were reorganized from a single monolithic `lib/ai/tools.ts` file into per-domain modules under `lib/ai/tools/`. Each file owns one functional domain (swap, liquidity, farms, staking, yield, history) with a shared `helpers.ts` for common utilities (viem client, token resolution).

**Rationale:**
- The monolithic file exceeded 800 lines and mixed unrelated domains
- Per-domain modules improve navigability and reduce merge conflicts
- Prepares for the Chain-First Vertical Slices architecture — when a second chain is added, each chain gets its own `tools/` directory with the same module structure
- The `index.ts` barrel export keeps the import surface unchanged for consumers (`aiTools` object)

**Convention:** Each tool module exports a `*Tools` object (e.g., `swapTools`, `farmTools`) that is spread into the aggregated `aiTools` in `index.ts`. Chain-level tools (e.g., `history.ts` using Blockscout REST API) are kept separate from protocol-level tools (e.g., `swap.ts` using viem/RPC) to make the chain vs. protocol boundary explicit.

---

## 16. Open Questions

| # | Question | Proposed Direction | Owner |
|---|---|---|---|
| 1 | **What token list should we use?** | **Resolved.** Tokens are discovered dynamically on-chain from ZealousSwap Factory pairs. Server-side: `lib/token-registry.ts` (5-min cache). Client-side: `hooks/useTokenRegistry.ts`. Only logo URIs remain static in `config/tokens.ts`. | Engineering |
| 2 | **ZealousSwap discount eligibility** | The `isDiscountEligible` flag likely indicates whether the user qualifies for a **trading fee discount**, possibly based on holding or staking ZEAL tokens. For MVP, default to `false` unless the wallet holds ZEAL or documentation confirms the eligibility rule. Engineering should inspect the ZealousSwap contracts or documentation to confirm the exact condition. | Engineering |
| 3 | **RPC rate limits** | For development, use the public RPC endpoint `https://evmrpc.kasplex.org`. For production, plan to use **multiple RPC endpoints or a dedicated node** to avoid rate limits and downtime. Implement an RPC provider abstraction with **automatic fallback and retry logic**. | Infrastructure |
| 4 | **Token price feeds** | For MVP, derive prices from **DEX liquidity pools on ZealousSwap** using on-chain reserve ratios. Use pools paired with **USDC or another stablecoin** to estimate USD prices. Later phases may integrate external APIs such as CoinGecko or Dexscreener, or implement an on-chain oracle. | Engineering |
| 5 | **LLM provider selection** | Start with **Claude API** due to strong reasoning and planning capabilities. Implement an abstraction layer allowing fallback to **OpenAI or other providers**. The AI layer should use structured tools and minimize token usage to control cost. | Product / Engineering |
| 6 | **InfinityPool APY calculation** | For pools using `zealPerBlock()` emissions, calculate APY using `(rewardPerBlock × blocksPerYear × tokenPrice) / TVL`. For pools with manual reward distribution, calculate APY using reward schedule and pool TVL. Display results as **estimated APY** and refresh periodically. | Engineering |
| 7 | **User authentication** | MVP should rely **only on wallet connection for identity**. Preferences and conversation history can be stored in **local storage or optional backend sessions linked to wallet signatures**. Full user accounts can be introduced later if cross-device persistence is required. | Product |
| 8 | **Gas sponsorship** | Do not sponsor gas initially. Evaluate onboarding friction first. If necessary, introduce **limited gas sponsorship for first-time users** (e.g., first 3 transactions per wallet) using a relayer system with strict limits to prevent abuse. | Product / Business |
| 9 | **Legal disclaimers** | Include disclaimers stating that the AI provides **informational assistance only and not financial advice**. Users must confirm they understand and approve every transaction before signing. Legal review should be conducted before public launch to ensure compliance with applicable jurisdictions. | Legal |
| 10 | **Analytics and telemetry** | Use a **privacy-focused analytics platform** such as PostHog or Plausible. Track anonymized events such as wallet connected, strategy suggested, transaction prepared, and transaction executed. Avoid storing raw wallet addresses in analytics logs to protect user privacy. | Product / Engineering |

---

*This document is a living artifact. It will be updated as open questions are resolved and requirements evolve during development.*
