# KasAgentV2 — Complete Codebase Research Report

> **Generated**: 2026-03-17
> **Branch**: `canvas-redesign`
> **Scope**: Full codebase deep-dive — architecture, every directory, all files, all connections

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Directory Structure](#3-directory-structure)
4. [Configuration Layer](#4-configuration-layer)
5. [Routing & App Shell](#5-routing--app-shell)
6. [Authentication System (SIWE + JWT)](#6-authentication-system-siwe--jwt)
7. [Database & Persistence](#7-database--persistence)
8. [Blockchain Client & On-Chain Data](#8-blockchain-client--on-chain-data)
9. [Protocol Integrations](#9-protocol-integrations)
10. [AI System & LLM Integration](#10-ai-system--llm-integration)
11. [AI Tools — Complete Inventory](#11-ai-tools--complete-inventory)
12. [Strategy Planning & Execution Engine](#12-strategy-planning--execution-engine)
13. [React Hooks — Complete Inventory](#13-react-hooks--complete-inventory)
14. [Component Architecture](#14-component-architecture)
15. [State Management](#15-state-management)
16. [Feed & Insights System](#16-feed--insights-system)
17. [Token Discovery & Registry](#17-token-discovery--registry)
18. [Formatting & Utility Layer](#18-formatting--utility-layer)
19. [RPC Optimization & Multicall Strategy](#19-rpc-optimization--multicall-strategy)
20. [Security Model](#20-security-model)
21. [Key Architectural Decisions](#21-key-architectural-decisions)
22. [Data Flow Diagrams](#22-data-flow-diagrams)
23. [File Reference Index](#23-file-reference-index)

---

## 1. Project Overview

**KasAgentV2** is an AI-powered DeFi copilot for **Kasplex L2** (Chain ID `202555`). It provides a conversational interface where users interact with Claude to manage their DeFi portfolios — swapping tokens, providing liquidity, farming, staking, and executing multi-step strategies — all without leaving the chat.

**Core Value Proposition**: Users describe what they want in natural language ("put my idle KAS to work", "find the best swap rate for ZEAL"), and the AI researches, plans, and prepares transactions that the user signs with their own wallet. The app is fully non-custodial.

**Key Facts**:
- **Network**: Kasplex L2 Mainnet (Chain ID 202555)
- **RPC**: `https://evmrpc.kasplex.org`
- **Explorer**: `https://explorer.kasplex.org`
- **Protocols**: ZealousSwap (full-featured), KrokoSwap (swap), KaspaCom (swap)
- **AI Model**: Claude Sonnet 4 (`claude-sonnet-4-20250514`)
- **Auth**: Sign-In With Ethereum (SIWE) + JWT httpOnly cookies

---

## 2. Technology Stack

### Frontend
| Library | Version | Purpose |
|---------|---------|---------|
| Next.js | 16.1.6 | App framework with App Router + Turbopack |
| React | 19.2.3 | UI library |
| wagmi | 2.19.5 | React hooks for Ethereum wallets |
| viem | 2.46.3 | Low-level Ethereum client (contract reads/writes) |
| RainbowKit | 2.2.10 | Wallet connection UI modal |
| TanStack Query | 5.90.21 | Server state management / caching |
| Zustand | 5.0.12 | Client-side UI state (panel open/close) |
| Tailwind CSS | 4.x | Utility-first styling (dark theme) |
| Lucide React | 0.577.0 | Icon library |
| React Markdown | 10.1.0 | Markdown rendering for AI responses |

### Backend / Server
| Library | Version | Purpose |
|---------|---------|---------|
| AI SDK | 6.0.112 | Vercel AI SDK for streaming LLM chat |
| @ai-sdk/anthropic | 3.0.55 | Claude provider for AI SDK |
| SIWE | 3.0.0 | Sign-In With Ethereum standard |
| jose | 6.2.1 | JWT signing/verification (HS256) |
| Supabase.js | 2.98.0 | PostgreSQL client with RLS |
| Zod | 4.3.6 | Runtime schema validation |
| server-only | 0.0.1 | Prevents server code leaking to client bundles |

### Build / Dev
| Tool | Version | Purpose |
|------|---------|---------|
| TypeScript | 5.x | Type safety (strict mode, ES2020 target) |
| Turbopack | (bundled) | Fast dev builds via `next dev --turbopack` |
| ESLint | 9.x | Flat config with Next.js Core Web Vitals rules |
| tsx | 4.21.0 | TypeScript script executor (benchmark) |

---

## 3. Directory Structure

```
KasAgentV2/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root HTML + font loading + Providers
│   ├── providers.tsx             # WagmiProvider + QueryClient + AuthProvider
│   ├── globals.css               # Tailwind 4 + RainbowKit styles + dark theme
│   ├── global-error.tsx          # App-level crash fallback
│   ├── (app)/                    # Route group (shared AppShell layout)
│   │   ├── layout.tsx            # AppShell wrapper
│   │   ├── page.tsx              # "/" — Feed + new chat
│   │   ├── error.tsx             # Route-level error boundary
│   │   ├── not-found.tsx         # 404 page
│   │   └── c/[id]/
│   │       └── page.tsx          # "/c/[id]" — Existing conversation
│   └── api/                      # API routes
│       ├── auth/
│       │   ├── nonce/route.ts    # POST — Generate SIWE nonce
│       │   ├── verify/route.ts   # POST — Verify signature + issue JWT
│       │   ├── signout/route.ts  # POST — Clear auth cookie
│       │   └── me/route.ts       # GET  — Check auth status
│       ├── chat/route.ts         # POST — Streaming AI chat
│       ├── conversations/
│       │   ├── route.ts          # GET  — List conversations
│       │   └── [id]/route.ts     # DELETE — Delete conversation
│       ├── execution-states/route.ts  # POST — Save tx execution state
│       └── feed/route.ts         # POST — Compute portfolio insights
│
├── components/                   # React components (44 files)
│   ├── chat/                     # Chat UI
│   │   ├── Chat.tsx              # Top-level orchestrator
│   │   ├── ChatContainer.tsx     # Core state management
│   │   ├── ChatInput.tsx         # Auto-growing textarea + send/stop
│   │   ├── ChatMessage.tsx       # Individual message (memo)
│   │   ├── MessageList.tsx       # Message list + auto-scroll
│   │   ├── AnimatedMarkdown.tsx  # Streaming text animation
│   │   ├── MarkdownRenderer.tsx  # Custom react-markdown (memo)
│   │   ├── ToolPartRenderer.tsx  # Tool card dispatch
│   │   ├── QuickActions.tsx      # Follow-up action buttons
│   │   ├── WelcomeScreen.tsx     # Starter suggestions
│   │   ├── CardErrorBoundary.tsx # Error boundary for cards
│   │   ├── ExecutionStateContext.tsx # Execution state React context
│   │   └── cards/               # Tool output cards (24 files)
│   │       ├── shared/ExecutionCardParts.tsx  # Shared card components
│   │       ├── SwapQuoteCard.tsx
│   │       ├── SwapExecutionCard.tsx
│   │       ├── SwapComparisonCard.tsx
│   │       ├── KrokoSwapExecutionCard.tsx
│   │       ├── AddLiquidityCard.tsx
│   │       ├── RemoveLiquidityCard.tsx
│   │       ├── AllPairsCard.tsx
│   │       ├── PoolReservesCard.tsx
│   │       ├── FarmsTableCard.tsx
│   │       ├── FarmStakeCard.tsx
│   │       ├── FarmUnstakeCard.tsx
│   │       ├── InfinityPoolRatesCard.tsx
│   │       ├── InfinityStakeCard.tsx
│   │       ├── InfinityUnstakeCard.tsx
│   │       ├── YieldOpportunitiesCard.tsx
│   │       ├── MembershipStatusCard.tsx
│   │       ├── StrategyPlanCard.tsx
│   │       ├── TransactionHistoryCard.tsx
│   │       ├── SpyPortfolioCard.tsx
│   │       ├── PriceCard.tsx
│   │       ├── ToolCardSkeleton.tsx
│   │       └── ToolErrorCard.tsx
│   ├── feed/
│   │   ├── FeedContainer.tsx     # Insight card list
│   │   └── FeedCard.tsx          # Individual insight card
│   ├── header/
│   │   ├── AppHeader.tsx         # Top bar (wallet, balance, toggles)
│   │   └── NetworkStatus.tsx     # Chain connection indicator
│   ├── shell/
│   │   ├── AppShell.tsx          # Main layout wrapper
│   │   ├── LeftRail.tsx          # Conversation sidebar (responsive)
│   │   └── PortfolioSlideOut.tsx # Portfolio panel overlay
│   └── sidebar/
│       ├── ConversationList.tsx  # Grouped conversation list
│       └── PortfolioPanel.tsx    # Wallet positions display
│
├── config/                       # Configuration (6 files + 14 ABIs)
│   ├── contracts.ts              # ZealousSwap contract addresses
│   ├── protocols.ts              # Protocol registry (3 DEXes)
│   ├── chains.ts                 # Kasplex L2 chain definition
│   ├── wagmi.ts                  # Wagmi + RainbowKit config
│   ├── tokens.ts                 # Token metadata + logos
│   ├── pools.ts                  # InfinityPool configurations
│   └── abis/                     # Contract ABIs (14 files)
│       ├── index.ts              # Barrel export
│       ├── erc20.ts, router.ts, factory.ts, pair.ts
│       ├── masterchef.ts, permit2.ts
│       ├── infinityPoolZeal.ts, infinityPoolSimple.ts
│       ├── discountManager.ts, membership.ts, nftStaking.ts
│       ├── kaspacomRouter.ts, v2SwapAbi.ts
│       └── (all use viem parseAbi() for type safety)
│
├── hooks/                        # React hooks (16 files)
│   ├── usePortfolio.ts           # Aggregate portfolio (master hook)
│   ├── useTokenBalances.ts       # ERC20 + native KAS balances
│   ├── useLpPositions.ts         # LP token positions across all DEXes
│   ├── useFarmPositions.ts       # MasterChef staked positions
│   ├── useStakingPositions.ts    # InfinityPool xToken positions
│   ├── useActiveFarms.ts         # Farm pool metadata
│   ├── useAllPairs.ts            # All trading pairs from all factories
│   ├── useTokenRegistry.ts       # Token symbol/decimals registry
│   ├── useInfinityPoolData.ts    # InfinityPool rates + metrics
│   ├── useConversations.ts       # Conversation list + optimistic delete
│   ├── useCardExecution.ts       # Multi-step tx execution lifecycle
│   ├── useExecutionPersistence.ts # Fire-and-forget DB save
│   ├── useStrategyAutoContinue.ts # Auto-advance after execution
│   ├── useFeedInsights.ts        # Feed insight fetching
│   ├── useAnimatedText.ts        # Character-by-character animation
│   └── useReconnectOnFocus.ts    # Mobile Safari WalletConnect fix
│
├── lib/                          # Core utilities & AI system
│   ├── auth.ts                   # JWT signing, SIWE verification, nonce gen
│   ├── auth-middleware.ts        # Request-level auth extraction
│   ├── auth-server.ts            # Server component auth helper
│   ├── auth-provider.tsx         # React auth context + RainbowKit adapter
│   ├── api-handler.ts            # withAuth() API route wrapper
│   ├── env.ts                    # Zod-validated environment variables
│   ├── validation.ts             # ETH address regex
│   ├── format.ts                 # Token/price/time formatting
│   ├── supabase.ts               # Supabase client (service role)
│   ├── viem-client.ts            # Singleton viem PublicClient
│   ├── multicall.ts              # Multicall result helper
│   ├── token-registry.ts         # On-chain token/pair discovery + cache
│   ├── discount.ts               # Fee discount eligibility check
│   ├── kroko-api.ts              # KrokoSwap REST API client
│   ├── types.ts                  # ChatTools, ChatMessage type aliases
│   ├── db/
│   │   └── queries.ts            # Conversation + message CRUD
│   ├── ai/
│   │   ├── system-prompt.ts      # 3-part cached system prompt builder
│   │   ├── tool-types.ts         # TypeScript interfaces for all tool results
│   │   ├── serializers.ts        # Portfolio → AI-friendly format
│   │   ├── quick-actions.ts      # Context-aware follow-up suggestions
│   │   └── tools/
│   │       ├── index.ts          # Aggregates all 23 tools → aiTools
│   │       ├── helpers.ts        # Backward-compat re-export
│   │       ├── shared/
│   │       │   └── helpers.ts    # Generic V2 DEX utilities
│   │       ├── zealous/          # ZealousSwap tools (14 tools)
│   │       │   ├── index.ts, helpers.ts
│   │       │   ├── swap.ts, liquidity.ts, pairs.ts
│   │       │   ├── farms.ts, staking.ts, yield.ts
│   │       │   └── membership.ts
│   │       ├── kroko/            # KrokoSwap tools (2 tools)
│   │       │   ├── index.ts, helpers.ts
│   │       │   └── swap.ts
│   │       ├── kaspacom/         # KaspaCom tools (2 tools)
│   │       │   ├── index.ts, helpers.ts
│   │       │   └── swap.ts
│   │       ├── compare.ts        # Cross-DEX comparison (1 tool)
│   │       ├── strategy.ts       # Multi-step strategy planner (1 tool)
│   │       ├── history.ts        # Transaction history (1 tool)
│   │       ├── spy.ts            # Portfolio inspector (1 tool)
│   │       └── oracle.ts         # Token price oracle (1 tool)
│   ├── ui/
│   │   ├── parse-tool-part.ts    # Parse tool invocations from messages
│   │   ├── strategy-helpers.ts   # Strategy progress tracking
│   │   └── tool-card-registry.tsx # Tool name → React card mapping
│   └── feed/
│       ├── types.ts              # FeedInsight type definition
│       └── compute-insights.ts   # Insight generation logic
│
├── stores/
│   └── ui.ts                     # Zustand store (portfolioPanel, leftRail)
│
├── scripts/
│   └── benchmark-rpc.ts          # RPC call count verification
│
├── public/                       # Static assets (SVGs)
│
└── (config files)
    ├── package.json, tsconfig.json, next.config.ts
    ├── postcss.config.mjs, eslint.config.mjs
    └── .env.local
```

---

## 4. Configuration Layer

### `tsconfig.json` — Key Choices
- **Target**: `ES2020` — Required for BigInt literal support (`1000n`) used by viem/wagmi
- **Path alias**: `@/*` → `./` — All imports use `@/lib/...`, `@/hooks/...`, etc.
- **Strict mode**: Enabled — Full TypeScript type checking
- **Module resolution**: `bundler` — Optimized for Turbopack

### `next.config.ts` — Minimal
```ts
turbopack: {
  resolveAlias: {
    "@react-native-async-storage/async-storage": { browser: "" }
  }
}
```
The only customization disables a React Native dependency that leaks from RainbowKit into browser bundles.

### `postcss.config.mjs` — Tailwind 4
```js
plugins: { "@tailwindcss/postcss": {} }
```
Tailwind v4 uses CSS-native configuration (no `tailwind.config.ts`). All theme customization lives in `app/globals.css` via `@theme inline` directive.

### `globals.css` — Theme
- Imports RainbowKit styles before Tailwind
- Dark mode via `prefers-color-scheme: dark`
- Custom CSS variables: `--background: #0a0a0a`, `--foreground: #ededed`
- Geist Sans + Mono fonts
- Custom scrollbar styling (thin, dark gray)
- `html, body { height: 100%; overflow: hidden }` — Full viewport, no root scroll

### `.env.local` — Environment Variables

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Public | WalletConnect bridge |
| `ANTHROPIC_API_KEY` | Server | Claude API authentication |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon key (RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Supabase server-side operations |
| `JWT_SECRET` | Server | SIWE JWT signing (must be 32+ chars) |
| `NEXT_PUBLIC_RPC_URL` | Public | Primary RPC (default: evmrpc.kasplex.org) |
| `NEXT_PUBLIC_RPC_URL_FALLBACK` | Public | Optional fallback RPC |
| `EXPLORER_API_URL` | Server | Block explorer API base URL |

### `wagmi.ts` — Wallet Configuration
- Uses RainbowKit's `getDefaultConfig()` with Kasplex L2 chain
- HTTP transport: 2 retries, 10s timeout, batch size 100 (50ms wait)
- Fallback transport support if `NEXT_PUBLIC_RPC_URL_FALLBACK` is set
- Cookie-based storage for SSR hydration

### `env.ts` — Zod Validation
- Client env and server env validated with Zod schemas at import time
- Server env throws if imported in client context (`server-only` guard)
- Provides defaults for RPC URL and explorer URL

---

## 5. Routing & App Shell

### Route Map

```
/                    → app/(app)/page.tsx    — Feed + new chat (fresh UUID each visit)
/c/[id]              → app/(app)/c/[id]/page.tsx — Load existing conversation

POST /api/auth/nonce       — Generate SIWE nonce (rate limited)
POST /api/auth/verify      — Verify signature, issue JWT
POST /api/auth/signout     — Clear auth cookie
GET  /api/auth/me          — Check auth status

POST /api/chat             — Streaming AI chat with tool use
GET  /api/conversations    — List user's conversations
DELETE /api/conversations/[id] — Delete conversation

POST /api/execution-states — Save transaction execution state
POST /api/feed             — Compute portfolio insights
```

### Layout Hierarchy

```
RootLayout (server: fonts, cookies)
  └─ Providers (client: WagmiProvider → QueryClient → AuthProvider)
       └─ AppLayout
            └─ AppShell (client: reconnect, auth check)
                 ├─ AppHeader (wallet, balance, network, toggles)
                 ├─ LeftRail (conversation sidebar — responsive drawer)
                 ├─ Main Content
                 │   ├─ "/" → Feed + Chat (new conversation)
                 │   └─ "/c/[id]" → Chat (existing conversation)
                 └─ PortfolioSlideOut (right panel — positions)
```

### Key Behaviors

- **`/` (Home)**: Server component generates fresh UUID with `crypto.randomUUID()`, calls `await cookies()` to prevent static caching, renders `Chat` with empty messages. Shows feed if authenticated and no messages yet.

- **`/c/[id]` (Conversation)**: Server component authenticates via `getServerWallet()` (redirects to `/` if unauthenticated), queries DB with `getConversationWithMessages(id, wallet)`, returns 404 if not found, renders `Chat` with loaded messages + execution states.

- **URL Management**: When user sends first message on `/`, Chat uses `history.pushState` to update URL to `/c/{id}` without navigation. Browser back/forward works correctly.

---

## 6. Authentication System (SIWE + JWT)

### Complete Flow

```
1. User clicks "Connect Wallet" → RainbowKit modal opens
2. User selects wallet (MetaMask, WalletConnect, etc.)
3. Wallet connected → RainbowKit triggers SIWE flow
4. Client calls POST /api/auth/nonce { address }
   ├─ Server validates address format
   ├─ Rate limit check: supabase.rpc("check_rate_limit")
   ├─ Generates random 16-byte hex nonce
   ├─ Stores in auth_sessions (10-minute expiry)
   └─ Returns { nonce }
5. Client constructs SIWE message (domain, chainId 202555, nonce, URI)
6. User signs message in wallet
7. Client calls POST /api/auth/verify { message, signature }
   ├─ Verifies SIWE signature (domain + chainId validation)
   ├─ Atomically deletes nonce from DB (prevents replay + TOCTOU)
   ├─ Cleans up expired sessions for wallet
   ├─ Signs JWT with wallet address (7-day expiry, HS256)
   └─ Sets httpOnly cookie (Secure, SameSite=Strict)
8. All subsequent API calls authenticate via cookie
   └─ withAuth() → getAuthenticatedWallet(req) → reads JWT from cookie
```

### Implementation Files
| File | Purpose |
|------|---------|
| `lib/auth.ts` | JWT sign/verify, SIWE verify, nonce generation |
| `lib/auth-middleware.ts` | `getAuthenticatedWallet()`, `requireAuth()` |
| `lib/auth-server.ts` | `getServerWallet()` — server component helper |
| `lib/auth-provider.tsx` | React context, RainbowKit SIWE adapter |
| `lib/api-handler.ts` | `withAuth()` — API route wrapper |

### Security Properties
- **httpOnly cookies**: JavaScript cannot access the JWT
- **Domain validation**: SIWE message must match request host
- **Chain ID validation**: Must be 202555 (Kasplex L2)
- **Atomic nonce deletion**: Single DB DELETE prevents replay and race conditions
- **Rate limiting**: 30 requests/15 minutes per wallet (Supabase RPC, fails closed → 503)
- **Lowercase addresses**: All wallet addresses normalized to lowercase throughout

---

## 7. Database & Persistence

### Supabase Schema (project: `psxpupepxxvooamkwncz`)

| Table | Fields | RLS |
|-------|--------|-----|
| `conversations` | id, wallet_address, title, created_at, updated_at | Per-wallet |
| `messages` | id, conversation_id, role, parts (JSON), created_at | Per-wallet (via conversation) |
| `execution_states` | conversation_id, tool_call_id, state, tx_hash, created_at | Per-wallet (via conversation) |
| `auth_sessions` | wallet_address, nonce, expires_at | Per-wallet |
| `rate_limits` | wallet_address, request_count, window_start | Per-wallet |
| `feed_cache` | wallet_address, insights (JSON), expires_at | Per-wallet |

### Query Functions (`lib/db/queries.ts`)

| Function | Purpose |
|----------|---------|
| `generateTitle(messages)` | Extracts title from first user message (max 60 chars) |
| `createConversation(id, wallet, title)` | Upsert new conversation |
| `getConversationOwner(id)` | Returns wallet address (ownership check) |
| `saveMessage(conversationId, message)` | Insert message with serialized parts |
| `getMessages(conversationId)` | Load all messages sorted by created_at |
| `getConversationWithMessages(id, wallet)` | Verify ownership + load messages + execution states |
| `updateConversationTimestamp(id)` | Touch updated_at |
| `deleteLastAssistantMessages(id)` | Remove responses after last user message (for regenerate) |

### Persistence Patterns
- **Messages**: Saved immediately on user submit; assistant response saved after stream completes
- **Execution states**: Fire-and-forget via `useExecutionPersistence` — does NOT block the execution flow
- **Feed cache**: 2-minute TTL in `feed_cache` table; avoids recomputing insights on every load
- **Conversation auto-create**: First message on `/` creates conversation in DB automatically

---

## 8. Blockchain Client & On-Chain Data

### Singleton Client (`lib/viem-client.ts`)
```ts
client = createPublicClient({
  chain: kasplexL2,
  transport: fallback([http(primary), http(fallback)]),  // or just http(primary)
  batch: { multicall: true }
})
```
- Single instance used by ALL server-side contract reads
- 2 retries, 15s timeout
- Fallback RPC support
- Multicall3 batching enabled

### Chain Definition (`config/chains.ts`)
```ts
kasplexL2 = defineChain({
  id: 202555,
  name: "Kasplex L2",
  nativeCurrency: { name: "KAS", symbol: "KAS", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc.kasplex.org"] } },
  contracts: {
    multicall3: { address: "0x52f1eCcB5af51F2AFe0Dfb2f809F8617fDAA5be4" }
  }
})
```

### Multicall Strategy
All on-chain reads are aggressively batched using Multicall3. The `lib/multicall.ts` helper:
```ts
mcResult(entry, fallback)  // Returns result if success, else fallback
```

This is verified by `scripts/benchmark-rpc.ts` which counts actual HTTP requests per tool invocation and ensures they stay within budget (e.g., token discovery: 4-6 RPCs, yield discovery: 2 RPCs, infinity pool rates: 1 RPC).

---

## 9. Protocol Integrations

### Protocol Registry (`config/protocols.ts`)

All protocols are registered in a central `PROTOCOLS` object with type-safe helpers.

#### ZealousSwap — Full DeFi Suite

| Feature | Details |
|---------|---------|
| **Type** | AMM DEX (Uniswap V2 fork) |
| **Swap** | Variable fee: 0.3% default, 0.2% with discount |
| **Liquidity** | Standard V2 LP provision (token+token or KAS+token) |
| **Farms** | MasterChef with ZEAL emissions, allocation points, 7-day lock |
| **Staking** | InfinityPools for ZEAL, NACHO, KASPER (single-sided, xToken model) |
| **Membership** | Tier-based membership with expiry dates |
| **NFT Staking** | Staking power system, qualifies for fee discount |
| **Discount** | 0.2% fee if user has membership OR 1000+ xZEAL OR qualifying NFT stake |

**Key Contracts**:

| Contract | Address |
|----------|---------|
| Router | `0xA5B0946D31aD2d251e0fe2dfEA8808BFd475e607` |
| Factory | `0x98Bb580A77eE329796a79aBd05c6D2F2b3D5E1bD` |
| MasterChef | `0x97ac386fFf8d25Bc3F949194f74a79E94617bc7F` |
| InfinityPool ZEAL | `0x1E7748BA1d372186a322E7CfaAB1306f19FfB897` |
| InfinityPool NACHO | `0x0d4f07811718C0eE57EA2FCDb844c3585ae0F315` |
| InfinityPool KASPER | `0xa1074f1cD056862ebA654344518aa8c6DE0afE74` |
| WKAS | `0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e` |
| DiscountManager | `0x3da82fa26d8756a557e475cfb2ee854937618e83` |
| Membership | `0x8b32421d78a066f52035c242513055ed15047ee6` |
| NFT Staking | `0xc5919064b3751d9402a974fff2680f78a36e1ff6` |

#### KrokoSwap — Dual-AMM (V2 + V3)

| Feature | Details |
|---------|---------|
| **Type** | Dual AMM: V2 constant-product + V3 concentrated liquidity |
| **Swap** | Universal Router for optimal cross-pool routing |
| **Approval** | Permit2 flow (approve Permit2 once, grant per-spender allowance) |
| **API** | REST API at `https://krokoswap.io/swap-api` for quoting/calldata |
| **Fees** | Variable (determined by pool) |

**Key Contracts**:

| Contract | Address |
|----------|---------|
| Permit2 | `0x2E1987F680FD7Bc8B33d3Bf94f12B988A0B50034` |
| Universal Router | `0xefeCc1c2dE3BfE4C6D43030F2AcDD5C3cE279024` |
| V2 Factory | `0x4373b7Fcf5059A785843cD224129e01d243Aef71` |
| V2 Router | `0xC7ca845B8302346e1C7227f03bb9EFb35ecD51fe` |
| V3 Factory | `0x0dfb1Bb755d872EA1fa4d95E4ad0c2E6317Ce9B9` |

#### KaspaCom — Simple V2 Fork

| Feature | Details |
|---------|---------|
| **Type** | Uniswap V2 fork |
| **Swap** | Fixed 1% fee hardcoded in pair math |
| **Naming** | ETH-style naming (`swapExactETHForTokens`, `WETH()`) |
| **Other** | No farms, staking, discounts, or membership |

**Key Contracts**:

| Contract | Address |
|----------|---------|
| Router | `0x3a1f0bD164fe9D8fa18Da5abAB352dC634CA5F10` |
| Factory | `0xa9CBa43A407c9Eb30933EA21f7b9D74A128D613c` |

### Adding a New Protocol
1. Add entry to `PROTOCOLS` in `config/protocols.ts` (id, name, type, features, contracts)
2. Create tool module in `lib/ai/tools/{protocol}/`
3. Add card components in `components/chat/cards/`
4. Register cards in `lib/ui/tool-card-registry.tsx`
5. No changes needed to shared infrastructure

---

## 10. AI System & LLM Integration

### Architecture

```
User message → POST /api/chat
  ├─ Auth check (JWT from cookie)
  ├─ Rate limit check (30/15min per wallet)
  ├─ Load/create conversation in DB
  ├─ Build system prompt (3-part with cache hints)
  ├─ streamText({
  │     model: claude-sonnet-4-20250514,
  │     system: systemPrompt,
  │     messages: conversationHistory,
  │     tools: aiTools (23 tools),
  │     maxSteps: 5
  │   })
  ├─ Stream response to client
  ├─ Save assistant message to DB on finish
  └─ Update conversation timestamp
```

### System Prompt Architecture (`lib/ai/system-prompt.ts`)

The system prompt uses Anthropic's ephemeral caching to minimize token costs:

**Block 1 — Static (cached indefinitely)**
- Identity: "You are KasAgent, an AI DeFi copilot for Kasplex L2"
- 50+ behavior rules covering:
  - When to use `compareSwapQuotes` vs protocol-specific tools
  - Swap flow: quote first → show to user → user confirms → prepare TX
  - Strategy planning: research → plan → user approval → step-by-step execution
  - Yield discovery guidelines
  - Portfolio presentation format
  - Risk disclosures
  - Discount awareness

**Block 2 — Semi-static (5-minute ephemeral cache)**
- Protocol knowledge: All contracts, features, factory types
- Complete token list with symbols and decimals (from discovery cache)
- Chain information (ID, RPC, explorer)

**Block 3 — Dynamic (NOT cached, per-request)**
- Connected wallet address
- Token balances (formatted as markdown table)
- LP positions with amounts
- Farm positions with pending rewards
- Staking positions with xToken balances
- Discount eligibility status

### Chat Route (`app/api/chat/route.ts`)

**Request payload**:
```ts
{
  conversationId: string,
  message: UIMessage,
  portfolio?: SerializedPortfolio,      // Current wallet positions
  infinityPools?: SerializedInfinityPool[], // Pool exchange rates
  trigger?: "regenerate-message"        // Optional regenerate flag
}
```

**Key behaviors**:
- Auto-creates conversation on first message
- Generates title from first user text (max 60 chars)
- On "regenerate": deletes last assistant messages, re-streams
- Loads full message history from DB (not just last N)
- `result.consumeStream()` ensures stream completes even if client disconnects
- 401/429/502/503 error responses with appropriate messages

---

## 11. AI Tools — Complete Inventory

### Tool Naming Convention
- Protocol-specific: `{protocol}_{action}` (e.g., `zealous_prepareSwap`, `kroko_getSwapQuote`)
- Shared/cross-protocol: No prefix (e.g., `compareSwapQuotes`, `getTokenPrice`)

### All 23 Tools

#### ZealousSwap (14 tools)

| Tool | File | Purpose |
|------|------|---------|
| `zealous_getSwapQuote` | zealous/swap.ts | Get expected output for token swap |
| `zealous_prepareSwap` | zealous/swap.ts | Full swap TX preparation with approvals |
| `zealous_getPoolReserves` | zealous/liquidity.ts | Read pair reserves + total LP supply |
| `zealous_prepareAddLiquidity` | zealous/liquidity.ts | Prepare add-liquidity TX with optimal amounts |
| `zealous_prepareRemoveLiquidity` | zealous/liquidity.ts | Prepare remove-liquidity TX (percentage-based) |
| `zealous_getActiveFarms` | zealous/farms.ts | List all active farm pools with allocation data |
| `zealous_prepareFarmStake` | zealous/farms.ts | Stake LP tokens to MasterChef (7-day lock check) |
| `zealous_prepareFarmUnstake` | zealous/farms.ts | Unstake LP from farm + claim pending rewards |
| `zealous_getInfinityPoolRates` | zealous/staking.ts | Exchange rates for ZEAL/NACHO/KASPER pools |
| `zealous_prepareInfinityStake` | zealous/staking.ts | Stake token → xToken (single-sided) |
| `zealous_prepareInfinityUnstake` | zealous/staking.ts | Unstake xToken → token |
| `zealous_listAllPairs` | zealous/pairs.ts | Discover ALL pairs across all DEXes |
| `zealous_discoverYieldOpportunities` | zealous/yield.ts | Ranked yield sources with APY + risk flags |
| `zealous_getMembershipStatus` | zealous/membership.ts | Discount eligibility, membership tier, NFT power |

#### KrokoSwap (2 tools)

| Tool | File | Purpose |
|------|------|---------|
| `kroko_getSwapQuote` | kroko/swap.ts | Quote via KrokoSwap REST API (V2+V3 routing) |
| `kroko_prepareSwap` | kroko/swap.ts | Prepare swap with Permit2 approval flow |

#### KaspaCom (2 tools)

| Tool | File | Purpose |
|------|------|---------|
| `kaspacom_getSwapQuote` | kaspacom/swap.ts | Quote with 1% fixed fee |
| `kaspacom_prepareSwap` | kaspacom/swap.ts | Prepare swap TX (standard V2) |

#### Cross-Protocol & Utility (5 tools)

| Tool | File | Purpose |
|------|------|---------|
| `compareSwapQuotes` | compare.ts | Compare rates across all 3 DEXes in parallel |
| `planStrategy` | strategy.ts | Multi-step strategy planner (2-8 steps, chaining) |
| `getTokenPrice` | oracle.ts | Spot price from deepest WKAS pair |
| `getTransactionHistory` | history.ts | Recent TXs with action labels + token transfers |
| `spyOnWallet` | spy.ts | Read-only portfolio scan for any wallet |

### Shared Helper Functions (`lib/ai/tools/shared/helpers.ts`)

| Function | Purpose |
|----------|---------|
| `findBestPathForRouter(opts)` | Try direct path, fall back to WKAS intermediary |
| `estimateGasCost(gasUnits)` | Estimate KAS cost for gas |
| `calculateMinAmount(raw, slippage)` | Apply slippage to expected output |
| `checkAllowance(token, owner, spender, amount)` | Check ERC20 approval status |
| `calculatePriceImpactForFactory(factory, path, amtIn, amtOut)` | Compute % impact from reserves |
| `checkPoolLiquidity(factory, path, riskFlags)` | Flag low-liquidity hops (<1000 KAS) |

### Tool → Card Mapping (`lib/ui/tool-card-registry.tsx`)

Every tool's output maps to a specific React component for rich rendering:

| Tool | Card Component |
|------|----------------|
| `zealous_getSwapQuote` | `SwapQuoteCard` |
| `zealous_prepareSwap` | `SwapExecutionCard` |
| `zealous_prepareAddLiquidity` | `AddLiquidityCard` |
| `zealous_prepareRemoveLiquidity` | `RemoveLiquidityCard` |
| `zealous_getActiveFarms` | `FarmsTableCard` |
| `zealous_prepareFarmStake` | `FarmStakeCard` |
| `zealous_prepareFarmUnstake` | `FarmUnstakeCard` |
| `zealous_getInfinityPoolRates` | `InfinityPoolRatesCard` |
| `zealous_prepareInfinityStake` | `InfinityStakeCard` |
| `zealous_prepareInfinityUnstake` | `InfinityUnstakeCard` |
| `zealous_listAllPairs` | `AllPairsCard` |
| `zealous_discoverYieldOpportunities` | `YieldOpportunitiesCard` |
| `zealous_getMembershipStatus` | `MembershipStatusCard` |
| `zealous_getPoolReserves` | `PoolReservesCard` |
| `kroko_getSwapQuote` | `SwapQuoteCard` |
| `kroko_prepareSwap` | `KrokoSwapExecutionCard` |
| `kaspacom_getSwapQuote` | `SwapQuoteCard` |
| `kaspacom_prepareSwap` | `SwapExecutionCard` |
| `compareSwapQuotes` | `SwapComparisonCard` |
| `planStrategy` | `StrategyPlanCard` |
| `getTokenPrice` | `PriceCard` |
| `getTransactionHistory` | `TransactionHistoryCard` |
| `spyOnWallet` | `SpyPortfolioCard` |

### Quick Actions (`lib/ai/quick-actions.ts`)

After tool output, context-aware follow-up buttons appear:

| After Tool | Suggested Actions |
|------------|-------------------|
| `zealous_getSwapQuote` | "Stake tokens", "Find better rate" |
| `compareSwapQuotes` | "Execute best" |
| `planStrategy` | "Start: [first step]", "Modify plan" |
| `getTransactionHistory` | "Check portfolio", "Find yield" |
| Execution tools | (none — action already taken) |

---

## 12. Strategy Planning & Execution Engine

### Strategy Flow

```
1. User: "Farm 1000 KAS in the best pool"

2. AI researches: calls discovery tools, checks yield opportunities

3. AI calls planStrategy with steps:
   [
     { type: "swap", protocol: "zealous", tokenIn: "KAS", tokenOut: "ZEAL", amountIn: "500" },
     { type: "addLiquidity", protocol: "zealous", tokenA: "KAS", tokenB: "ZEAL", amountA: "500", amountB: "auto" },
     { type: "farmStake", protocol: "zealous", lpToken: "KAS-ZEAL", amount: "auto" }
   ]

4. planStrategy:
   - Fetches live quotes for each step
   - Chains outputs: "auto" uses previous step's result
   - Computes total gas estimate
   - Returns StrategyPlanCard with numbered steps

5. User reviews plan → "Let's start"

6. AI prepares step 1 (zealous_prepareSwap)
   → User signs → TX confirmed

7. useStrategyAutoContinue:
   - Calls portfolioRefetch()
   - Waits for refetch to complete (sawFetching pattern)
   - Sends continuation message: "Step 1 completed. Continue with step 2."

8. AI prepares step 2 with fresh balances
   → Repeat until all steps complete

9. AI sends summary: "Strategy complete! All 3 steps executed."
```

### Strategy Types (7 step types)
1. `swap` — Token-to-token swap
2. `addLiquidity` — Provide LP
3. `removeLiquidity` — Withdraw LP
4. `farmStake` — Stake LP in MasterChef
5. `farmUnstake` — Unstake LP from MasterChef
6. `infinityStake` — Single-sided staking
7. `infinityUnstake` — Single-sided unstaking

### Auto-Continue Mechanism (`hooks/useStrategyAutoContinue.ts`)

After each successful execution:
1. `onExecutionSuccess` triggers portfolio refetch
2. Effect watches `portfolioIsFetching`: waits for `true → false` transition
3. After 1500ms delay: counts completed steps, sends continuation message
4. Uses `sawFetchingRef` to prevent premature firing before refetch starts
5. Uses `abortedRef`-like pattern to handle race conditions

---

## 13. React Hooks — Complete Inventory

### Data Hook Dependency Graph

```
Level 0 (Contract reads only):
  useActiveFarms ──────── MasterChef globals + pool info
  useAllPairs ─────────── All V2 factory pairs (multi-factory)
  useInfinityPoolData ─── 3 InfinityPool rates (11 reads in 1 multicall)

Level 1 (Depends on Level 0):
  useFarmPositions ────── useActiveFarms → user stakes per pool
  useTokenRegistry ────── useAllPairs → deduplicated token list
  useStakingPositions ─── useInfinityPoolData → user xToken balances
  useLpPositions ──────── useAllPairs → user LP balances per pair

Level 2 (Depends on Level 1):
  useTokenBalances ────── useTokenRegistry → native + ERC20 balances

Level 3 (Aggregator):
  usePortfolio ────────── useTokenBalances + useLpPositions
                           + useFarmPositions + useStakingPositions
                           = SINGLE SOURCE OF TRUTH

Orchestration:
  useFeedInsights ─────── usePortfolio + useTokenRegistry + useInfinityPoolData
  useStrategyAutoContinue ── usePortfolio.refetch → auto-continue strategies
```

### All 16 Hooks

| Hook | Purpose | Key Returns |
|------|---------|-------------|
| `usePortfolio` | Master portfolio aggregator | balances, lpPositions, farmPositions, stakingPositions, refetch |
| `useTokenBalances` | Native KAS + ERC20 balances | balances[] (filters zero) |
| `useLpPositions` | LP positions across all DEXes | positions[] with proportional token amounts |
| `useFarmPositions` | MasterChef staked positions | positions[] with pending rewards, lock status |
| `useStakingPositions` | InfinityPool xToken holdings | positions[] with underlying amount |
| `useActiveFarms` | Farm pool metadata | activePools[], farms[], globals |
| `useAllPairs` | All trading pairs from all factories | pairs[] with reserves, tokens, protocol ID |
| `useTokenRegistry` | Token symbol/decimals lookup | tokens[], tokenMap, getTokenSymbol() |
| `useInfinityPoolData` | InfinityPool rates + metrics | pools[] (exchange rate, TVL, emissions) |
| `useConversations` | Conversation list + CRUD | conversations[], deleteConversation(), refreshConversations() |
| `useCardExecution` | Multi-step TX lifecycle | status, handleExecute(), handleCancel(), handleRetry() |
| `useExecutionPersistence` | Fire-and-forget DB save | executionStates, markExecuted(), getExecutionState() |
| `useStrategyAutoContinue` | Auto-advance strategy steps | onExecutionSuccess() |
| `useFeedInsights` | Feed insights from portfolio | insights[], isLoading |
| `useAnimatedText` | Character-by-character animation | displayedText |
| `useReconnectOnFocus` | Mobile Safari wallet fix | (void — side effect only) |

### Hook Loading Patterns

- **Chained loading**: Each level waits for parent (`enabled: !!address && pairs.length > 0`)
- **Aggregated states**: `isLoading: child1.isLoading || child2.isLoading || ...`
- **Coordinated refetch**: `usePortfolio.refetch()` triggers all child refetches

---

## 14. Component Architecture

### Chat Components

**Chat** (`components/chat/Chat.tsx`) — Top-level orchestrator
- Manages feed visibility (show feed when empty + authenticated + no feedPrompt)
- Handles URL rewriting (pushState from `/` to `/c/{id}` on first message)
- Invalidates conversation query on AI response finish

**ChatContainer** (`components/chat/ChatContainer.tsx`) — Core state manager
- Uses `useChat()` from AI SDK with custom `DefaultChatTransport`
- Maintains refs for portfolio, pools, messages, sendMessage (stale closure prevention)
- Provides `ExecutionStateContext` to all child cards
- Detects 401 errors → triggers `handleSessionExpired()`
- Auto-sends `initialInput` on mount (for feed card actions)

**MessageList** → **ChatMessage** → **ToolPartRenderer** → **Card Components**
- Auto-scroll with manual scroll detection (>80px from bottom = user scrolled up)
- ChatMessage uses custom memo comparator (re-renders only on content change)
- ToolPartRenderer dispatches to appropriate card via registry
- Each card wrapped in `CardErrorBoundary`

### Execution Cards (Shared Pattern)

All execution cards (SwapExecution, AddLiquidity, FarmStake, etc.) follow the same pattern:

```
1. Receive tool output (amounts, addresses, TX data)
2. Build execution steps:
   - Step 0: Approve TokenA (if needed)
   - Step 1: Approve TokenB (if needed)
   - Step 2: Main action (swap, addLiquidity, stake, etc.)
3. useCardExecution hook manages lifecycle:
   - idle → executing → success/error/cancelled
   - Pre-allocates wagmi hooks (3 useWriteContract + 1 useSendTransaction)
   - Sequential step execution with receipt waiting
   - Persists state to DB on completion
4. Display: summary + risk flags + contract info + action buttons
5. States: idle, executing (with step label), success (explorer link), error (retry), cancelled (faded)
```

### KrokoSwap Special Case

`KrokoSwapExecutionCard` has a unique 3-step approval flow:
1. Approve ERC20 → Permit2 contract
2. Permit2 approval → Universal Router (1-year expiry)
3. Execute swap via Universal Router (pre-built calldata from API)

Smart detection: skips approval steps if already approved (checks on-chain).

### Shared Card Components (`cards/shared/ExecutionCardParts.tsx`)

| Component | Purpose |
|-----------|---------|
| `TokenBadge` | Colored pill with token symbol |
| `RiskFlagList` | Display risk warnings |
| `ContractInfoAccordion` | Expandable contract/function details |
| `SuccessState` | Checkmark + explorer link to TX |
| `ErrorState` | Error message + retry button |
| `CancelledState` | Faded card with X icon |
| `DetailRow` | Label + value grid cell |
| `ActionArea` | Execute/cancel buttons + state handling |

---

## 15. State Management

### Three-Layer State Architecture

**1. Server State (TanStack Query)**
- Conversations list (`useConversations`)
- Portfolio data (all data hooks via `wagmi.useReadContracts`)
- Feed insights (`useFeedInsights`)
- Cache management: staleTime, refetch on mount, optimistic mutations

**2. Client UI State (Zustand)**

`stores/ui.ts` — Single store with two panels:
```ts
useUIStore = create({
  portfolioPanel: { isOpen, toggle(), close() },
  leftRail: { isOpen, toggle(), close() }
})
```
Exposed as `usePortfolioPanel()` and `useLeftRail()` selector hooks.

**3. Component-Local State (React)**
- Chat messages and streaming state (`useChat` from AI SDK)
- Execution state per conversation (`useExecutionPersistence`)
- Animation state (`useAnimatedText`)
- Form inputs (`ChatInput`)
- Scroll position detection (`MessageList`)

### Context Providers

```
WagmiProvider (wallet + chain state)
  └─ QueryClientProvider (TanStack cache)
       └─ AuthProvider (SIWE + JWT + RainbowKit adapter)
            └─ AppShell (layout)
                 └─ Chat
                      └─ ExecutionStateContext.Provider (per-conversation execution tracking)
                           └─ All cards can call markExecuted() / getExecutionState()
```

---

## 16. Feed & Insights System

### Insight Generation (`lib/feed/compute-insights.ts`)

The feed shows proactive AI insights based on the user's portfolio:

| Type | Trigger | Priority | Action |
|------|---------|----------|--------|
| `idle-capital` | Token balance > 100 KAS or > 10 other tokens, not in LP/farm/staking | 30 + amount/100 (max 90) | "Find yield for {token}" |
| `harvest-reminder` | Farm pending rewards > 0.01 | 50 + pending×10 (max 85) | "Claim rewards from farm {pid}" |
| `better-yield` | User has xZEAL but ZEAL emissions are paused | 70 | "Find better yield for ZEAL" |

### Feed Flow
1. `useFeedInsights` hook serializes portfolio + pools, POSTs to `/api/feed`
2. Server checks `feed_cache` table (2-minute TTL)
3. If cached and fresh: return cached insights
4. Otherwise: `computeInsights(portfolio, pools)` → upsert cache → return
5. `FeedContainer` renders `FeedCard` for each insight (sorted by priority)
6. User clicks action button → sets `feedPrompt` in Chat → auto-sends as first message

---

## 17. Token Discovery & Registry

### Server-Side Discovery (`lib/token-registry.ts`)

On-chain token discovery from ALL V2 factories with 5-minute caching:

```
Phase 1: Get pair counts from each factory (1 multicall)
Phase 2: Fetch all pair addresses (batched multicalls)
Phase 3: For each pair: token0(), token1(), getReserves() (batched)
Phase 4: For unique tokens: name(), symbol(), decimals() (batched)
Phase 5: Deduplication — group by symbol, prefer deepest WKAS liquidity
```

**Key Functions**:
| Function | Purpose |
|----------|---------|
| `getAllTokens()` | Full token list (KAS_NATIVE always first) |
| `getDiscoveryData()` | Tokens + all pairs with reserves |
| `resolveTokenAddress(symbol)` | Symbol → `0x` address |
| `addressToSymbol(address)` | Address → symbol |
| `getTokenDecimals(symbol)` | Get token decimals (default 18) |

**Caching**: 5-minute TTL with inflight deduplication (avoids redundant discovery if multiple requests arrive simultaneously).

### Client-Side Registry (`hooks/useTokenRegistry.ts`)

Uses `useAllPairs()` data to build token registry on the client:
- Extracts unique token addresses from all pairs
- Multicall for name/symbol/decimals metadata
- Deduplicates by symbol (prefers deepest WKAS-paired liquidity)
- Returns `tokens[]`, `tokenMap`, `getTokenSymbol()`

---

## 18. Formatting & Utility Layer

### `lib/format.ts` — Display Formatting

| Function | Input | Output Example |
|----------|-------|----------------|
| `formatTokenAmount(bigint, decimals, displayDecimals)` | `1234567890000000000n, 18, 4` | `"1.2345"` |
| `shortenAddress(address)` | `"0x1234...5678abcd"` | `"0x1234...abcd"` |
| `formatDisplayAmount(string)` | `"1500000"` | `"1.50M"` |
| `formatKasAmount(number)` | `0.0001` | `"0.0001"` (8 dp for <1) |
| `formatPrice(number)` | `0.0000001` | `"1.00e-7"` |
| `formatRelativeTime(dateStr)` | ISO date | `"5m ago"`, `"2h ago"`, `"Mar 15"` |

**Pattern**: Hooks return raw `bigint` from contracts; formatting is ONLY done in the UI layer.

### `lib/validation.ts`
```ts
ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
```

### `lib/discount.ts`
```ts
checkDiscountEligibility(userAddress)
// → { isEligible: boolean, source: string }
// Sources: "NFT Staking", "Membership", "xZEAL Holding"
```

### `lib/kroko-api.ts` — KrokoSwap REST Client

| Function | Endpoint | Returns |
|----------|----------|---------|
| `getKrokoQuote(params)` | GET `/api/v1/quote` | Quote with priceImpact, route, protocol |
| `getKrokoSwapCalldata(params)` | POST `/api/v1/swap` | Encoded TX calldata with gasEstimate |

---

## 19. RPC Optimization & Multicall Strategy

### Benchmark Results (from `scripts/benchmark-rpc.ts`)

| Operation | Expected RPCs | Method |
|-----------|---------------|--------|
| Token discovery (cold) | ≤6 | 1 readContract + 3 multicalls + 2 transport init |
| Token discovery (warm) | 0 | In-memory cache hit |
| Yield discovery | ≤2 | Pairs from cache + 2 multicalls |
| Active farms | ≤2 | 1 multicall (globals) + 1 multicall (per-pool) |
| InfinityPool rates | ≤1 | 1 multicall (11 reads batched) |
| Pool reserves | ≤2 | 1 getPair + 1 multicall |
| Token price | ≤2 | 1 getPair + 1 multicall |
| Membership status | ≤2 | 1 multicall (9 reads) + 1 discount check |

### Optimization Techniques
1. **Multicall3 batching**: All contract reads batched into single RPC calls
2. **5-minute token cache**: Avoids rediscovering tokens on every request
3. **Inflight deduplication**: Concurrent requests share the same discovery call
4. **Hierarchical multicall**: Phase 1 gets counts → Phase 2 gets addresses → Phase 3 gets data
5. **allowFailure: true**: Prevents one bad call from failing the entire batch
6. **Transport batching**: wagmi config batches up to 100 calls with 50ms window

---

## 20. Security Model

### Authentication Security
| Property | Implementation |
|----------|---------------|
| Non-custodial | App never handles private keys; user signs in wallet |
| httpOnly JWT | Cookie inaccessible to JavaScript (prevents XSS theft) |
| SIWE domain validation | Prevents cross-origin SIWE replay attacks |
| Chain ID validation | Must be 202555 (Kasplex L2) |
| Atomic nonce deletion | Single DB DELETE prevents replay and TOCTOU races |
| Rate limiting | 30 req/15 min per wallet; fails closed (503) |
| Session expiry | 7-day JWT, auto-detect on 401 response |

### Data Security
| Property | Implementation |
|----------|---------------|
| RLS on all tables | Per-wallet row-level security policies |
| Ownership verification | Every DB query checks wallet_address |
| Service role server-only | Supabase service key never exposed to client |
| Server env guards | `server-only` package prevents secret leakage |
| Zod validation | All API inputs validated with schemas |

### Transaction Security
| Property | Implementation |
|----------|---------------|
| User-approved TXs | Every transaction requires wallet signature |
| Slippage protection | All swaps have minimum output enforcement |
| Risk flags | Low liquidity, high impact, price deviation warnings |
| Allowance checking | Verifies approvals before building TXs |
| Contract info display | Shows target address + function for transparency |

---

## 21. Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| ES2020 target | Required for BigInt literals used by viem/wagmi (`1000n`) |
| Path alias `@/*` → root | Clean imports, no `../../..` relative paths |
| Single viem client | Prevents multiple RPC connections, centralizes config |
| Hooks return raw `bigint` | Formatting is a UI concern, not a data concern |
| parseAbi() for ABIs | Enables full TypeScript type inference with wagmi hooks |
| Addresses typed as `` `0x${string}` `` | Compile-time safety for contract addresses |
| Protocol registry pattern | Centralized config, easy to add new protocols |
| Tool naming `{protocol}_{action}` | Clear namespace, no collisions, easy to grep |
| 3-part system prompt | Exploits Anthropic cache: static + semi-static + dynamic |
| Fire-and-forget execution save | DB persistence doesn't block user interaction |
| Cookie-based wagmi storage | SSR hydration without mismatch |
| `await cookies()` on home page | Forces dynamic rendering (fresh UUID each visit) |
| `key={id}` on Chat component | Forces React to unmount/remount on navigation |
| Refs for stale closures | Callbacks in ChatContainer always read latest state |
| 5-minute token cache | Balance between freshness and RPC efficiency |
| Strategy auto-continue | Smooth multi-step execution without user having to type each time |

---

## 22. Data Flow Diagrams

### New Chat Flow
```
User visits "/"
  → Server: generate UUID, render Chat(id, [])
  → Client: show Feed + WelcomeScreen + ChatInput
  → User types message
  → Chat: pushState to /c/{id}
  → POST /api/chat { conversationId, message, portfolio }
  → Server: rate limit → auto-create conversation → build system prompt
  → streamText() with Claude Sonnet + 23 tools
  → Stream chunks to client → render text + tool cards
  → On finish: save assistant message to DB
  → Sidebar: invalidate conversations query → shows new conversation
```

### Tool Execution Flow
```
AI calls tool (e.g., zealous_prepareSwap)
  → Tool fetches on-chain data (multicall)
  → Returns structured result (amounts, TX data, risk flags)
  → Client renders SwapExecutionCard
  → User clicks "Execute"
  → useCardExecution:
      Step 0: writeContract(approve) → wait for receipt
      Step 1: sendTransaction(swap) → wait for receipt
  → markExecuted(toolCallId, "success", txHash)
  → POST /api/execution-states (fire-and-forget)
  → If strategy active: useStrategyAutoContinue triggers next step
```

### Portfolio Loading Chain
```
useAllPairs
  ├──→ useTokenRegistry (deduplicated tokens)
  │     └──→ useTokenBalances (native + ERC20)
  └──→ useLpPositions (LP balances per pair)

useActiveFarms
  └──→ useFarmPositions (staked amounts + pending rewards)

useInfinityPoolData
  └──→ useStakingPositions (xToken balances)

All four ──→ usePortfolio (MASTER AGGREGATOR)
              └──→ Provided via context to entire app
```

---

## 23. File Reference Index

### Configuration
| File | Lines | Purpose |
|------|-------|---------|
| `config/contracts.ts` | ~30 | ZealousSwap contract addresses |
| `config/protocols.ts` | ~150 | Protocol registry + helpers |
| `config/chains.ts` | ~20 | Kasplex L2 chain definition |
| `config/wagmi.ts` | ~30 | Wagmi + RainbowKit config |
| `config/tokens.ts` | ~30 | Token metadata + logos |
| `config/pools.ts` | ~40 | InfinityPool configs |
| `config/abis/*.ts` | 14 files | Contract ABIs (parseAbi) |

### Authentication
| File | Lines | Purpose |
|------|-------|---------|
| `lib/auth.ts` | ~86 | JWT + SIWE cryptography |
| `lib/auth-middleware.ts` | ~42 | Request-level auth |
| `lib/auth-server.ts` | ~15 | Server component auth |
| `lib/auth-provider.tsx` | ~170 | React context + RainbowKit adapter |
| `lib/api-handler.ts` | ~27 | withAuth() wrapper |

### API Routes
| File | Purpose |
|------|---------|
| `app/api/auth/nonce/route.ts` | SIWE nonce generation |
| `app/api/auth/verify/route.ts` | Signature verification + JWT |
| `app/api/auth/signout/route.ts` | Cookie cleanup |
| `app/api/auth/me/route.ts` | Auth status check |
| `app/api/chat/route.ts` | Streaming AI chat |
| `app/api/conversations/route.ts` | List conversations |
| `app/api/conversations/[id]/route.ts` | Delete conversation |
| `app/api/execution-states/route.ts` | Save execution state |
| `app/api/feed/route.ts` | Compute insights |

### AI System
| File | Lines | Purpose |
|------|-------|---------|
| `lib/ai/system-prompt.ts` | ~223 | 3-part cached system prompt |
| `lib/ai/tool-types.ts` | ~551 | All tool result interfaces |
| `lib/ai/serializers.ts` | ~119 | Portfolio serialization |
| `lib/ai/quick-actions.ts` | ~143 | Follow-up action buttons |
| `lib/ai/tools/index.ts` | ~38 | Tool aggregator |
| `lib/ai/tools/shared/helpers.ts` | ~200 | Generic V2 DEX helpers |
| `lib/ai/tools/zealous/*.ts` | 8 files | ZealousSwap tools |
| `lib/ai/tools/kroko/*.ts` | 3 files | KrokoSwap tools |
| `lib/ai/tools/kaspacom/*.ts` | 3 files | KaspaCom tools |
| `lib/ai/tools/compare.ts` | ~174 | Cross-DEX comparison |
| `lib/ai/tools/strategy.ts` | ~200 | Strategy planner |
| `lib/ai/tools/history.ts` | ~150 | Transaction history |
| `lib/ai/tools/spy.ts` | ~150 | Portfolio inspector |
| `lib/ai/tools/oracle.ts` | ~127 | Token price oracle |

### Hooks
| File | Purpose |
|------|---------|
| `hooks/usePortfolio.ts` | Master portfolio aggregator |
| `hooks/useTokenBalances.ts` | Token balances |
| `hooks/useLpPositions.ts` | LP positions |
| `hooks/useFarmPositions.ts` | Farm positions |
| `hooks/useStakingPositions.ts` | Staking positions |
| `hooks/useActiveFarms.ts` | Farm metadata |
| `hooks/useAllPairs.ts` | All trading pairs |
| `hooks/useTokenRegistry.ts` | Token registry |
| `hooks/useInfinityPoolData.ts` | InfinityPool data |
| `hooks/useConversations.ts` | Conversation CRUD |
| `hooks/useCardExecution.ts` | TX execution lifecycle |
| `hooks/useExecutionPersistence.ts` | Execution state DB save |
| `hooks/useStrategyAutoContinue.ts` | Strategy auto-advance |
| `hooks/useFeedInsights.ts` | Feed insights |
| `hooks/useAnimatedText.ts` | Text animation |
| `hooks/useReconnectOnFocus.ts` | Wallet reconnection |

### Components
| Directory | Files | Purpose |
|-----------|-------|---------|
| `components/chat/` | 12 | Chat UI core |
| `components/chat/cards/` | 24 | Tool output cards |
| `components/feed/` | 2 | Feed insights UI |
| `components/header/` | 2 | App header |
| `components/shell/` | 3 | Layout shell |
| `components/sidebar/` | 2 | Sidebar panels |

### Other
| File | Purpose |
|------|---------|
| `lib/supabase.ts` | Supabase client |
| `lib/viem-client.ts` | Singleton viem client |
| `lib/format.ts` | Display formatting |
| `lib/token-registry.ts` | On-chain token discovery |
| `lib/discount.ts` | Fee discount check |
| `lib/kroko-api.ts` | KrokoSwap REST API |
| `lib/db/queries.ts` | Database queries |
| `lib/env.ts` | Environment validation |
| `stores/ui.ts` | Zustand UI store |
| `scripts/benchmark-rpc.ts` | RPC call benchmark |

---

*End of research report.*
