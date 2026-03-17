# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Dev server with Turbopack (fast HMR)
npm run build      # Production build (use to verify before pushing)
npm run lint       # ESLint
npm run benchmark  # Verify RPC call count per tool (scripts/benchmark-rpc.ts)
```

No test framework is configured — verify changes with `npm run build`.

## Architecture

**KasAgentV2** is an AI-powered DeFi copilot for Kasplex L2 (chain 202555). Users chat with Claude to execute on-chain DeFi operations (swap, LP, farm, stake) across three protocols — all non-custodially.

### Routing

- `/` — feed + new chat (server generates UUID via `crypto.randomUUID()`, `await cookies()` forces dynamic rendering)
- `/c/[id]` — existing conversation (authenticates via `getServerWallet()`, redirects to `/` if unauthenticated)
- Layout: `AppShell` → `LeftRail` (conversations) + main content + `PortfolioSlideOut`
- Route group `(app)/` wraps everything in `AppShell`
- On first message from `/`, Chat uses `history.pushState` to rewrite URL to `/c/{id}` without navigation
- `<Chat key={id}>` forces React unmount/remount on conversation switch

### AI Tool System

Tools live in `lib/ai/tools/`, organized by protocol:
- `zealous/` (14 tools) — swap, liquidity, farms, staking, yield, membership, pairs
- `kroko/` (2 tools) — swap only
- `kaspacom/` (2 tools) — swap only
- Root-level: `compare.ts` (cross-DEX), `strategy.ts` (multi-step planner), `spy.ts`, `history.ts`, `oracle.ts`

**Naming convention**: `{protocol}_{action}` for protocol-specific tools, no prefix for shared.

Each tool uses Zod schemas for inputs and returns typed result objects. The `lib/ui/tool-card-registry.tsx` maps tool result types → React card components in `components/chat/cards/`.

**System prompt** (`lib/ai/system-prompt.ts`) uses 3-part Anthropic cache architecture:
- Block 1 (static, cached indefinitely): identity, behavior rules, tool selection logic
- Block 2 (semi-static, 5-min ephemeral cache): protocol knowledge, token list, chain info
- Block 3 (dynamic, per-request): wallet address, balances, positions, discount status

Portfolio data injected via `lib/ai/serializers.ts` (converts bigint to string). Chat route uses `maxSteps: 5` and `result.consumeStream()` to ensure stream completes even if client disconnects.

### Auth (SIWE + JWT)

Flow: wallet connect → sign SIWE → server verifies → httpOnly JWT cookie (7-day). All API routes use `withAuth(handler)` from `lib/api-handler.ts` — wallet comes from JWT cookie, never from request body.

Key files: `lib/auth.ts`, `lib/auth-middleware.ts`, `lib/auth-provider.tsx`, `app/api/auth/`.

### Data Fetching

All on-chain data via custom hooks in `hooks/` using TanStack Query 5. Hook dependency chain:

```
Level 0: useAllPairs, useActiveFarms, useInfinityPoolData (direct contract reads)
Level 1: useTokenRegistry, useLpPositions, useFarmPositions, useStakingPositions (depend on L0)
Level 2: useTokenBalances (depends on useTokenRegistry)
Level 3: usePortfolio (master aggregator — combines all above)
```

Chained loading via `enabled: !!address && parentData.length > 0`. Hooks return raw `bigint`; formatting is done in the UI layer via `lib/format.ts`.

### Transaction Execution

All execution cards follow the same pattern: receive tool output → build approval + action steps → `useCardExecution` manages lifecycle. The hook pre-allocates 3 `useWriteContract` + 1 `useSendTransaction` (wagmi hooks can't be conditional). States: idle → executing → success/error/cancelled.

KrokoSwap is a special case with a 3-step Permit2 flow: approve ERC20 → Permit2, then Permit2 → Universal Router, then execute swap.

`useStrategyAutoContinue` watches `portfolioIsFetching` for `true → false` transition, then sends a continuation message after 1500ms delay. `useExecutionPersistence` does fire-and-forget DB saves with a pending queue.

### Protocol Integration

Protocol registry in `config/protocols.ts`. Contract addresses in `config/contracts.ts` (typed as `` `0x${string}` ``). ABIs in `config/abis/` use `parseAbi()` from viem (required for wagmi `useReadContracts` type compatibility).

To add a new protocol: add registry entry in `config/protocols.ts`, create tool modules in `lib/ai/tools/{protocol}/`, add card components, register in `tool-card-registry.tsx` — no shared layer edits needed.

### Key Singletons

- `lib/viem-client.ts` — single `PublicClient` instance for all RPC calls
- `lib/supabase.ts` — Supabase client
- `lib/token-registry.ts` — token symbol/decimal lookup with on-chain caching

### Database

Supabase with RLS on all tables. Tables: `conversations`, `messages`, `execution_states`, `rate_limits`, `auth_sessions`, `feed_cache`. CRUD in `lib/db/queries.ts`.

## Conventions

- **Target**: ES2020 (required for BigInt literals with viem/wagmi)
- **Path alias**: `@/*` → `./` (project root)
- **Styling**: Tailwind CSS 4, dark theme only
- **State**: TanStack Query for server/chain state, Zustand for client state (`stores/`)
- **Error boundaries**: `CardErrorBoundary` wraps all tool output cards
- **Rate limiting**: 30 req/15 min per wallet, fails closed (503 on Redis/Supabase error)
- **Multicall3**: available at `0x52f1eCcB5af51F2AFe0Dfb2f809F8617fDAA5be4` — batch contract reads
- **Environment validation**: `lib/env.ts` uses Zod to validate required env vars; server env guarded by `server-only` package
- **Stale closures**: `ChatContainer` uses refs (`portfolioRef`, `messagesRef`, etc.) to prevent stale closure bugs in callbacks
- **Auto-scroll**: `MessageList` scrolls to bottom unless user scrolled up >80px
- **Token cache**: `lib/token-registry.ts` uses 5-min TTL with inflight deduplication (concurrent requests share same discovery call)
