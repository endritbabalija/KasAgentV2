# TanStack Query Migration — Backend API Calls

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual `useEffect` + `fetch` + `useState` patterns with TanStack Query (`useQuery` / `useMutation`) for three client-side data-fetching locations.

**Architecture:** The project already has `QueryClient` + `QueryClientProvider` in `app/providers.tsx` (used by wagmi). We add `useQuery` / `useMutation` / `useQueryClient` imports from `@tanstack/react-query` in our own hooks — no new dependencies or provider changes needed.

**Tech Stack:** `@tanstack/react-query` (already installed via wagmi), React 19, Next.js 16

**Scope exclusions (per user):** `auth-provider.tsx`, on-chain hooks (wagmi), server-side/utility fetching.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `hooks/useConversations.ts` | Expand | Conversations list query + save/delete mutations (currently only exports `ConversationSummary` type) |
| `components/shell/AppShell.tsx` | Modify | Replace ~70 lines of manual fetch/state with `useConversations()` call |
| `components/shell/AppContext.tsx` | No change | Interface shape stays identical — consumers unaffected |
| `hooks/useConversationLoader.ts` | Rewrite | Replace manual fetch + AbortController with `useQuery` |
| `hooks/useFeedInsights.ts` | Rewrite | Replace manual fetch + cancelled flag with `useQuery` |
| `app/(app)/[[...path]]/page.tsx` | No change | Consumes same hook interfaces — no updates needed |

---

## Query Key Convention

All keys use a `const` array pattern for consistency with wagmi's existing keys:

| Query | Key |
|-------|-----|
| Conversations list | `['conversations']` |
| Single conversation | `['conversation', conversationId]` |
| Feed insights | `['feed', address]` |

---

## Task 1: Conversations list, save, and delete

### What changes

**`hooks/useConversations.ts`** — expand from type-only file to a full hook.

The hook calls `useAuth()` internally and returns the same shape that `AppShell` currently provides through context: `{ conversations, isConversationsLoading, refreshConversations, saveConversation, deleteConversation }`.

**`components/shell/AppShell.tsx`** — delete lines 21–93 (manual state, `refreshConversations`, `saveConversation`, `deleteConversation`, the `useEffect` that syncs auth→fetch). Replace with a single `useConversations()` call that returns the same five values.

### Files

- Modify: `hooks/useConversations.ts`
- Modify: `components/shell/AppShell.tsx`

### Steps

- [ ] **Step 1: Expand `hooks/useConversations.ts`**

Keep the existing `ConversationSummary` export. Add:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { UIMessage } from "ai";
import { useAuth } from "@/lib/auth-provider";
```

**Query — conversations list:**

```ts
const queryClient = useQueryClient();
const auth = useAuth();

