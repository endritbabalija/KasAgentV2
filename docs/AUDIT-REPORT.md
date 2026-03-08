# KasAgent Architecture Audit Report
Generated: 2026-03-07

## Executive Summary

KasAgent V2 is an AI-powered, non-custodial DeFi copilot for Kasplex L2 (chainId 202555). Users manage their crypto portfolio through natural language chat with Claude Sonnet 4 via the Vercel AI SDK. The stack is Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, wagmi 2 + viem 2 + RainbowKit 2 for wallet/chain interaction. The application is stateless — no database, no localStorage, no sessions. All state is derived from on-chain reads. All transactions are user-signed; the server never holds private keys. Phase 1 MVP is complete with 13 AI tools covering swaps, liquidity, farming, staking, yield discovery, and transaction history.

## Architecture Diagram (text)

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                         │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────────┐  │
│  │AppHeader  │  │PortfolioSide-│  │     ChatContainer         │  │
│  │NetworkStat│  │bar           │  │  ┌─────────┐ ┌─────────┐ │  │
│  │ConnectBtn │  │(balances, LP,│  │  │MessageLst│ │ChatInput│ │  │
│  └──────────┘  │ farms, stake)│  │  │ToolCards │ │QuickActs│ │  │
│                └──────────────┘  │  └─────────┘ └─────────┘ │  │
│                                  └───────────────────────────┘  │
│                                                                 │
│  wagmi hooks ──── useReadContracts() ──── RPC reads (portfolio) │
│  wagmi hooks ──── useWriteContract() ──── tx signing (wallet)   │
│                         │                        │              │
│                         │  POST /api/chat        │              │
│                         │  {messages, portfolio}  │              │
└─────────────────────────┼────────────────────────┼──────────────┘
                          │                        │
                          ▼                        ▼
