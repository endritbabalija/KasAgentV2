# KasAgent Architecture

> Last updated: 2026-03-14
> Codebase: Next.js 16 + React 19 + wagmi 2 + viem 2 + AI SDK (Anthropic Claude)

KasAgent is a non-custodial AI DeFi copilot for Kasplex L2. Users chat with an AI agent that reads on-chain data, compares DEXes, and prepares transactions — the user signs everything in their own wallet.

---

## High-Level Architecture

```
User <-> Chat UI <-> /api/chat <-> Claude (Anthropic)
                                      |
                                  AI Tools (20)
                                      |
                          +-----------+-----------+
                          |           |           |
                     ZealousSwap  KrokoSwap   Shared
                     (on-chain)   (REST API)  (oracle, history,
                                               spy, compare)
                          |           |           |
                     Kasplex L2 EVM (Chain ID: 202555)
```

**Data flow:**
1. User sends a message via the chat UI
2. Frontend passes message + serialized portfolio + wallet address to `/api/chat`
3. Server builds a 3-block system prompt (identity, protocol knowledge, wallet context)
4. Claude processes the message and calls tools as needed
5. Tool results stream back as structured data
6. `ToolPartRenderer` maps each tool result to a card component
7. Execution cards let the user approve and sign transactions via wagmi/RainbowKit

---

## Directory Structure

```
KasAgentV2/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Root page — chat UI
│   ├── layout.tsx                # Root layout with <Providers>
│   ├── providers.tsx             # Wagmi + RainbowKit + TanStack Query
│   └── api/
│       ├── chat/route.ts         # POST — AI chat streaming endpoint
│       ├── conversations/        # Conversation CRUD (Supabase-backed)
│       └── execution-states/     # Transaction state persistence
│
├── components/
│   ├── chat/
│   │   ├── ChatContainer.tsx     # useChat hook, message state
│   │   ├── ChatInput.tsx         # User input
│   │   ├── ChatMessage.tsx       # Renders text + tool parts
│   │   ├── MessageList.tsx       # Scroll container + quick actions
│   │   ├── ToolPartRenderer.tsx  # Registry-based tool → card dispatch
│   │   ├── ExecutionStateContext.tsx  # Tracks tx execution across cards
│   │   └── cards/                # 22 card components
│   │       ├── shared/ExecutionCardParts.tsx  # Reusable UI primitives
│   │       ├── SwapQuoteCard.tsx              # Quote display (both DEXes)
│   │       ├── SwapExecutionCard.tsx          # ZealousSwap swap execution
│   │       ├── KrokoSwapExecutionCard.tsx     # KrokoSwap Permit2 execution
│   │       ├── SwapComparisonCard.tsx         # Cross-DEX comparison
│   │       ├── AddLiquidityCard.tsx           # Add LP
│   │       ├── RemoveLiquidityCard.tsx        # Remove LP
│   │       ├── FarmStakeCard.tsx / FarmUnstakeCard.tsx
│   │       ├── InfinityStakeCard.tsx / InfinityUnstakeCard.tsx
│   │       ├── AllPairsCard.tsx               # Paginated pair listing
│   │       ├── YieldOpportunitiesCard.tsx     # Ranked yield table
│   │       ├── TransactionHistoryCard.tsx
│   │       ├── SpyPortfolioCard.tsx           # Read-only wallet viewer
│   │       ├── MembershipStatusCard.tsx
│   │       └── PriceCard.tsx
│   ├── header/AppHeader.tsx
│   └── sidebar/PortfolioSidebar.tsx
│
├── config/
│   ├── contracts.ts              # ZealousSwap contract addresses
│   ├── protocols.ts              # Protocol registry (zealous + kroko)
│   ├── chains.ts                 # Kasplex L2 chain definition
│   ├── wagmi.ts                  # Wagmi + RainbowKit config
│   ├── tokens.ts                 # Token interface, KAS_NATIVE
│   └── abis/                     # 12 ABI files (parseAbi pattern)
│
├── hooks/                        # Client-side React hooks
│   ├── usePortfolio.ts           # Aggregates all position hooks
│   ├── useAllPairs.ts            # Multi-factory pair discovery
│   ├── useTokenRegistry.ts       # Client-side token list
│   ├── useTokenBalances.ts       # ERC-20 + native KAS
│   ├── useLpPositions.ts         # LP balances + underlying amounts
│   ├── useFarmPositions.ts       # MasterChef staked + pending rewards
│   ├── useStakingPositions.ts    # InfinityPool xToken balances
│   ├── useActiveFarms.ts         # Farm pool metadata
│   ├── useInfinityPoolData.ts    # Pool exchange rates
│   └── useConversations.ts       # Supabase conversation CRUD
│
├── lib/
│   ├── viem-client.ts            # Single PublicClient instance
│   ├── token-registry.ts         # Server-side token discovery (5-min cache)
│   ├── kroko-api.ts              # KrokoSwap REST API client
│   ├── discount.ts               # Fee discount eligibility checker
│   ├── multicall.ts              # mcResult() helper
│   ├── format.ts                 # Token amount formatting
│   ├── supabase.ts               # Supabase client (server-only)
│   ├── env.ts                    # Zod-validated env vars
│   └── ai/
│       ├── system-prompt.ts      # 3-block cached prompt builder
│       ├── tool-types.ts         # TypeScript interfaces for all tool results
│       ├── serializers.ts        # Portfolio/pools → prompt-ready strings
│       ├── quick-actions.ts      # Follow-up suggestion buttons
│       └── tools/
│           ├── index.ts          # Merges all tool groups → aiTools
│           ├── helpers.ts        # Backward-compat shim
│           ├── compare.ts        # compareSwapQuotes (cross-DEX)
│           ├── oracle.ts         # getTokenPrice (multi-factory)
│           ├── history.ts        # getTransactionHistory
│           ├── spy.ts            # spyOnWallet (multi-factory)
│           ├── shared/
│           │   └── helpers.ts    # Protocol-agnostic utilities
│           ├── zealous/          # ZealousSwap tools (14 tools)
│           │   ├── index.ts
│           │   ├── helpers.ts    # findBestPath, calculatePriceImpact
│           │   ├── swap.ts       # zealous_getSwapQuote, zealous_prepareSwap
│           │   ├── liquidity.ts  # zealous_prepareAddLiquidity, zealous_prepareRemoveLiquidity
│           │   ├── pairs.ts      # zealous_listAllPairs
│           │   ├── farms.ts      # zealous_getActiveFarms, zealous_prepareFarmStake/Unstake
│           │   ├── staking.ts    # zealous_getInfinityPoolRates, zealous_prepareInfinityStake/Unstake
│           │   ├── yield.ts      # zealous_discoverYieldOpportunities
│           │   └── membership.ts # zealous_getMembershipStatus
│           └── kroko/            # KrokoSwap tools (2 tools)
│               ├── index.ts
│               └── swap.ts       # kroko_getSwapQuote, kroko_prepareSwap
```

