# KasAgent Architecture

> Last updated: 2026-03-16
> Codebase: Next.js 16 + React 19 + wagmi 2 + viem 2 + AI SDK (Anthropic Claude)

KasAgent is a non-custodial AI DeFi copilot for Kasplex L2. Users chat with an AI agent that reads on-chain data, compares DEXes, and prepares transactions — the user signs everything in their own wallet.

---

## High-Level Architecture

```
User <-> App Shell (Feed + Canvas) <-> /api/chat <-> Claude (Anthropic)
              |                                          |
         Auth (SIWE)                               AI Tools (23)
              |                                          |
         /api/auth/*                  +--------+---------+---------+
              |                       |        |         |         |
         JWT Cookie            ZealousSwap KrokoSwap KaspaCom  Shared
              |                (on-chain)  (REST API) (on-chain)  (oracle, history,
         Supabase (RLS)                                            spy, compare,
                                                                   strategy)
                                      |        |         |       |
                                      Kasplex L2 EVM (Chain ID: 202555)
```

**Data flow:**
1. User connects wallet → signs SIWE message → server verifies → sets JWT cookie
2. User sends a message via the chat UI
3. Frontend passes message + serialized portfolio to `/api/chat` (wallet from cookie)
4. Server builds a 3-block system prompt (identity, protocol knowledge, wallet context)
5. Claude processes the message and calls tools as needed
6. Tool results stream back as structured data
7. `ToolPartRenderer` maps each tool result to a card component (via `tool-card-registry`)
8. Execution cards let the user approve and sign transactions via wagmi/RainbowKit

---

## App Shell & Routing

### Layout Structure

```
┌──────────────────────────────────────────┐
│  AppHeader (logo, portfolio btn, wallet) │
├──────────┬───────────────────────────────┤
│ LeftRail │  {page content}               │
│ (w-64)   │  / = Feed + new chat          │
│ convos   │  /c/[id] = conversation       │
│          │                               │
├──────────┴───────────────────────────────┤
│     PortfolioSlideOut (right, overlay)   │
└──────────────────────────────────────────┘
```

### Route Structure

```
app/
  layout.tsx                    # Root layout (Providers: wagmi, RainbowKit, TanStack)
  providers.tsx                 # Provider wrappers
  (app)/
    layout.tsx                  # AppShell (portfolio, pools, auth, conversations)
    page.tsx                    # Feed insights + new chat
    c/[id]/
      page.tsx                  # Existing conversation
  api/
    auth/
      nonce/route.ts            # POST — generate SIWE nonce
      verify/route.ts           # POST — verify signature, set JWT cookie
      signout/route.ts          # POST — clear cookie
    chat/route.ts               # POST — AI chat streaming
    conversations/              # Conversation CRUD
    execution-states/           # Transaction state persistence
    feed/route.ts               # POST — feed insights (Supabase-cached)
```

**URLs:** `/` = feed + new chat, `/c/abc123` = conversation

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `AppShell` | `components/shell/AppShell.tsx` | Layout controller: portfolio, pools, auth, conversations, panel state |
| `AppContext` | `components/shell/AppContext.tsx` | Shared context — no prop drilling through routes |
| `LeftRail` | `components/shell/LeftRail.tsx` | Conversation list, new chat button. Desktop: always visible. Mobile: overlay drawer |
| `PortfolioSlideOut` | `components/shell/PortfolioSlideOut.tsx` | Right-side portfolio panel, triggered by header button |
| `PortfolioPanel` | `components/sidebar/PortfolioPanel.tsx` | Portfolio display: balances, LPs, farms, staking, pool rates |
| `AppHeader` | `components/header/AppHeader.tsx` | Uses AppContext. Logo, portfolio toggle, wallet connect |

---

## Directory Structure