┌─────────────────────────────────┐  ┌─────────────────────────┐
│     SERVER (Next.js API Route)  │  │  Kasplex L2 Chain       │
│                                 │  │  (chainId 202555)       │
│  POST /api/chat                 │  │                         │
│  ┌─────────────────────────┐    │  │  ZealousSwap Router     │
│  │ buildSystemPrompt()     │    │  │  ZealousSwap Factory    │
│  │ + portfolio context     │    │  │  MasterChef (farms)     │
│  │ + protocol knowledge    │    │  │  InfinityPools (stake)  │
│  └────────┬────────────────┘    │  │  ERC-20 tokens          │
│           ▼                     │  └────────────▲────────────┘
│  ┌─────────────────────────┐    │               │
│  │ streamText({            │    │               │
│  │   model: claude-sonnet-4│    │   viem public │
│  │   tools: aiTools (13)   │    │   client reads│
│  │   stopWhen: 5 steps     │    │               │
│  │ })                      │────┼───────────────┘
│  └────────┬────────────────┘    │
│           │ SSE stream          │  ┌─────────────────────────┐
│           ▼                     │  │ Blockscout Explorer API │
│  toUIMessageStreamResponse()   │  │ (tx history only)       │
│                                 │  └─────────────────────────┘
└─────────────────────────────────┘
```

**End-to-end flow:**
1. User types natural language in ChatInput
2. ChatContainer sends POST to `/api/chat` with messages + serialized portfolio + infinity pool data
3. Server builds system prompt with portfolio context and protocol knowledge
4. Claude Sonnet 4 receives prompt + 13 tool definitions via Vercel AI SDK `streamText()`
5. Claude calls tools as needed — tools execute server-side viem reads against Kasplex L2 RPC
6. Tool results stream back to browser as SSE via `toUIMessageStreamResponse()`
7. UI renders text via MarkdownRenderer + tool results via typed card components
8. For execution tools (prepareSwap, etc.): interactive cards let user confirm → wagmi signs tx in wallet → tx submitted to chain

## Findings

### Frontend (Client-Side)

**Framework:** Next.js 16.1.6 (App Router), React 19.2.3, TypeScript 5, Tailwind CSS 4

**Component count:** 28 component files + 10 hooks + 2 lib utilities = 40 client-relevant files

**"use client" components (31 files):**
- `app/page.tsx` — Home page orchestrator
- `app/providers.tsx` — wagmi/RainbowKit/React Query provider stack
- `components/chat/ChatContainer.tsx` — Chat state via `useChat` hook
- `components/chat/ChatInput.tsx` — Message input form
- `components/chat/ChatMessage.tsx` — Message renderer (text + tool parts)
- `components/chat/MessageList.tsx` — Auto-scrolling message list + quick actions
- `components/chat/MarkdownRenderer.tsx` — React Markdown with tailwind styling
- `components/chat/QuickActions.tsx` — Follow-up action buttons
- `components/chat/WelcomeScreen.tsx` — Initial suggestions
- `components/chat/cards/SwapExecutionCard.tsx` — Swap tx execution
- `components/chat/cards/AddLiquidityCard.tsx` — Add liquidity tx execution
- `components/chat/cards/RemoveLiquidityCard.tsx` — Remove liquidity tx execution
- `components/chat/cards/FarmStakeCard.tsx` — Farm deposit tx execution
- `components/chat/cards/FarmUnstakeCard.tsx` — Farm withdraw tx execution
- `components/chat/cards/InfinityStakeCard.tsx` — InfinityPool stake tx execution
- `components/chat/cards/InfinityUnstakeCard.tsx` — InfinityPool unstake tx execution
- `components/chat/cards/shared/ExecutionCardParts.tsx` — Shared UI components for execution cards
- `components/header/AppHeader.tsx` — Header bar with wallet connect
- `components/header/NetworkStatus.tsx` — Chain connection indicator
- `components/sidebar/PortfolioSidebar.tsx` — Portfolio sidebar (desktop inline, mobile overlay)
- `components/PortfolioDashboard.tsx` — Appears to be legacy/unused alternate portfolio view
- All 10 hooks in `hooks/` directory

**Server components (no "use client" directive):**
- `app/layout.tsx` — Root layout with metadata
- `components/chat/ToolPartRenderer.tsx` — Routes tool outputs to card components
- `components/chat/cards/SwapQuoteCard.tsx` — Display-only quote
- `components/chat/cards/PoolReservesCard.tsx` — Display-only reserves
- `components/chat/cards/FarmsTableCard.tsx` — Display-only farm list
- `components/chat/cards/InfinityPoolRatesCard.tsx` — Display-only pool rates
- `components/chat/cards/YieldOpportunitiesCard.tsx` — Display-only yield table
- `components/chat/cards/TransactionHistoryCard.tsx` — Display-only tx history
- `components/chat/cards/ToolCardSkeleton.tsx` — Loading skeleton
- `components/chat/cards/ToolErrorCard.tsx` — Error display

**No "use server" directives found anywhere in the codebase.** No server actions are used.

### Backend (Server-Side)

**API routes found:** 1 total
- `app/api/chat/route.ts` — POST endpoint for AI chat

**What runs on server:**
- System prompt construction with portfolio context (`lib/ai/system-prompt.ts`)
- Claude Sonnet 4 invocation via `streamText()` from Vercel AI SDK
- All 13 AI tool executions (on-chain reads via viem `createPublicClient`)
- Portfolio/pool data serialization (`lib/ai/serializers.ts`)

**AI integration details:**
- **SDK:** Vercel AI SDK v6 (`ai` package) + `@ai-sdk/anthropic` v3
- **Model:** `claude-sonnet-4-20250514` (Claude Sonnet 4)
- **API key:** `ANTHROPIC_API_KEY` — server-side only, read automatically by SDK
- **Step limit:** `stopWhen: stepCountIs(5)` prevents infinite tool-calling loops
- **Error handling:** Tool-level error handling exists; no explicit try-catch wrapper on the route itself
- **Rate limiting:** None implemented
- **Auth:** None — endpoint is open to anyone who can reach the server

### Data & Persistence

- **Database:** None. Zero database/ORM imports (no Prisma, Drizzle, Supabase, MongoDB, SQLite, etc.)
- **Session storage:** None. No next-auth, iron-session, JWT, or cookie-based sessions
- **localStorage / sessionStorage / indexedDB:** None used
- **Conversation persistence:** None. Chat history lives only in React state (`useChat` hook). Refreshing the page clears all messages.
- **User preferences:** Not stored anywhere. No settings persistence.
- **All state is ephemeral and derived from:** (a) on-chain reads via RPC, (b) in-memory React state

### Security & Secrets

**API keys exposure: SAFE**

| Variable | Prefix | Exposure | File |
|----------|--------|----------|------|
| `ANTHROPIC_API_KEY` | None | Server-only (read by SDK internally) | Used in `app/api/chat/route.ts` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | `NEXT_PUBLIC_` | Browser (intentional — WalletConnect requires it) | `config/wagmi.ts` |

- `.env*` is properly gitignored
- `.env.local.example` exists with both variables documented
- No hardcoded secrets in source code
- No hardcoded localhost URLs

**Unauthenticated API route:** `POST /api/chat` has no authentication or rate limiting. Anyone who discovers the endpoint can make unlimited Claude API calls at your expense.

### On-Chain Integration

**Wallet library:** wagmi 2.19.5 + viem 2.46.3 + RainbowKit 2.2.10

**Chain:** Kasplex L2 (chainId 202555, native KAS, 18 decimals)

**RPC configuration:** Hardcoded to `https://evmrpc.kasplex.org` in two places:
- `config/chains.ts` (chain definition, line 13)
- `config/wagmi.ts` (transport config, line 10, with retry:0, timeout:10s, batch:100/50ms)