---

## Protocol Registry

`config/protocols.ts` is the central registry. Each protocol declares its ID, name, features, contract addresses, and optional API URL.

```
PROTOCOLS = {
  zealous: { features: [swap, liquidity, farms, staking, membership], factoryType: "uniswap-v2" }
  kroko:   { features: [swap, liquidity],                            factoryType: "uniswap-v2", apiBaseUrl: "..." }
}
```

**Shared layers read from the registry, not hardcoded addresses:**
- `token-registry.ts` → `getAllV2Factories()` → discovers tokens from ALL factories
- `useAllPairs.ts` → `getAllV2Factories()` → fetches pairs from ALL factories
- `history.ts` → `PROTOCOLS` → labels contract interactions dynamically
- `system-prompt.ts` → `PROTOCOLS` → generates protocol knowledge blocks
- `spy.ts` / `oracle.ts` → `getAllV2Factories()` → reads across all factories

**Adding protocol #3 requires:**
1. A `PROTOCOLS` entry in `config/protocols.ts`
2. Tool modules in `lib/ai/tools/<name>/`
3. Card components + registry entries in `ToolPartRenderer.tsx`
4. One import + spread in `lib/ai/tools/index.ts`

No shared-layer edits needed.

---

## AI Tool System

### 20 Registered Tools

| Tool | Protocol | Purpose |
|------|----------|---------|
| `zealous_getSwapQuote` | ZealousSwap | On-chain quote via Router |
| `zealous_prepareSwap` | ZealousSwap | Prepare swap tx with approval check |
| `zealous_getPoolReserves` | ZealousSwap | Read pair reserves |
| `zealous_listAllPairs` | ZealousSwap | List all trading pairs |
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
| `compareSwapQuotes` | Cross-protocol | Compare rates across all DEXes |
| `getTokenPrice` | Shared | On-chain spot price (multi-factory) |
| `getTransactionHistory` | Shared | Explorer API tx history |
| `spyOnWallet` | Shared | Read-only portfolio for any address |