```
KasAgentV2/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout with <Providers>
│   ├── providers.tsx             # Wagmi + RainbowKit + TanStack Query
│   ├── (app)/
│   │   ├── layout.tsx            # AppShell wrapper
│   │   ├── page.tsx              # Feed + new conversation
│   │   └── c/[id]/page.tsx       # Existing conversation
│   └── api/
│       ├── auth/                 # SIWE auth (nonce, verify, signout)
│       ├── chat/route.ts         # POST — AI chat streaming endpoint
│       ├── conversations/        # Conversation CRUD (Supabase-backed)
│       ├── execution-states/     # Transaction state persistence
│       └── feed/route.ts         # POST — feed insights
│
├── components/
│   ├── shell/                    # App shell (layout, context, panels)
│   │   ├── AppShell.tsx
│   │   ├── AppContext.tsx
│   │   ├── LeftRail.tsx
│   │   └── PortfolioSlideOut.tsx
│   ├── chat/
│   │   ├── ChatContainer.tsx     # useChat hook, message state, ~200 lines
│   │   ├── ChatInput.tsx         # User input
│   │   ├── ChatMessage.tsx       # Renders text + tool parts
│   │   ├── MessageList.tsx       # Scroll container + quick actions
│   │   ├── ToolPartRenderer.tsx  # Imports registry, wraps cards in error boundary
│   │   ├── CardErrorBoundary.tsx # Per-card error boundary
│   │   ├── ExecutionStateContext.tsx  # Tracks tx execution across cards
│   │   └── cards/                # 23 card components
│   │       ├── shared/ExecutionCardParts.tsx  # Reusable UI primitives
│   │       └── ... (SwapQuoteCard, SwapExecutionCard, StrategyPlanCard, etc.)
│   ├── feed/
│   │   ├── FeedCard.tsx          # Single insight card
│   │   └── FeedContainer.tsx     # Feed container with loading skeleton
│   ├── header/AppHeader.tsx
│   ├── sidebar/
│   │   ├── PortfolioPanel.tsx    # Portfolio display sections
│   │   └── ConversationList.tsx  # Grouped conversation list
│   └── ErrorBoundary.tsx         # Generic error boundary
│
├── config/
│   ├── contracts.ts              # ZealousSwap contract addresses
│   ├── protocols.ts              # Protocol registry (type, layer, features)
│   ├── pools.ts                  # InfinityPool address config
│   ├── chains.ts                 # Kasplex L2 chain definition
│   ├── wagmi.ts                  # Wagmi + RainbowKit config
│   ├── tokens.ts                 # Token interface, KAS_NATIVE
│   └── abis/                     # 12 ABI files (parseAbi pattern)
│
├── hooks/                        # Client-side React hooks
│   ├── useWalletAuth.ts          # SIWE sign-in flow, auto-sign on connect
│   ├── usePortfolio.ts           # Aggregates all position hooks
│   ├── useCardExecution.ts       # Shared tx execution lifecycle for all cards
│   ├── useExecutionPersistence.ts # Execution state management + DB persistence
│   ├── useStrategyAutoContinue.ts # Auto-continue after successful strategy steps
│   ├── useConversationLoader.ts  # Load single conversation by ID
│   ├── useFeedInsights.ts        # Client-side feed insight fetching
│   ├── useAllPairs.ts            # Multi-factory pair discovery
│   ├── useTokenRegistry.ts       # Client-side token list
│   ├── useTokenBalances.ts       # ERC-20 + native KAS
│   ├── useLpPositions.ts         # LP balances + underlying amounts
│   ├── useFarmPositions.ts       # MasterChef staked + pending rewards
│   ├── useStakingPositions.ts    # InfinityPool xToken balances
│   ├── useActiveFarms.ts         # Farm pool metadata
│   ├── useInfinityPoolData.ts    # Pool exchange rates
│   └── useConversations.ts       # ConversationSummary type definition
│
├── lib/
│   ├── auth.ts                   # JWT sign/verify, SIWE verification, nonce generation
│   ├── auth-middleware.ts        # requireAuth() — reads JWT cookie, returns wallet
│   ├── viem-client.ts            # Single PublicClient instance
│   ├── token-registry.ts         # Server-side token discovery (5-min cache)
│   ├── kroko-api.ts              # KrokoSwap REST API client
│   ├── discount.ts               # Fee discount eligibility checker
│   ├── multicall.ts              # mcResult() helper
│   ├── format.ts                 # Formatting: tokens, prices, amounts, relative time
│   ├── supabase.ts               # Supabase client (server-only, service role)
│   ├── validation.ts             # ETH_ADDRESS_RE regex
│   ├── env.ts                    # Zod-validated env vars (incl. JWT_SECRET)
│   ├── ui/
│   │   ├── parse-tool-part.ts    # Shared parseToolPart() utility
│   │   ├── strategy-helpers.ts   # findActiveStrategy(), countCompletedStrategySteps()
│   │   └── tool-card-registry.tsx # TOOL_CARD_REGISTRY — maps tool names to cards
│   ├── feed/
│   │   ├── types.ts              # FeedInsight interface
│   │   └── compute-insights.ts   # Server-side insight computation
│   └── ai/
│       ├── system-prompt.ts      # 3-block cached prompt builder (grouped by protocol type)
│       ├── tool-types.ts         # TypeScript interfaces for all tool results
│       ├── serializers.ts        # Portfolio/pools → prompt-ready strings
│       ├── quick-actions.ts      # Follow-up suggestion buttons
│       └── tools/                # 23 AI tools organized by protocol
│           ├── index.ts          # Merges all tool groups → aiTools
│           ├── compare.ts        # compareSwapQuotes (cross-DEX)
│           ├── oracle.ts         # getTokenPrice (multi-factory)
│           ├── history.ts        # getTransactionHistory
│           ├── spy.ts            # spyOnWallet (multi-factory)
│           ├── strategy.ts       # planStrategy (multi-step DeFi plans)
│           ├── zealous/          # ZealousSwap tools (14 tools)
│           ├── kroko/            # KrokoSwap tools (2 tools)
│           └── kaspacom/         # KaspaCom tools (2 tools)
```

