# Tool System SDK Alignment

> Align KasAgentV2's AI tool system with the AI SDK's standard patterns, as implemented in the Vercel AI Chatbot reference.

## Problem

The tool system was built from scratch when established patterns already existed in the AI SDK. This created:

- **Manual type definitions** (`tool-types.ts`) that partially duplicate what tools already return — many sub-types are used independently by card components and must be kept
- **No real-time tool progress** — tools can't send updates during execution because the streaming layer doesn't expose `dataStream`
- **All 23 tools always active** — wastes context window tokens
- **Untyped messages** — `UIMessage` used without generics, requiring `as` casts everywhere

## Reference Implementation

Vercel AI Chatbot (`C:\Users\endri\Documents\chatbot`) — built by the AI SDK team. Patterns verified against their actual code.

## Design

### 1. New Central Types File: `lib/types.ts`

**What**: Single source of truth for message and tool types, using `InferUITool` to derive types from actual tool definitions.

**Pattern from Vercel**:
```ts
import type { InferUITool, UIMessage } from "ai";
import type { getWeather } from "./ai/tools/get-weather";
import type { createDocument } from "./ai/tools/create-document";

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;

export type ChatTools = { getWeather: weatherTool; createDocument: createDocumentTool; };
export type CustomUIDataTypes = { textDelta: string; /* ... */ };
export type ChatMessage = UIMessage<undefined, CustomUIDataTypes, ChatTools>;
```

**Our implementation**: Same pattern, applied to all 23 tools.

- Stateless tools (most of ours): `InferUITool<typeof zealous_getSwapQuote>`
- Factory tools (tools that opt into dataStream): `InferUITool<ReturnType<typeof spyOnWallet>>`
- `CustomUIDataTypes` starts with a `toolProgress: string` placeholder for tool progress messages — expand as tools adopt dataStream
- `ChatMessage` used everywhere instead of bare `UIMessage`

**What happens to `tool-types.ts`**: Delete top-level result interfaces that are only used as tool return types (the SDK infers these). Keep all sub-types that are independently imported by card components, helpers, and tool implementations. Known sub-types to keep:
- `RiskFlag`, `ContractInfo`, `PrepareSwapTx` — used by execution cards
- `StrategyStep`, `StrategyStepType` — used by strategy helpers
- `YieldOpportunity`, `FarmInfo`, `InfinityPoolInfo` — used by yield/farm cards
- `PairListItem` — used by AllPairsCard
- `TransactionHistoryItem`, `TransactionHistoryResult` — used by TransactionHistoryCard
- `SwapComparisonQuote` — used by SwapComparisonCard
- `SpyTokenBalance`, `SpyLpPosition`, `SpyFarmPosition`, `SpyStakingPosition` — used by SpyPortfolioCard
- `MembershipInfo`, `NftStakingInfo`, `NftStakingGlobalStats` — used by MembershipCard
- `RiskLevel` — used independently as `Record<RiskLevel, string>` key in card components
- `TokenTransferInfo` — used by history tool to construct transaction items
- `STRATEGY_STEP_TYPES` — **runtime const** used in `z.enum()` in strategy tool (must not be deleted)

A full audit of imports will be done during implementation to catch any others. Rename `tool-types.ts` to `tool-shared-types.ts` to clarify its purpose.

### 2. API Route: Migrate to `createUIMessageStream`

**What**: Replace `result.toUIMessageStreamResponse()` with `createUIMessageStream` + `dataStream.merge()`.

**Current** (`app/api/chat/route.ts`):
```ts
const result = streamText({
  model: anthropic("claude-sonnet-4-20250514"),
  system: systemPrompt,
  messages: modelMessages,
  tools: aiTools,
  // ...
});
result.consumeStream();
return result.toUIMessageStreamResponse({ onFinish: ... });
```

**After** (matching Vercel pattern):
```ts
const stream = createUIMessageStream({
  execute: async ({ writer: dataStream }) => {
    const result = streamText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemPrompt,
      messages: modelMessages,
      tools: getTools({ dataStream }),  // factory tools receive dataStream
      activeTools: [...],   // see section 4
      stopWhen: stepCountIs(5),
    });
    dataStream.merge(result.toUIMessageStream());
  },
  onFinish: async ({ messages: finishedMessages }) => {
    // save messages to DB (same logic, different callback shape)
  },
});
return createUIMessageStreamResponse({ stream });
```

