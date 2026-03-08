# KasAgent Architecture

This document describes the current implementation of KasAgent in this repository. It is an architecture snapshot of the codebase as it exists today, not a future-state roadmap.

## 1. System Summary

KasAgent is a single Next.js 16 application for Kasplex L2 with four core responsibilities:

1. Render a wallet-connected chat UI and portfolio sidebar in the browser.
2. Read on-chain Kasplex and ZealousSwap data from both the client and server.
3. Use Anthropic via the Vercel AI SDK to turn natural language into structured tool calls.
4. Persist conversation history in Supabase.

The system is intentionally non-custodial:

- The server prepares data, quotes, risk flags, and transaction parameters.
- The browser wallet signs and submits all user transactions.
- The backend never holds private keys and never sends transactions on the user's behalf.

## 2. Architectural Principles

### Non-custodial execution

AI tools stop at "prepare" and "explain". Final execution lives in client-side action cards that use `wagmi` writes and wallet confirmation.

### Chain-first vertical slices

The app is currently Kasplex L2 + ZealousSwap specific. Domain logic is split by capability (`swap`, `liquidity`, `farms`, `staking`, `yield`, `history`) instead of introducing premature multi-chain abstractions.

### Dynamic token discovery

Tokens are not maintained as a hardcoded list. Both client and server discover tokens by reading ZealousSwap Factory pairs, then reading ERC-20 metadata from the discovered token addresses.

### Structured conversation UX

Tool results are first-class UI objects. The assistant stream interleaves text with typed cards rather than flattening everything into plain markdown.

## 3. High-Level Component Model

```text
Browser
  |- Next.js app shell
  |- wagmi + RainbowKit wallet connection
  |- React Query cache
  |- Portfolio read hooks
  |- AI chat UI
  |- Execution cards -> wallet approvals + contract writes

Next.js Route Handlers
  |- /api/chat
  |- /api/conversations
  |- /api/conversations/[id]
  |- /api/conversations/save

Server-side Integrations
  |- Anthropic Claude via Vercel AI SDK
  |- viem public client for Kasplex RPC reads
  |- Supabase Postgres + RPC function for rate limiting
  |- Kasplex Blockscout-style explorer API

Kasplex L2 / ZealousSwap
  |- Router
  |- Factory
  |- Pair contracts
  |- MasterChef
  |- InfinityPools
```

## 4. Runtime Layers

### 4.1 App Shell and Providers

The app starts in [`app/layout.tsx`](./app/layout.tsx) and [`app/providers.tsx`](./app/providers.tsx).

- `Providers` installs:
  - `WagmiProvider`
  - `QueryClientProvider`
  - `RainbowKitProvider`
- Wagmi config is defined in [`config/wagmi.ts`](./config/wagmi.ts).
- Chain metadata lives in [`config/chains.ts`](./config/chains.ts).
- Shared server-side RPC access lives in [`lib/viem-client.ts`](./lib/viem-client.ts).

Both wagmi and viem support a primary RPC plus an optional fallback RPC from environment variables.

### 4.2 Page Composition

[`app/page.tsx`](./app/page.tsx) is the top-level composition root for the application UI. It wires together:

- `AppHeader`
- `PortfolioSidebar`
- `ChatContainer`
- `usePortfolio`
- `useInfinityPoolData`
- `useConversations`
- `useSidebarState`
- `useReconnectOnFocus`

This is a client-rendered application shell. Most wallet-aware and on-chain state is loaded after hydration via wagmi hooks.

### 4.3 On-Chain Read Path

KasAgent uses two parallel read layers:

#### Client-side read layer

Used for wallet-scoped UI state:

- [`hooks/usePortfolio.ts`](./hooks/usePortfolio.ts) aggregates:
  - [`hooks/useTokenBalances.ts`](./hooks/useTokenBalances.ts)
  - [`hooks/useLpPositions.ts`](./hooks/useLpPositions.ts)
  - [`hooks/useFarmPositions.ts`](./hooks/useFarmPositions.ts)
  - [`hooks/useStakingPositions.ts`](./hooks/useStakingPositions.ts)
- Supporting hooks:
  - [`hooks/useAllPairs.ts`](./hooks/useAllPairs.ts)
  - [`hooks/useActiveFarms.ts`](./hooks/useActiveFarms.ts)
  - [`hooks/useInfinityPoolData.ts`](./hooks/useInfinityPoolData.ts)
  - [`hooks/useTokenRegistry.ts`](./hooks/useTokenRegistry.ts)

These hooks use wagmi `useReadContract` and `useReadContracts` against the connected wallet context.

#### Server-side read layer

Used for AI tools and prompt grounding:

- [`lib/viem-client.ts`](./lib/viem-client.ts)
- [`lib/token-registry.ts`](./lib/token-registry.ts)
- [`lib/ai/tools/helpers.ts`](./lib/ai/tools/helpers.ts)
- [`lib/ai/tools/*.ts`](./lib/ai/tools)

The server-side registry caches discovered tokens in memory for 5 minutes.

### 4.4 Chat and AI Orchestration

[`components/chat/ChatContainer.tsx`](./components/chat/ChatContainer.tsx) is the browser-side chat controller.