### Tool Naming Convention

- `{protocol}_{action}` for protocol-specific tools (e.g., `zealous_prepareSwap`)
- No prefix for protocol-agnostic tools (e.g., `getTokenPrice`)
- `compare{Action}` for cross-protocol comparison tools

### Tool → Card Dispatch

`ToolPartRenderer.tsx` uses a `Record<string, CardRenderer>` registry:

```ts
const TOOL_CARD_REGISTRY = {
  zealous_getSwapQuote: SwapQuoteCard,
  zealous_prepareSwap: SwapExecutionCard,
  kroko_getSwapQuote: SwapQuoteCard,       // Reuses same card with protocol badge
  kroko_prepareSwap: KrokoSwapExecutionCard,
  compareSwapQuotes: SwapComparisonCard,
  // ... 17 more entries
};
```

---

## Swap Flow: ZealousSwap vs KrokoSwap

### ZealousSwap (On-Chain)
```
AI Tool                              Execution Card
1. resolveTokenAddress()             1. approve(Router, amount) [if needed]
2. findBestPath() via getAmountsOut  2. swapExactKASForTokens / swapExactTokensForTokens
3. calculatePriceImpact()            3. Wait for receipt
4. checkAllowance(Router)            4. Show explorer link
5. Return tx params
```

### KrokoSwap (API + Permit2)
```
AI Tool                              Execution Card
1. resolveTokenAddress()             1. approve(Permit2, MaxUint256) [if needed]
2. GET /api/v1/quote                 2. permit2.approve(token, Router, MaxUint160) [if needed]
3. POST /api/v1/swap → calldata     3. sendTransaction(to, data, value) [pre-built calldata]
4. Check ERC-20 → Permit2 allowance 4. Wait for receipt
5. Check Permit2 → Router allowance  5. Show explorer link
6. Return tx + approval state
```

### Cross-DEX Comparison
```
compareSwapQuotes tool:
1. Promise.allSettled([zealousQuote, krokoQuote])
2. Filter errors, compare amountOut
3. >0.5% diff → best price wins
4. ≤0.5% diff → lower price impact wins
5. Return SwapComparisonResult → SwapComparisonCard
```

---

## Data Discovery

### Server-Side (`lib/token-registry.ts`)
- 5-minute in-memory cache
- Discovers from ALL V2 factories via `getAllV2Factories()`
- 4-round RPC pattern per factory: pairsLength → pairAddresses → pairDetails → tokenMetadata
- Factories discovered in parallel (`Promise.all`)
- Deduplicates tokens by symbol (prefers deepest WKAS liquidity)
- Each pair tagged with `protocolId`

### Client-Side (`hooks/useAllPairs.ts`)
- Uses `useReadContracts` (wagmi) with batched multicalls
- 3-step: pair counts from all factories → pair addresses → pair details
- Tracks `protocolId` per pair via `addressOwnership` mapping
- Feeds into `useTokenRegistry`, `useLpPositions`, `useTokenBalances`

---

## System Prompt Structure

3-block architecture with Anthropic ephemeral cache:

| Block | Content | Cache |
|-------|---------|-------|
| 1 (Static) | Identity + behavior rules + response guidelines | Cached across all users |
| 2 (Semi-static) | Protocol knowledge (from registry) + token list | Cached ~5 min (matches server cache TTL) |
| 3 (Dynamic) | User wallet: balances, LP positions, farm positions, staking, discount status | Not cached (per-user) |

Protocol knowledge is generated from `PROTOCOLS` registry — adding a new protocol auto-generates its section.

---

## Persistence (Supabase)

| Table | Purpose |
|-------|---------|
| `conversations` | Chat sessions (wallet_address, title, timestamps) |
| `messages` | Message parts (role, parts JSON array) |
| `execution_states` | Transaction outcomes (tool_call_id, state, tx_hash) |

Rate limiting via Supabase RPC function `check_rate_limit()`.

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
- `EXPLORER_API_URL` — Blockscout API (default: explorer proxy)

All validated at startup via Zod in `lib/env.ts`.