**Key change**: `createUIMessageStream` provides a `dataStream` writer. This writer is:
1. Passed to factory-pattern tools so they can emit progress during execution
2. Used to merge the AI SDK's message stream via `dataStream.merge()`

**Stream durability**: Currently, `result.consumeStream()` ensures the stream runs to completion even if the client disconnects — this is critical because `onFinish` saves the assistant message to the DB. With `createUIMessageStream`, we keep an explicit `result.consumeStream()` call inside the `execute` callback as a safety net, ensuring `onFinish` always fires regardless of client connection state.

### 3. Tool Index: Support Factory Pattern

**What**: Update `lib/ai/tools/index.ts` to support both stateless tools and factory tools.

**Current**:
```ts
export const aiTools = {
  ...zealousTools,
  ...krokoTools,
  ...kaspacomTools,
  ...compareTools,
  ...historyTools,
  ...spyTools,
  ...oracleTools,
  ...strategyTools,
};
```

**After**:
```ts
import type { UIMessageStreamWriter } from "ai";
import type { ChatMessage } from "@/lib/types";

// Stateless tools — exported directly for InferUITool
export { zealous_getSwapQuote } from "./zealous/swap";
// ... other stateless tools

// Factory tools — need dataStream
export { spyOnWallet } from "./spy";
export { planStrategy } from "./strategy";

type ToolDeps = {
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

// Called from API route with dataStream
export function getTools({ dataStream }: ToolDeps) {
  return {
    // Stateless tools pass through unchanged
    ...zealousSwapTools,
    ...zealousLiquidityTools,
    ...zealousFarmTools,
    ...zealousStakingTools,
    ...zealousYieldTools,
    ...zealousMembershipTools,
    ...zealousPairsTools,
    ...krokoTools,
    ...kaspacomTools,
    ...compareTools,
    ...historyTools,
    ...oracleTools,
    // Factory tools receive dataStream
    spyOnWallet: spyOnWallet({ dataStream }),
    planStrategy: planStrategy({ dataStream }),
  };
}
```

**Which tools become factories initially**: Only tools that benefit from streaming progress:
- `spyOnWallet` — does 3 large multicalls, takes several seconds
- `planStrategy` — computes multi-step plans with live quotes

All other tools stay stateless. Any tool can be converted to a factory later by changing its export shape — no index restructure needed.

### 4. `activeTools`

**What**: Tell the model which tools are available instead of sending all 23 tool schemas every time.

```ts
activeTools: [
  "zealous_getSwapQuote",
  "zealous_prepareSwap",
  "zealous_getPoolReserves",
  "zealous_listAllPairs",
  "zealous_prepareAddLiquidity",
  "zealous_prepareRemoveLiquidity",
  "zealous_getActiveFarms",
  "zealous_prepareFarmStake",
  "zealous_prepareFarmUnstake",
  "zealous_getInfinityPoolRates",
  "zealous_prepareInfinityStake",
  "zealous_prepareInfinityUnstake",
  "zealous_discoverYieldOpportunities",
  "zealous_getMembershipStatus",
  "kroko_getSwapQuote",
  "kroko_prepareSwap",
  "kaspacom_getSwapQuote",
  "kaspacom_prepareSwap",
  "compareSwapQuotes",
  "planStrategy",
  "getTokenPrice",
  "getTransactionHistory",
  "spyOnWallet",
],
```

For now, all 23 are listed (same behavior as current). But this creates the foundation to conditionally enable/disable tools in the future (e.g., disable farm tools when user has no LP positions, or disable all tools for reasoning model passes).

### 5. Client Component: Typed `ChatMessage`

**What**: Use `useChat<ChatMessage>()` instead of untyped `useChat()`.

**Current** (`ChatContainer.tsx`):
```ts
import { UIMessage } from "ai";
// ...
initialMessages: UIMessage[];
```

**After**:
```ts
import { ChatMessage } from "@/lib/types";
// ...
initialMessages: ChatMessage[];
// useChat<ChatMessage>({...})
```

This flows typed tool outputs through to `ToolPartRenderer`. Note: the `TOOL_CARD_REGISTRY` lookup pattern still requires casts at the registry boundary (going from generic `Record<string, unknown>` to specific result types). The benefit is that card component props can use inferred types (eliminating manual interfaces), but the registry dispatch casts remain unless the rendering architecture changes in a future refactor.