It:

- uses `useChat` from `@ai-sdk/react`
- sends requests to `/api/chat` through `DefaultChatTransport`
- serializes the latest wallet portfolio and InfinityPool state into the request body
- saves the finished conversation through `useConversations`

The request body is intentionally closure-backed so the transport always sends fresh portfolio context without rebuilding the transport object each render.

On the server, [`app/api/chat/route.ts`](./app/api/chat/route.ts):

1. validates the wallet address format
2. checks a Supabase-backed rate-limit RPC (`check_rate_limit`)
3. validates that messages exist
4. builds a dynamic system prompt with:
   - token registry data
   - protocol metadata
   - serialized wallet balances and positions
   - InfinityPool global state
5. streams Claude responses with tool access

The AI layer is assembled from:

- [`lib/ai/system-prompt.ts`](./lib/ai/system-prompt.ts)
- [`lib/ai/tools/index.ts`](./lib/ai/tools/index.ts)
- [`lib/ai/tools/swap.ts`](./lib/ai/tools/swap.ts)
- [`lib/ai/tools/liquidity.ts`](./lib/ai/tools/liquidity.ts)
- [`lib/ai/tools/farms.ts`](./lib/ai/tools/farms.ts)
- [`lib/ai/tools/staking.ts`](./lib/ai/tools/staking.ts)
- [`lib/ai/tools/yield.ts`](./lib/ai/tools/yield.ts)
- [`lib/ai/tools/history.ts`](./lib/ai/tools/history.ts)

`streamText` is limited to 5 reasoning/tool steps per request.

### 4.5 Structured Message Rendering

Assistant messages are rendered by [`components/chat/ChatMessage.tsx`](./components/chat/ChatMessage.tsx).

The renderer walks `message.parts` in order:

- `text` parts -> markdown bubbles
- tool parts -> `ToolPartRenderer`

[`components/chat/ToolPartRenderer.tsx`](./components/chat/ToolPartRenderer.tsx) dispatches completed tool outputs into typed cards such as:

- `SwapQuoteCard`
- `SwapExecutionCard`
- `PoolReservesCard`
- `FarmsTableCard`
- `InfinityPoolRatesCard`
- `YieldOpportunitiesCard`
- transaction execution cards for liquidity, farms, and InfinityPools

Unknown tools fall back to JSON rendering instead of being dropped.

Quick follow-up prompts are derived from the last assistant tool result by [`lib/ai/quick-actions.ts`](./lib/ai/quick-actions.ts) and shown by [`components/chat/QuickActions.tsx`](./components/chat/QuickActions.tsx).

### 4.6 Transaction Execution Boundary

This is the most important trust boundary in the system.

#### Server responsibilities

AI tools prepare:

- quotes
- expected outputs
- slippage bounds
- risk flags
- allowance checks
- contract metadata
- raw transaction parameters

#### Client responsibilities

Execution cards submit the actual writes with the connected wallet:

- [`components/chat/cards/SwapExecutionCard.tsx`](./components/chat/cards/SwapExecutionCard.tsx)
- [`components/chat/cards/AddLiquidityCard.tsx`](./components/chat/cards/AddLiquidityCard.tsx)
- [`components/chat/cards/RemoveLiquidityCard.tsx`](./components/chat/cards/RemoveLiquidityCard.tsx)
- [`components/chat/cards/FarmStakeCard.tsx`](./components/chat/cards/FarmStakeCard.tsx)
- [`components/chat/cards/FarmUnstakeCard.tsx`](./components/chat/cards/FarmUnstakeCard.tsx)
- [`components/chat/cards/InfinityStakeCard.tsx`](./components/chat/cards/InfinityStakeCard.tsx)
- [`components/chat/cards/InfinityUnstakeCard.tsx`](./components/chat/cards/InfinityUnstakeCard.tsx)

These components:

- use `useWriteContract` from `wagmi`
- optionally send approval transactions first
- wait for receipts with `waitForTransactionReceipt`
- manage local execution state (`idle`, `approving`, `success`, `error`, `cancelled`)

Important consequence:

- transaction success/failure state is currently local UI state
- it is not written back into Supabase conversations after execution

## 5. Persistence and Identity Model

Supabase is only used on the server.

- Server client: [`lib/supabase.ts`](./lib/supabase.ts)
- Conversation API routes:
  - [`app/api/conversations/route.ts`](./app/api/conversations/route.ts)
  - [`app/api/conversations/[id]/route.ts`](./app/api/conversations/[id]/route.ts)
  - [`app/api/conversations/save/route.ts`](./app/api/conversations/save/route.ts)

### Stored data

The current storage model is:

- `conversations`
  - `id`
  - `wallet_address`
  - `title`
  - timestamps
- `messages`
  - `id`
  - `conversation_id`
  - `role`
  - `parts` JSONB
  - timestamps

### Client state and loading behavior

[`hooks/useConversations.ts`](./hooks/useConversations.ts) manages:

- conversation list
- active conversation id
- loaded messages
- active sidebar tab
- save error state
- `chatLoadKey`