---

## Authentication & Security

### SIWE (Sign-In With Ethereum) Flow

```
1. User connects wallet via RainbowKit
2. Client: POST /api/auth/nonce → { nonce } (rate-limited, 10-min expiry)
3. Client: Wallet signs SIWE message (domain, address, chainId, nonce)
4. Client: POST /api/auth/verify → { message, signature }
5. Server: Verify signature + domain + chainId (202555) + nonce (atomic delete)
6. Server: Sign JWT { wallet: "0x..." } → set httpOnly Secure SameSite=Strict cookie (7-day)
7. All subsequent API requests: server reads wallet from JWT cookie
```

### Security Properties

| Property | How |
|----------|-----|
| **Wallet ownership proof** | SIWE cryptographic signature — only the wallet holder can sign |
| **Replay prevention** | Nonce stored in DB, atomically deleted on use |
| **Domain binding** | Server validates SIWE message domain matches request host |
| **Chain binding** | Server validates chainId === 202555 (Kasplex L2) |
| **Session security** | httpOnly + Secure + SameSite=Strict cookie — not accessible from JS |
| **Data isolation** | Supabase RLS policies on all tables — DB enforces wallet-scoped access |
| **Rate limiting** | Supabase RPC `check_rate_limit()` — 30 req/15 min per wallet, fails closed |

### API Route Auth Pattern

All protected routes use the same pattern:
```ts
const authResult = await requireAuth(req);          // reads JWT from cookie
if (authResult instanceof Response) return authResult; // 401 if invalid
const wallet = authResult;                            // verified wallet address
```

`requireAuth()` reads the cookie header only — never touches the request body.

---

## Protocol Registry

`config/protocols.ts` is the central registry. Each protocol declares its ID, name, type, layer, features, contract addresses, and optional API URL.

```
PROTOCOLS = {
  zealous:  { type: "dex", layer: "l2", features: [swap, liquidity, farms, staking, membership] }
  kroko:    { type: "dex", layer: "l2", features: [swap],  apiBaseUrl: "..." }
  kaspacom: { type: "dex", layer: "l2", features: [swap] }
}
```

**Types:** `ProtocolType = "dex" | "lending" | "bridge" | "nft" | "launchpad" | "governance" | "l1-tokens"`
**Layers:** `ProtocolLayer = "l1" | "l2" | "cross-layer"`

**Helper functions:**
- `getAllV2Factories()` — all V2 factory addresses with protocol IDs
- `getProtocolsByType(type)` — filter by dex, lending, etc.
- `getProtocolsByLayer(layer)` — filter by l1, l2, cross-layer
- `getDexProtocols()` — convenience for all DEX protocols
- `getProtocolsWithFeature(feature)` — filter by swap, farms, etc.

**Shared layers read from the registry:**
- `token-registry.ts` → discovers tokens from ALL factories
- `useAllPairs.ts` → fetches pairs from ALL factories
- `system-prompt.ts` → generates protocol knowledge blocks grouped by type
- `spy.ts` / `oracle.ts` → reads across all factories

**Adding a new protocol requires:**
1. A `PROTOCOLS` entry in `config/protocols.ts`
2. Tool modules in `lib/ai/tools/<name>/`
3. Card components + registry entries in `lib/ui/tool-card-registry.tsx`
4. One import + spread in `lib/ai/tools/index.ts`