### 6. `onFinish` Callback Alignment

**What**: The `onFinish` callback shape is identical in both `toUIMessageStreamResponse` and `createUIMessageStream` — both receive `{ messages, responseMessage, isContinuation, isAborted, finishReason }`. This is a destructuring choice, not an API change.

**Current**: Destructures `{ responseMessage }` and saves the single response message.

**After**: Destructures `{ messages }` to match the Vercel pattern, which iterates over all finished messages. Since we don't have tool approval flows (no `needsApproval`), this is functionally equivalent — `messages` will contain the same assistant response. The DB persistence logic stays the same.

### 7. Card Components: Type-Safe Props

**What**: Card components can import inferred types instead of manual interfaces.

**Current**:
```ts
import { SwapQuoteResult } from "@/lib/ai/tool-types";
export function SwapQuoteCard({ data }: { data: SwapQuoteResult }) { ... }
```

**After**: Cards that use only the full tool output type can use the inferred type from `ChatTools`. Cards that use sub-types (`RiskFlag`, `ContractInfo`, etc.) continue importing from `tool-shared-types.ts`.

This is a gradual migration — cards can be updated incrementally. No big bang required.

## Files Changed

| File | Change |
|------|--------|
| `lib/types.ts` | **New** — ChatMessage, ChatTools, CustomUIDataTypes, InferUITool usage |
| `lib/ai/tool-types.ts` | **Rename** to `tool-shared-types.ts`, delete result interfaces, keep shared sub-types |
| `app/api/chat/route.ts` | **Modify** — createUIMessageStream, dataStream, activeTools |
| `lib/ai/tools/index.ts` | **Modify** — getTools() factory function, named exports for type inference |
| `lib/ai/tools/spy.ts` | **Modify** — convert to factory pattern (accepts dataStream) |
| `lib/ai/tools/strategy.ts` | **Modify** — convert to factory pattern (accepts dataStream) |
| `components/chat/ChatContainer.tsx` | **Modify** — ChatMessage type, useChat generic |
| `components/chat/Chat.tsx` | **Modify** — ChatMessage type for props |
| `components/chat/ToolPartRenderer.tsx` | **Modify** — remove `as` casts, use typed parts |
| `lib/ui/tool-card-registry.tsx` | **Modify** — update type imports |
| All card components importing from `tool-types.ts` | **Modify** — update import path to `tool-shared-types.ts` |

## Files NOT Changed (logic)

The following files have **no logic changes** — execute functions, schemas, return values, rendering, and wagmi hooks stay identical. However, ~30 files that import from `tool-types.ts` will need their import path updated to `tool-shared-types.ts`. These are mechanical path changes only:

- ~18 card components in `components/chat/cards/`
- ~8 tool implementation files (`spy.ts`, `strategy.ts`, `compare.ts`, `history.ts`, `kroko/swap.ts`, `kaspacom/swap.ts`, `zealous/swap.ts`, `zealous/liquidity.ts`, `zealous/farms.ts`, `zealous/staking.ts`, `zealous/yield.ts`)
- `lib/ai/tools/shared/helpers.ts`
- `lib/ui/tool-card-registry.tsx`, `lib/ui/strategy-helpers.ts`

**Truly untouched files**:
- **System prompt** — unchanged
- **Auth, DB, hooks** — unchanged
- **Config files** — unchanged

## What This Unlocks

1. **Real-time tool progress**: `spyOnWallet` can stream "Fetching balances..." → "Fetching LPs..." → "Fetching farms..." as it runs each multicall
2. **Type safety improvement**: tool return types inferred from definitions — eliminates manual result interfaces. Registry-level casts remain (architectural, separate concern)
3. **Selective tool activation**: foundation to conditionally enable/disable tools based on user context
4. **SDK upgrade path**: aligned with the AI SDK team's own patterns — future SDK updates will be drop-in

## What This Does NOT Change

- **Tool approval pattern**: Wallet signature remains the approval gate. No `needsApproval` on tool definitions.
- **Card registry pattern**: `TOOL_CARD_REGISTRY` lookup stays — appropriate for 23 tools.
- **Server-side persistence**: Messages still saved in `/api/chat` onFinish. Same DB schema.
- **Tool execute logic**: No changes to how tools compute quotes, build transactions, or fetch on-chain data.