Not configurable via environment variables. No fallback RPC.

**Where chain reads happen — DUAL PATTERN:**

| Context | Where | Method | Purpose |
|---------|-------|--------|---------|
| Portfolio display | Client (hooks) | wagmi `useBalance`, `useReadContracts` | Show balances, LP positions, farm stakes, staking positions in sidebar |
| AI tool execution | Server (API route) | viem `createPublicClient` + `client.readContract()` | Quotes, reserves, farm info, yield analysis, tx preparation |

This means the same data is sometimes read in both places — hooks for sidebar display, tools for AI context.

**Where transaction building happens:** Server-side in AI tools. Each `prepare*` tool returns a `tx` object with raw amounts, addresses, and parameters.

**Where transaction execution happens:** Client-side in execution card components via wagmi `useWriteContract`. The user's wallet signs and broadcasts. Multi-step flows (approve → execute) are handled with state machines in each card.

**Contract addresses (all hardcoded in `config/contracts.ts`):**

| Contract | Address |
|----------|---------|
| Router (ZealousSwap) | `0xA5B0946D31aD2d251e0fe2dfEA8808BFd475e607` |
| Factory | `0x98Bb580A77eE329796a79aBd05c6D2F2b3D5E1bD` |
| MasterChef | `0x97ac386fFf8d25Bc3F949194f74a79E94617bc7F` |
| InfinityPool (ZEAL) | `0x1E7748BA1d372186a322E7CfaAB1306f19FfB897` |
| InfinityPool (NACHO) | `0x0d4f07811718C0eE57EA2FCDb844c3585ae0F315` |
| InfinityPool (KASPER) | `0xa1074f1cD056862ebA654344518aa8c6DE0afE74` |
| WKAS | `0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e` |

**ABIs defined in `config/abis/` (8 files):** erc20, router, factory, pair, masterchef, infinityPoolZeal, infinityPoolSimple, index

## Deployment Gaps

### Critical (must fix before production)

1. **No authentication on `/api/chat`** — Anyone can POST to this endpoint and burn your Anthropic API credits. There is no auth check, no API key requirement, no session validation. This is the single biggest gap. At minimum, require a connected wallet signature or add a simple API key check.

2. **No rate limiting on `/api/chat`** — Even with auth, a single user could spam the endpoint. No middleware, no token bucket, no request throttling exists anywhere.

3. **No error handling on the API route** — `app/api/chat/route.ts` has no try-catch around `streamText()`. If the Anthropic API fails (rate limit, invalid key, network error), the server returns an unhandled error. The client does display errors from `useChat`, but the server should return proper HTTP status codes.

### Important (should fix)

4. **RPC URL is hardcoded** — `https://evmrpc.kasplex.org` appears in `config/chains.ts` and `config/wagmi.ts` with no env var override and no fallback RPC. If this endpoint goes down, the entire app is dead. wagmi retry count is set to 0.

5. **Conversation history is ephemeral** — Chat messages exist only in React state. A page refresh loses everything. No persistence mechanism exists. For a DeFi copilot, losing the context of what the AI recommended (and what the user approved) is a usability gap.

6. **`components/PortfolioDashboard.tsx` appears unused** — This file duplicates sidebar functionality in a dashboard format. It is imported nowhere in the current layout. Dead code.

7. **No CORS configuration** — `next.config.ts` has no explicit CORS headers. The API route relies on Next.js defaults (same-origin). This is probably fine for Vercel deployment but should be explicitly configured.

### Minor (nice to have)

8. **No deployment config files** — No `vercel.json`, no `Dockerfile`, no `docker-compose.yml`. Relies entirely on Vercel auto-detection of Next.js. This works but means no explicit control over caching, headers, or function regions.

9. **No environment variable validation** — The app will silently fail if `ANTHROPIC_API_KEY` or `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` are missing. A startup validation using zod (already in dependencies) would catch misconfigs early.