No shared-layer edits needed.

---

## Feed Layer

Proactive AI insight cards when user opens the app with a connected wallet.

### Insight Types

| Type | Trigger | Example |
|------|---------|---------|
| `idle-capital` | Token balance above threshold, not in any position | "142 KAS sitting idle" |
| `harvest-reminder` | Pending farm rewards above gas cost | "3.5 ZEAL to harvest" |
| `better-yield` | Position earning less than best available | "ZEAL emissions paused" |

### Data Flow

```
Client (useFeedInsights) → POST /api/feed (with serialized portfolio)
  → Server: requireAuth() → check Supabase cache (feed_cache table, 2-min TTL)
  → If miss: computeInsights(portfolio, pools) → upsert cache → return
  → Client: FeedContainer → FeedCard[] → tap → sends actionPrompt as chat message
```

Feed cache uses Supabase (`feed_cache` table) instead of in-memory Map — works across serverless instances.

---

## AI Tool System

### 23 Registered Tools

| Tool | Protocol | Purpose |
|------|----------|---------|
| `zealous_getSwapQuote` | ZealousSwap | On-chain quote via Router |
| `zealous_prepareSwap` | ZealousSwap | Prepare swap tx with approval check |
| `zealous_getPoolReserves` | ZealousSwap | Read pair reserves |
| `zealous_listAllPairs` | ZealousSwap | List all trading pairs (multi-factory, filterable by `protocolId`) |
| `zealous_prepareAddLiquidity` | ZealousSwap | Prepare add-LP tx |
| `zealous_prepareRemoveLiquidity` | ZealousSwap | Prepare remove-LP tx |
| `zealous_getActiveFarms` | ZealousSwap | List active farm pools |
| `zealous_prepareFarmStake` | ZealousSwap | Prepare farm deposit tx |
| `zealous_prepareFarmUnstake` | ZealousSwap | Prepare farm withdraw tx |
| `zealous_getInfinityPoolRates` | ZealousSwap | InfinityPool exchange rates |
| `zealous_prepareInfinityStake` | ZealousSwap | Prepare single-sided stake tx |
| `zealous_prepareInfinityUnstake` | ZealousSwap | Prepare unstake tx |
| `zealous_discoverYieldOpportunities` | ZealousSwap | Ranked yield comparison |
| `zealous_getMembershipStatus` | ZealousSwap | Discount eligibility check |
| `kroko_getSwapQuote` | KrokoSwap | API-based quote (V2+V3 routing) |
| `kroko_prepareSwap` | KrokoSwap | Prepare swap with Permit2 approvals |
| `kaspacom_getSwapQuote` | KaspaCom | On-chain quote via V2 Router |
| `kaspacom_prepareSwap` | KaspaCom | Prepare swap tx (fixed 1% fee) |
| `compareSwapQuotes` | Cross-protocol | Compare rates across all DEXes |
| `planStrategy` | Cross-protocol | Multi-step DeFi strategy planner with live on-chain quotes |
| `getTokenPrice` | Shared | On-chain spot price (multi-factory) |
| `getTransactionHistory` | Shared | Explorer API tx history |
| `spyOnWallet` | Shared | Read-only portfolio for any address |

### Tool → Card Dispatch

`lib/ui/tool-card-registry.tsx` exports `TOOL_CARD_REGISTRY` — a `Record<string, CardRenderer>` mapping tool names to React card components. `ToolPartRenderer.tsx` imports this registry and wraps each card render in a `CardErrorBoundary`.

---

## Strategy Planning & Auto-Continue

### Strategy Tool (`planStrategy`)

Creates multi-step DeFi plans with live on-chain quotes. Each step is computed server-side:

```
AI calls planStrategy({ steps: [...] })
  → For each step:
    1. Resolve tokens + amounts (or "auto" from previous step output)
    2. Fetch live quote (swap via DEX router, LP via reserves, etc.)
    3. Build StrategyStep with toolToCall, estimated amounts
  → Return StrategyPlanResult → StrategyPlanCard (read-only visualization)
```

### Auto-Continue Flow (`useStrategyAutoContinue`)

After a strategy is planned, execution is hands-free — the user only signs transactions:

