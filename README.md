# KasAgentV2

AI-powered DeFi copilot for [Kasplex L2](https://kasplex.org). Chat with Claude to swap tokens, provide liquidity, farm, stake, and execute multi-step strategies — all non-custodially.

---

## Overview

KasAgentV2 gives you a conversational interface to manage your DeFi portfolio on Kasplex L2. Describe what you want in plain language and the AI researches, plans, and prepares transactions for you to sign. It integrates three DEX protocols with 23 on-chain tools, real-time streaming responses, and a portfolio-aware feed of proactive insights.

**Network**: Kasplex L2 — Chain ID `202555`
**RPC**: `https://evmrpc.kasplex.org`
**Explorer**: `https://explorer.kasplex.org`

---

## Features

- **Conversational DeFi** — swap, add/remove liquidity, farm, and stake via natural language
- **Multi-protocol** — ZealousSwap (full suite), KrokoSwap (V2+V3), KaspaCom (V2)
- **Cross-DEX comparison** — automatically compares rates across all protocols
- **Strategy planner** — multi-step operations (e.g. swap → add LP → stake in farm) with live quotes
- **Portfolio feed** — proactive insights for idle capital, unclaimed rewards, better yield
- **Wallet inspection** — inspect any wallet's positions and balances
- **Streaming AI** — real-time responses with rich tool output cards
- **Non-custodial** — app never holds keys; every transaction requires your wallet signature

---

## Tech Stack

| Layer | Libraries |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Wallet | wagmi 2.x, viem 2.x, RainbowKit 2.x |
| AI | Vercel AI SDK 6.x, Anthropic Claude Sonnet 4 |
| Auth | SIWE 3.x + jose (JWT, httpOnly cookies) |
| Database | Supabase (PostgreSQL + RLS) |
| Styling | Tailwind CSS 4, dark theme |
| State | TanStack Query 5, Zustand 5 |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A WalletConnect project ID — [cloud.walletconnect.com](https://cloud.walletconnect.com)
- An Anthropic API key — [console.anthropic.com](https://console.anthropic.com)
- A Supabase project — [supabase.com](https://supabase.com)

### Installation

```bash
git clone https://github.com/your-org/KasAgentV2.git
cd KasAgentV2
npm install
```

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```env
# Wallet
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# AI
ANTHROPIC_API_KEY=sk-ant-...

# Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Auth (must be 32+ characters)
JWT_SECRET=your_super_secret_jwt_key_at_least_32_chars

# RPC (optional — defaults to Kasplex mainnet)
# NEXT_PUBLIC_RPC_URL=https://evmrpc.kasplex.org
# NEXT_PUBLIC_RPC_URL_FALLBACK=https://your-fallback-rpc.com
```

### Development

```bash
npm run dev       # Start with Turbopack (fast HMR)
npm run build     # Production build
npm start         # Start production server
npm run lint      # Run ESLint
npm run benchmark # Benchmark RPC call count per tool
```

---

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── (app)/              # Main routes (/ and /c/[id])
│   ├── api/                # API routes (auth, chat, conversations, feed)
│   ├── layout.tsx          # Root layout + providers
│   └── globals.css         # Tailwind 4 + dark theme
│
├── components/             # React components
│   ├── chat/               # Chat UI + 24 tool output cards
│   ├── feed/               # Proactive insight cards
│   ├── shell/              # AppShell, LeftRail, PortfolioSlideOut
│   └── sidebar/            # ConversationList, PortfolioPanel
│
├── config/                 # Configuration
│   ├── contracts.ts        # Smart contract addresses
│   ├── protocols.ts        # Protocol registry (ZealousSwap, KrokoSwap, KaspaCom)
│   ├── chains.ts           # Kasplex L2 chain definition
│   ├── wagmi.ts            # Wagmi + RainbowKit config
│   └── abis/               # Contract ABIs (14 files, all parseAbi)
│
├── hooks/                  # React hooks (16 files)
│   ├── usePortfolio.ts     # Master portfolio aggregator
│   ├── useCardExecution.ts # Multi-step transaction lifecycle
│   └── ...                 # Balance, LP, farm, staking, conversations hooks
│
├── lib/                    # Core utilities + AI system
│   ├── auth.ts             # SIWE + JWT cryptography
│   ├── viem-client.ts      # Singleton viem PublicClient
│   ├── format.ts           # Token/price/time formatting
│   ├── token-registry.ts   # On-chain token/pair discovery + cache
│   ├── ai/                 # System prompt, tool types, serializers
│   │   └── tools/          # 23 AI tools across 4 protocol modules
│   └── db/queries.ts       # Conversation + message CRUD
│
├── stores/ui.ts            # Zustand store (panel open/close state)
└── scripts/benchmark-rpc.ts # Verify multicall RPC optimization
```

---

## Authentication

Authentication uses [Sign-In With Ethereum](https://eips.ethereum.org/EIPS/eip-4361) with JWT cookies:

1. User connects wallet via RainbowKit
2. App requests a nonce from `/api/auth/nonce`
3. User signs a SIWE message in their wallet
4. App verifies the signature and issues a 7-day httpOnly JWT cookie
5. All API routes authenticate via the cookie — no wallet address in request bodies

Security properties: httpOnly cookies (XSS-proof), domain + chain ID validation, atomic nonce deletion (replay-proof), per-wallet rate limiting (30 req/15 min).

---

## AI Tools

23 tools organized by protocol:

| Protocol | Tools |
|----------|-------|
| ZealousSwap | `zealous_getSwapQuote`, `zealous_prepareSwap`, `zealous_getPoolReserves`, `zealous_prepareAddLiquidity`, `zealous_prepareRemoveLiquidity`, `zealous_getActiveFarms`, `zealous_prepareFarmStake`, `zealous_prepareFarmUnstake`, `zealous_getInfinityPoolRates`, `zealous_prepareInfinityStake`, `zealous_prepareInfinityUnstake`, `zealous_listAllPairs`, `zealous_discoverYieldOpportunities`, `zealous_getMembershipStatus` |
| KrokoSwap | `kroko_getSwapQuote`, `kroko_prepareSwap` |
| KaspaCom | `kaspacom_getSwapQuote`, `kaspacom_prepareSwap` |
| Cross-DEX | `compareSwapQuotes`, `planStrategy` |
| Utility | `getTokenPrice`, `getTransactionHistory`, `spyOnWallet` |

### Adding a New Protocol

1. Add entry to `config/protocols.ts`
2. Create tool module in `lib/ai/tools/{protocol}/`
3. Add card components in `components/chat/cards/`
4. Register cards in `lib/ui/tool-card-registry.tsx`

No changes to shared infrastructure needed.

---

## Protocols

### ZealousSwap
Full-featured AMM DEX. Swap fee: 0.3% (0.2% with discount via Membership, xZEAL staking, or NFT staking). Supports liquidity provision, MasterChef farms (ZEAL emissions), and InfinityPool single-sided staking for ZEAL, NACHO, and KASPER.

### KrokoSwap
Dual-AMM with Uniswap V2 + V3 pools. Uses a Universal Router for optimal cross-pool routing and Permit2 for approvals. Quotes and calldata served via REST API.

### KaspaCom
Simple Uniswap V2 fork with a fixed 1% swap fee. Swap-only — no farms or staking.

---

## Database

Supabase PostgreSQL with row-level security on all tables. Tables:

| Table | Purpose |
|-------|---------|
| `conversations` | Chat conversations per wallet |
| `messages` | Message history with serialized tool parts |
| `execution_states` | Transaction execution state per tool call |
| `auth_sessions` | SIWE nonce storage (10-min TTL) |
| `rate_limits` | Per-wallet request rate tracking |
| `feed_cache` | Cached portfolio insights (2-min TTL) |

---

## RPC Optimization

All contract reads use Multicall3 batching. The benchmark script verifies expected RPC counts:

```bash
npm run benchmark
```

| Operation | Max RPCs |
|-----------|----------|
| Token discovery (warm cache) | 0 |
| Yield discovery | 2 |
| InfinityPool rates | 1 |
| Active farms | 2 |
| Token price | 2 |

---

## Deep Documentation

See [`research.md`](./research.md) for a complete deep-dive — every file, every connection, all architectural decisions explained.