const { data: conversations = [], isLoading: isConversationsLoading } = useQuery({
  queryKey: ["conversations"],
  queryFn: async ({ signal }) => {
    const res = await fetch("/api/conversations", { signal });
    if (res.status === 401) {
      auth.handleSessionExpired();
      return [];
    }
    if (!res.ok) throw new Error("Failed to fetch conversations");
    return res.json() as Promise<ConversationSummary[]>;
  },
  enabled: auth.isAuthenticated,
});
```

Key behaviors:
- `enabled: auth.isAuthenticated` — no fetch when logged out (replaces the `if (!auth.isAuthenticated)` guard + the `useEffect` that clears on auth loss)
- TanStack Query passes `signal` to `queryFn` — automatic abort on unmount/key change
- 401 → calls `auth.handleSessionExpired()`, returns empty array (matches current behavior)
- When `enabled` flips to `false`, TanStack Query returns `data` as undefined → we default to `[]`

**Mutation — save conversation:**

```ts
const saveMutation = useMutation({
  mutationFn: async (messages: UIMessage[]) => {
    const res = await fetch("/api/conversations/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) throw new Error("Failed to save");
    const data = await res.json();
    return data.conversationId as string;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  },
});
```

Wrapper to preserve the `(msgs) => Promise<string | null>` interface:

```ts
const saveConversation = useCallback(
  async (messages: UIMessage[]): Promise<string | null> => {
    if (!auth.isAuthenticated || messages.length === 0) return null;
    try {
      return await saveMutation.mutateAsync(messages);
    } catch {
      return null;
    }
  },
  [auth.isAuthenticated, saveMutation]
);
```

**Mutation — delete conversation (optimistic):**

```ts
const deleteMutation = useMutation({
  mutationFn: async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete");
    return id;
  },
  onMutate: async (id) => {
    await queryClient.cancelQueries({ queryKey: ["conversations"] });
    const prev = queryClient.getQueryData<ConversationSummary[]>(["conversations"]);
    queryClient.setQueryData<ConversationSummary[]>(
      ["conversations"],
      (old) => old?.filter((c) => c.id !== id) ?? []
    );
    return { prev };
  },
  onError: (_err, _id, context) => {
    if (context?.prev) {
      queryClient.setQueryData(["conversations"], context.prev);
    }
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  },
});
```

Wrapper:

```ts
const deleteConversation = useCallback(
  (id: string) => {
    if (!auth.isAuthenticated) return;
    deleteMutation.mutate(id);
  },
  [auth.isAuthenticated, deleteMutation]
);
```

**Refresh:**

```ts
const refreshConversations = useCallback(() => {
  queryClient.invalidateQueries({ queryKey: ["conversations"] });
}, [queryClient]);
```

**Hook return:**

```ts
return {
  conversations,
  isConversationsLoading,
  refreshConversations,
  saveConversation,
  deleteConversation,
};
```

- [ ] **Step 2: Update `AppShell.tsx`**

Remove:
- `useState` for `conversations` and `isConversationsLoading` (lines 23-24)
- `refreshConversations` callback (lines 26-46)
- `useEffect` for auth→fetch sync (lines 49-55)
- `saveConversation` callback (lines 57-77)
- `deleteConversation` callback (lines 79-93)

Add:
```ts
import { useConversations } from "@/hooks/useConversations";
```

Replace deleted code with:
```ts
const {
  conversations,
  isConversationsLoading,
  refreshConversations,
  saveConversation,
  deleteConversation,
} = useConversations();
```

The `ctx` useMemo and AppContext.Provider stay unchanged — same shape, same values.

- [ ] **Step 3: Verify**

Run: `npm run build` — confirm no type errors.
Manual check: open app, verify conversations load in LeftRail, create a new chat (should appear in list), delete a conversation (optimistic removal + revalidation).

- [ ] **Step 4: Commit**

```bash
git add hooks/useConversations.ts components/shell/AppShell.tsx
git commit -m "refactor: migrate conversations to TanStack Query (useQuery + useMutation)"
```

---

## Task 2: Conversation loader

### What changes

**`hooks/useConversationLoader.ts`** — replace the entire implementation with `useQuery`. The interface stays the same: `{ messages, executionStates, isLoading, error }`.

### Files

- Modify: `hooks/useConversationLoader.ts`

### Steps

- [ ] **Step 1: Rewrite `useConversationLoader.ts`**

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import type { ExecutionRecord } from "@/components/chat/ExecutionStateContext";

interface ConversationData {
  messages: UIMessage[];
  executionStates: Record<string, ExecutionRecord>;
}

interface ConversationLoaderResult {
  messages: UIMessage[];
  executionStates: Record<string, ExecutionRecord>;
  isLoading: boolean;
  error: string | null;
}

export function useConversationLoader(
  conversationId: string | null
): ConversationLoaderResult {
  const { data, isLoading, error } = useQuery<ConversationData>({
    queryKey: ["conversation", conversationId],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/conversations/${conversationId}`, { signal });
      if (res.status === 401) {
        throw new Error("Session expired. Please reconnect your wallet.");
      }
      if (!res.ok) {
        throw new Error("Failed to load conversation");
      }
      const raw = await res.json();
      return {
        messages: raw.messages.map((m: { id: string; role: string; parts: unknown[] }) => ({
          id: m.id,
          role: m.role,
          parts: m.parts,
        })),
        executionStates: raw.executionStates ?? {},
      };
    },
    enabled: !!conversationId,
    staleTime: Infinity,   // conversation content doesn't go stale while viewing
    retry: false,          // match current behavior: no retries on 401/error
  });

  return {
    messages: data?.messages ?? [],
    executionStates: data?.executionStates ?? {},
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
```

Key behaviors preserved:
- `enabled: !!conversationId` — when `null`, returns empty arrays (matches the early-return guard)
- TanStack Query's built-in `AbortController` replaces our manual one — abort on key change or unmount
- `staleTime: Infinity` — conversation data is immutable while viewing; no background refetches
- `retry: false` — matches current behavior (no retry on 401 or load failure)
- Error message format matches current strings exactly ("Session expired...", "Failed to load...")

What's removed:
- 4 separate `useState` calls
- Manual `AbortController` creation + cleanup
- `.then` chain with manual `setIsLoading(false)` in `finally`
- `AbortError` filtering (TanStack Query handles this internally)

- [ ] **Step 2: Verify**

Run: `npm run build` — confirm no type errors.
Manual check: navigate to `/c/[id]` — conversation loads. Navigate rapidly between conversations — no stale data flash (TanStack Query deduplicates and aborts correctly).

- [ ] **Step 3: Commit**

```bash
git add hooks/useConversationLoader.ts
git commit -m "refactor: migrate useConversationLoader to TanStack Query"
```

---

## Task 3: Feed insights

### What changes

**`hooks/useFeedInsights.ts`** — replace manual fetch + cancelled flag with `useQuery`. The interface stays the same: `{ insights, isLoading, error }`.

### Design note — query key and staleness

The feed API endpoint (`/api/feed`) has a **2-minute server-side cache** keyed by wallet address (Supabase `feed_cache` table). Sending updated portfolio data within that window returns the same cached result. Therefore:

- **Query key:** `['feed', portfolio.address]` — simple, matches server cache key
- **staleTime:** `120_000` (2 minutes) — matches server cache TTL
- **No need to include portfolio fields in the key** — the server ignores new data within the cache window anyway

This is actually *better* than the current code, which re-fires a fetch on every portfolio field change (wasting requests that return cached results).

### Files

- Modify: `hooks/useFeedInsights.ts`

### Steps

- [ ] **Step 1: Rewrite `useFeedInsights.ts`**

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { FeedInsight } from "@/lib/feed/types";
import type { Portfolio } from "@/hooks/usePortfolio";
import type { InfinityPoolInfo } from "@/hooks/useInfinityPoolData";
import {
  serializePortfolio,
  serializeInfinityPools,
} from "@/lib/ai/serializers";
import { useTokenRegistry } from "@/hooks/useTokenRegistry";

export function useFeedInsights(portfolio: Portfolio, pools: InfinityPoolInfo[]) {
  const { getTokenSymbol, tokenMap } = useTokenRegistry();

  const getTokenDecimals = useCallback(
    (address: string): number =>
      tokenMap.get(address.toLowerCase())?.decimals ?? 18,
    [tokenMap]
  );

  const enabled =
    portfolio.isConnected &&
    !!portfolio.address &&
    !portfolio.isLoading;

  const { data: insights = [], isLoading, error } = useQuery<FeedInsight[]>({
    queryKey: ["feed", portfolio.address],
    queryFn: async ({ signal }) => {
      const serialized = serializePortfolio(
        portfolio.address!,
        portfolio.balances,
        portfolio.lpPositions,
        portfolio.farmPositions,
        portfolio.farmGlobals,
        portfolio.stakingPositions,
        getTokenSymbol,
        getTokenDecimals
      );

      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolio: serialized,
          infinityPools: serializeInfinityPools(pools),
        }),
        signal,
      });
      if (!res.ok) throw new Error("Feed API error");
      return res.json() as Promise<FeedInsight[]>;
    },
    enabled,
    staleTime: 120_000,  // match 2-minute server cache TTL
    retry: false,
  });

  return {
    insights,
    isLoading: enabled && isLoading,
    error: error ? "Failed to load insights" : null,
  };
}
```

Key behaviors:
- `enabled` prevents fetch when wallet not connected or portfolio still loading (replaces the early-return guard)
- `staleTime: 120_000` — aligns with server-side 2-minute cache; prevents wasted refetches
- TanStack Query's `signal` replaces the manual `cancelled` flag
- `isLoading: enabled && isLoading` — when disabled, `isLoading` is `true` by default in TanStack Query (no data yet); we report `false` to match current behavior where disconnected users don't see a spinner
- Error string matches current behavior

What's removed:
- 3 `useState` calls
- `cancelled` flag + cleanup function
- Manual `.then/.catch/.finally` chain

- [ ] **Step 2: Verify**

Run: `npm run build` — confirm no type errors.
Manual check: connect wallet, verify feed insights appear on `/`. Disconnect wallet — insights clear, no spinner. Reconnect — insights reload.

- [ ] **Step 3: Commit**

```bash
git add hooks/useFeedInsights.ts
git commit -m "refactor: migrate useFeedInsights to TanStack Query"
```

---

## Post-migration state

After all three tasks, the only remaining manual `useEffect` + `fetch` patterns are:

| File | Reason left alone |
|------|-------------------|
| `lib/auth-provider.tsx` | Handling separately (per user) |
| `hooks/useExecutionPersistence.ts` | Fire-and-forget writes — not a query pattern |
| `app/(app)/[[...path]]/page.tsx` lines 112-119 | Inline fire-and-forget conversation update — not a query |

No new dependencies added. No provider changes. No consumer interface changes.