```
User: "Farm 5 KAS"
  → AI calls planStrategy → StrategyPlanCard renders (3 steps)
  → User says "start" → AI prepares step 1 tool → SwapExecutionCard
  → User signs tx → markExecuted("success")
  → Portfolio refetch starts
  → [refetch completes] → [1.5s delay] → Auto-continue: "Step 1 completed..."
  → AI prepares step 2 → AddLiquidityCard
  → (repeat until all steps done)
  → "All 3 steps completed!" → AI summarizes
```

**Key implementation details:**
- Strategy helpers extracted to `lib/ui/strategy-helpers.ts`
- `useStrategyAutoContinue` hook watches `portfolioIsFetching` — waits for refetch to complete before sending continuation (prevents stale balance reads)
- `useExecutionPersistence` hook handles DB persistence of execution states
- Guards: only fires on `"success"`, only when chat is `"ready"`, skips if all steps done
- Timer cleanup on unmount prevents stale sends

---

## Persistence (Supabase)

### Tables

| Table | Purpose | RLS |
|-------|---------|-----|
| `conversations` | Chat sessions (wallet_address, title, timestamps) | Per-wallet policies |
| `messages` | Message parts (role, parts JSON array) | Via conversation ownership |
| `execution_states` | Transaction outcomes (tool_call_id, state, tx_hash) | Via conversation ownership |
| `rate_limits` | Per-wallet rate limit counters | Per-wallet policies |
| `auth_sessions` | SIWE nonces (wallet, nonce, expiry) | Service role only |
| `feed_cache` | Feed insight cache (wallet, insights JSON, expiry) | Per-wallet policies |

### Rate Limiting

Supabase RPC function `check_rate_limit()`:
- 30 requests per 15-minute window per wallet
- Applied to `/api/chat` and `/api/auth/nonce`
- **Fails closed** — if RPC errors, returns 503 (not bypassed)

---

## System Prompt Structure

3-block architecture with Anthropic ephemeral cache:

| Block | Content | Cache |
|-------|---------|-------|
| 1 (Static) | Identity + behavior rules + response guidelines | Cached across all users |
| 2 (Semi-static) | Protocol knowledge grouped by type (DEX, Lending, etc.) + token list | Cached ~5 min |
| 3 (Dynamic) | User wallet: balances, LP positions, farm positions, staking, discount status | Not cached (per-user) |

Protocol knowledge is generated from `PROTOCOLS` registry — adding a new protocol auto-generates its section under the appropriate type heading.

---

## Network

| Property | Value |
|----------|-------|
| Chain | Kasplex L2 Mainnet |
| Chain ID | 202555 |
| Native Currency | KAS (18 decimals) |
| RPC | `https://evmrpc.kasplex.org` |
| Explorer | `https://explorer.kasplex.org` |
| Multicall3 | `0x52f1eCcB5af51F2AFe0Dfb2f809F8617fDAA5be4` |
| WKAS (shared) | `0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e` |

---

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.1.6 | Framework (App Router + Turbopack) |
| react | 19.2.3 | UI |
| wagmi | 2.19.5 | Wallet connection + contract reads/writes |
| viem | 2.46.3 | EVM client, ABI encoding, multicall |
| @rainbow-me/rainbowkit | 2.2.10 | Wallet UI (connect modal, chain switching) |
| @tanstack/react-query | 5.90.21 | Data fetching + caching |
| ai | 6.0.112 | AI SDK (streaming, tool definitions) |
| @ai-sdk/anthropic | 3.0.55 | Claude provider |
| @ai-sdk/react | 3.0.114 | useChat hook |
| siwe | latest | Sign-In With Ethereum message parsing/verification |
| jose | latest | JWT sign/verify (HS256) |
| zod | 4.3.6 | Schema validation (env vars, tool inputs) |
| tailwindcss | 4 | Styling (dark theme) |

---

## Environment Variables

**Client-side:**
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — WalletConnect project ID (required)
- `NEXT_PUBLIC_RPC_URL` — RPC endpoint (default: `https://evmrpc.kasplex.org`)
- `NEXT_PUBLIC_RPC_URL_FALLBACK` — Fallback RPC (optional)

**Server-side:**
- `ANTHROPIC_API_KEY` — Claude API key (required)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (required)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service key (required)
- `JWT_SECRET` — Secret for signing auth JWTs, min 32 chars (required)
- `EXPLORER_API_URL` — Blockscout API (default: explorer proxy)

All validated at startup via Zod in `lib/env.ts`.