`chatLoadKey` is used as the React `key` for `ChatContainer`. This forces a remount when the user starts a new chat, loads a different conversation, deletes the active conversation, or switches wallets.

### Save strategy

Conversation saves happen after AI response completion via `onFinish`.

The save route uses an insert-before-delete message replacement strategy:

1. create or validate the conversation
2. insert the new message set
3. delete old message rows

This prefers possible duplication over data loss if insertion succeeds but cleanup fails.

### Identity and trust model

KasAgent currently treats `walletAddress` as the user identity.

That means:

- `/api/chat` requires a valid-looking wallet address
- conversation routes verify that the provided wallet matches the stored wallet address
- there is no signed session or cryptographic proof that the caller controls that wallet

This is acceptable for the current MVP shape because the server does not custody funds, but it is an important architectural limitation.

## 6. External Integrations

### Kasplex RPC

Used for:

- token discovery
- balances
- LP positions
- farm state
- InfinityPool state
- swap quoting and transaction preparation

### RainbowKit / WalletConnect / Wallet Provider

Used for:

- wallet connection
- chain switching
- all user-approved writes

### Anthropic Claude

Used only through the server-side `/api/chat` route for reasoning and tool orchestration.

### Supabase

Used for:

- conversation persistence
- rate limiting RPC

### Explorer API

[`lib/ai/tools/history.ts`](./lib/ai/tools/history.ts) queries the Kasplex explorer API for recent transactions and token transfers, then enriches the response with:

- action labels from method selectors
- contract labels for known protocol addresses
- token symbols from the dynamic token registry

## 7. Request and Data Flows

### 7.1 Initial wallet-connected load

```text
User opens app
  -> Next.js renders app shell
  -> user connects wallet through RainbowKit
  -> client portfolio hooks query Kasplex RPC
  -> header + sidebar update with balances, LPs, farms, staking
```

### 7.2 Chat request with tool calls

```text
User sends message
  -> ChatContainer sends messages + serialized wallet context to /api/chat
  -> server validates wallet + rate limit
  -> server builds system prompt from wallet snapshot + dynamic token registry
  -> Claude streams text and tool calls
  -> tool modules read RPC/explorer data and return structured payloads
  -> UI renders text bubbles + tool cards inline
  -> onFinish saves conversation to Supabase
```

### 7.3 Transaction execution

```text
User clicks Execute on a tool card
  -> client card optionally sends ERC-20 approval
  -> client card submits contract write with wallet
  -> waits for receipt
  -> shows success/error state with explorer link
```

## 8. Directory Responsibilities

| Path | Responsibility |
| --- | --- |
| `app/` | Next.js app shell and route handlers |
| `app/api/chat` | AI streaming endpoint |
| `app/api/conversations*` | Conversation CRUD and persistence |
| `components/chat/` | Chat UI, tool rendering, execution cards |
| `components/header/` | Header, wallet/network status |
| `components/sidebar/` | Chats/portfolio sidebar |
| `hooks/` | Client-side state and on-chain read composition |
| `lib/ai/` | System prompt, serializers, tool modules, quick actions |
| `lib/token-registry.ts` | Server-side dynamic token discovery |
| `lib/viem-client.ts` | Shared public RPC client |
| `lib/supabase.ts` | Server-only Supabase client |
| `config/` | Chain, wallet, contract, token, and ABI configuration |

## 9. Configuration Surface

Environment variables are validated centrally in [`lib/env.ts`](./lib/env.ts).

### Client-visible

- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_RPC_URL_FALLBACK`

### Server-only

- `ANTHROPIC_API_KEY`
- `EXPLORER_API_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Public but currently consumed server-side

- `NEXT_PUBLIC_SUPABASE_URL`

The Supabase URL is not secret. The sensitive Supabase credential in this app is `SUPABASE_SERVICE_ROLE_KEY`.

### Present in local setup but not part of the current runtime path

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The client does not currently use Supabase directly, so the anon key is part of project setup but not part of the active architecture shown above.

## 10. Current Strengths

- Clear separation between read/prepare logic and final transaction execution.
- Good modularity in AI tooling by domain.
- Dynamic token support without manual listing.
- Conversation persistence is isolated behind server routes instead of exposing the database directly to the client.
- Structured cards make tool outputs explicit and inspectable.

## 11. Current Constraints and Known Gaps

- The app is single-chain and single-protocol by design.
- Client and server both implement token discovery; the logic is mirrored rather than unified.
- Wallet identity is not cryptographically authenticated at the API boundary.
- Conversation history persists, but post-execution transaction outcomes do not.
- Rate limiting fails open if the Supabase RPC call errors.
- There are no background jobs, queues, or server-side workers; all work happens in request/response route handlers or in the browser.

## 12. In Practice

The simplest way to think about KasAgent is:

- `hooks/` build a live portfolio view in the browser
- `lib/ai/tools/` gives Claude grounded, deterministic protocol capabilities
- `components/chat/cards/` convert prepared actions into wallet-signed transactions
- `app/api/conversations*` stores the conversation layer around that interaction

That keeps the system understandable: the server reasons and prepares, the client reads and signs, and Supabase stores the conversational history.