10. **No TODO/FIXME/HACK comments found** — Clean codebase, but also means no self-documented technical debt. The gaps listed above are undocumented.

## Raw Inventory

### File Counts

| Category | Count |
|----------|-------|
| Total source files (.ts/.tsx, excl node_modules/.next) | 67 |
| Total lines of code (TypeScript only) | ~7,189 |
| App pages | 1 (`app/page.tsx`) |
| App layouts | 1 (`app/layout.tsx`) |
| API routes | 1 |
| Components | 28 files |
| Hooks | 10 files |
| Config files | 12 files (4 config + 8 ABIs) |
| Lib/AI files | 11 files |
| Lib utility files | 2 files |

### API Routes

| Route | Method | File |
|-------|--------|------|
| `/api/chat` | POST | `app/api/chat/route.ts` |

### AI Tools (13 total)

| Tool Name | File | Line |
|-----------|------|------|
| `getSwapQuote` | `lib/ai/tools/swap.ts` | ~23 |
| `prepareSwap` | `lib/ai/tools/swap.ts` | ~77 |
| `getPoolReserves` | `lib/ai/tools/liquidity.ts` | ~21 |
| `prepareAddLiquidity` | `lib/ai/tools/liquidity.ts` | ~95 |
| `prepareRemoveLiquidity` | `lib/ai/tools/liquidity.ts` | ~298 |
| `getActiveFarms` | `lib/ai/tools/farms.ts` | ~14 |
| `prepareFarmStake` | `lib/ai/tools/farms.ts` | ~98 |
| `prepareFarmUnstake` | `lib/ai/tools/farms.ts` | ~226 |
| `getInfinityPoolRates` | `lib/ai/tools/staking.ts` | ~15 |
| `prepareInfinityStake` | `lib/ai/tools/staking.ts` | ~102 |
| `prepareInfinityUnstake` | `lib/ai/tools/staking.ts` | ~198 |
| `discoverYieldOpportunities` | `lib/ai/tools/yield.ts` | ~22 |
| `getTransactionHistory` | `lib/ai/tools/history.ts` | ~61 |

### Environment Variables

| Variable | Server/Client | Required | Purpose |
|----------|---------------|----------|---------|
| `ANTHROPIC_API_KEY` | Server-only | Yes | Claude API authentication |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Client (NEXT_PUBLIC_) | Yes | WalletConnect wallet connections |

### Runtime Dependencies (13)

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.1.6 | Framework |
| `react` | 19.2.3 | UI library |
| `react-dom` | 19.2.3 | React DOM renderer |
| `ai` | ^6.0.112 | Vercel AI SDK (streaming, tools) |
| `@ai-sdk/anthropic` | ^3.0.55 | Claude provider for AI SDK |
| `@ai-sdk/react` | ^3.0.114 | React hooks for AI SDK (`useChat`) |
| `wagmi` | ^2.19.5 | Ethereum/EVM wallet hooks |
| `viem` | ^2.46.3 | Ethereum client library |
| `@rainbow-me/rainbowkit` | ^2.2.10 | Wallet connect UI |
| `@tanstack/react-query` | ^5.90.21 | Data fetching/caching |
| `react-markdown` | ^10.1.0 | Markdown rendering |
| `remark-gfm` | ^4.0.1 | GitHub-flavored markdown |
| `lucide-react` | ^0.577.0 | Icon library |
| `zod` | ^4.3.6 | Schema validation (used in AI tool params) |

### Dev Dependencies (7)

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5 | Type checking |
| `tailwindcss` | ^4 | CSS framework |
| `@tailwindcss/postcss` | ^4 | PostCSS integration |
| `eslint` | ^9 | Linting |
| `eslint-config-next` | 16.1.6 | Next.js ESLint rules |
| `@types/node` | ^20 | Node.js type defs |
| `@types/react` | ^19 | React type defs |
| `@types/react-dom` | ^19 | React DOM type defs |

### External Services

| Service | URL | Usage |
|---------|-----|-------|
| Kasplex L2 RPC | `https://evmrpc.kasplex.org` | All on-chain reads + tx broadcast |
| Kasplex Explorer API | `https://explorer.kasplex.org/node-api/proxy/api/v2` | Transaction history (Blockscout) |
| Anthropic API | Via `@ai-sdk/anthropic` SDK | Claude Sonnet 4 LLM calls |
| WalletConnect | Via RainbowKit | Wallet connection relay |
