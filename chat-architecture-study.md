# Chat Architecture Study

> **Purpose**: Collect and study reference implementations before designing our fix.
> Do NOT build anything from this document. It is research material only.

---

## The Problem

Our chat remounts after the AI finishes responding in a new conversation. Root cause: we save client-side after streaming ends, then `router.replace` to `/c/{id}`, which triggers a Next.js navigation and remounts the component. We've tried band-aids (refs, `history.replaceState`) but the architecture is fundamentally wrong — persistence happens too late, in the wrong place.

---

## Reference 1: Vercel AI Chatbot

**Source**: https://github.com/vercel/ai-chatbot
**Files studied**: `app/(chat)/page.tsx`, `app/(chat)/chat/[id]/page.tsx`, `components/chat.tsx`, `app/(chat)/api/chat/route.ts`, `components/data-stream-handler.tsx`

### How it works

**ID generation**: Server component generates UUID before render, passes to `<Chat id={id} key={id}>` as a prop. The ID exists before the user types anything.

**Routing**:
- `/` renders a server component → generates fresh UUID → `<Chat id={id} initialMessages={[]} />`
- `/chat/[id]` renders a server component → loads chat + messages from DB → `<Chat id={id} initialMessages={uiMessages} autoResume={true} />`
- On first message submit, `multimodal-input.tsx` calls `window.history.pushState({}, "", '/chat/${id}')` — URL updates to `/chat/{id}` without Next.js navigation. `chat.tsx` has a `popstate` listener that calls `router.refresh()` on back/forward to re-sync server data.

**Client sends only the latest message** (not full history):
```ts
// in Chat component's transport config
prepareSendMessagesRequest(request) {
  const lastMessage = request.messages.at(-1);
  return {
    body: {
      id: request.id,
      message: lastMessage,          // single message
      selectedChatModel: ...,
      selectedVisibilityType: ...,
    },
  };
}
```

**Server-side persistence** (all in `/api/chat`):
1. If chat record doesn't exist → `saveChat({ id, userId, title: "New chat" })` + kick off async title generation
2. Save user message to DB immediately, before streaming starts
3. Load all previous messages from DB → combine with new message → pass full history to `streamText()`
4. `onFinish`: save assistant message(s) to DB
5. When async title completes → `dataStream.write({ type: "data-chat-title", data: title })` + update DB

**Chat component has zero persistence logic**: no save callbacks, no `beforeunload`, no redirect. `onFinish` just mutates SWR cache so the sidebar refreshes.

**Sidebar updates**: `DataStreamHandler` component listens for `data-chat-title` stream events → mutates SWR cache → sidebar shows new conversation with title.

### Key design decisions

| Decision | What they chose | Why |
|---|---|---|
| ID timing | Before render (server-side) | Stable identity from the start, no async creation |
| Who persists | Server (API route) | Client never saves; no race conditions |
| What client sends | Latest message only | Server loads history from DB; less bandwidth, no stale state |
| URL for new chats | `history.pushState` on first submit (URL becomes `/chat/{id}`) | No Next.js navigation = no remount. Back button works via `popstate` + `router.refresh()` |
| Message storage | Individual appends with stable IDs | No delete+insert; no data loss on concurrent saves |
| Sidebar refresh | Data stream events + SWR mutation | Real-time title update without polling |

---

## Reference 2: Vercel AI SDK Persistence DB Example

**Source**: https://github.com/vercel-labs/ai-sdk-persistence-db
**Stack**: Next.js App Router, AI SDK v5 beta, Postgres + Drizzle ORM, TypeScript
**Files studied**: `lib/db/schema.ts`, `lib/db/actions.ts`, `lib/utils/message-mapping.ts`, `app/page.tsx`, `app/chat/[id]/page.tsx`, `app/chat/[id]/chat.tsx`, `app/api/chat/route.ts`

### How it works

**ID generation**: Before render, via a server action that inserts a DB row and redirects. User clicks "Create New Chat" → server action runs → inserts `chats` row → `redirect(/chat/{id})`. The ID and the DB record both exist before the Chat component renders.

```ts
// app/page.tsx — server action
async function createNewChat() {
  "use server";
  const id = await createChat(); // INSERT into chats, returns id
  redirect(`/chat/${id}`);
}
```

**Routing**: No catch-all. Two explicit routes:
- `/` — home page listing all chats + "Create New Chat" button
- `/chat/[id]` — server component loads messages, passes to client `<Chat>` component

**Client sends only the last message + chatId**:
```ts
// app/chat/[id]/chat.tsx
transport: new DefaultChatTransport({
  api: "/api/chat",
  prepareSendMessagesRequest: ({ messages }) => {
    const lastMessage = messages[messages.length - 1];
    return {
      body: {
        message: lastMessage,
        chatId: id,
      },
    };
  },
}),
```

**Server-side persistence** (all in `/api/chat`):
```ts
export async function POST(req: Request) {
  const { message, chatId } = await req.json();

  // 1. Save user message BEFORE streaming
  await upsertMessage({ chatId, id: message.id, message });

  // 2. Load full history from DB
  const messages = await loadChat(chatId);

  // 3. Stream
  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: ({ writer }) => {
      writer.write({ type: "start", messageId: generateId() });
      writer.write({ type: "start-step" });
      const result = streamText({ ... });
      writer.merge(result.toUIMessageStream({ sendStart: false }));
    },
    // 4. Save assistant message after stream completes
    onFinish: async ({ responseMessage }) => {
      await upsertMessage({ id: responseMessage.id, chatId, message: responseMessage });
    },
  });
  return createUIMessageStreamResponse({ stream });
}
```

**Message storage — 3-table schema with normalized parts**:
```
chats:    id (varchar, PK, generated via generateId())
messages: id (varchar, PK), chatId (FK), role, createdAt
parts:    id (varchar, PK), messageId (FK), type, order, + type-specific columns
```

`upsertMessage` uses a transaction: upsert the message row, then delete all parts for that message and re-insert current parts. Message IDs are stable; parts are bulk-replaced per message.

**URL management**: None needed. URL is `/chat/{id}` from creation via server redirect. No `router.push`, no `history.replaceState` in the chat component.

**Sidebar/chat list**: No sidebar. Home page uses `export const dynamic = 'force-dynamic'` and re-queries DB on every visit.

**Streaming failure**: User message already saved before streaming. Assistant message only saved in `onFinish`. No beacon fallback, no retry.

### Key design decisions

| Decision | What they chose | Why |
|---|---|---|
| ID timing | Before render (server action + redirect) | DB record exists before any message |
| Who persists | Server (API route) | Zero client persistence logic |
| What client sends | Last message + chatId | Server loads full history from DB |
| URL for new chats | `/chat/{id}` from the start | Server action creates + redirects |
| Message storage | Individual rows, stable IDs, parts in separate table | Normalized schema, upsert-safe |
| Streaming failure | User message safe, assistant lost | Acceptable tradeoff — no beacon needed |

### Notable pattern: Manual stream start events

The server manually writes `start` + `start-step` events with a server-generated message ID for the assistant response, then merges the LLM stream with `sendStart: false`. This gives the server control over assistant message ID assignment.

---

## Reference 3: chunlea/vercel-ai-chatbot (Advanced Template)

**Source**: https://github.com/chunlea/vercel-ai-chatbot
**Stack**: Next.js App Router, AI SDK (streaming, multi-provider), NextAuth.js, Vercel Postgres
**Files studied**: `app/(chat)/page.tsx`, `app/(chat)/chat/[id]/page.tsx`, `components/chat.tsx`, `components/multimodal-input.tsx`, `app/(chat)/api/chat/route.ts`, `lib/db/schema.ts`, `lib/db/queries.ts`

### How it works

**ID generation**: Server component generates UUID at render time, passes as prop. DB record is NOT created until first message (lazy creation in API route).

```ts
// app/(chat)/page.tsx
export default async function Page() {
  const id = generateUUID();
  return <Chat key={id} id={id} initialMessages={[]} />;
}
```

**Client sends full message history** (unlike the Vercel chatbot and persistence-db example):
```ts
// components/chat.tsx
useChat({
  id,
  body: { id, selectedChatModel },
  initialMessages,
  sendExtraMessageFields: true,
  generateId: generateUUID,
  onFinish: () => { mutate('/api/history'); },
});
```
The server extracts only the most recent user message for saving:
```ts
const userMessage = getMostRecentUserMessage(messages);
```

**URL update via `history.replaceState`** — called on first message submit, NOT on response finish:
```ts
// components/multimodal-input.tsx
const submitForm = useCallback(() => {
  window.history.replaceState({}, '', `/chat/${chatId}`);
  handleSubmit(undefined, { experimental_attachments: attachments });
  // ...
}, [chatId, handleSubmit, attachments]);
```
This updates the URL bar immediately when the user sends their first message. No Next.js navigation occurs — the same React tree stays mounted. `replaceState` means the browser back button won't go back to `/`.

**Server-side persistence** (in `/api/chat`):
```ts
// Lazy chat creation — only on first message
const chat = await getChatById({ id });
if (!chat) {
  const title = await generateTitleFromUserMessage({ message: userMessage });
  await saveChat({ id, userId: session.user.id, title });
}

// Save user message BEFORE streaming
await saveMessages({
  messages: [{ ...userMessage, createdAt: new Date(), chatId: id }],
});

// Stream, then save assistant messages in onFinish
```

**Message storage**: Individual rows with stable IDs, `json` content column. Simple `INSERT` — no upsert, no delete+reinsert.

**Sidebar updates**: SWR cache invalidation via `mutate('/api/history')` in `useChat.onFinish` + pathname-based `useEffect` revalidation in the sidebar component.

**Auth**: NextAuth.js credentials provider, JWT sessions. Middleware-based route protection. API routes check `auth()` individually.

### Key design decisions

| Decision | What they chose | Why |
|---|---|---|
| ID timing | Before render (server-side UUID) | Stable identity, but DB record deferred |
| Who persists | Server (API route) | Client has zero save logic |
| What client sends | Full history (extracts latest server-side) | Simpler client code, slightly more bandwidth |
| URL for new chats | `history.replaceState` on first message send | Immediate URL update, no navigation/remount |
| Message storage | Individual inserts, `json` content column | Simple append-only model |
| Sidebar refresh | SWR `mutate('/api/history')` on `onFinish` | Good enough latency for sidebar appearance |

### Notable pattern: Title generation via separate LLM call

On first message, the API route calls `generateTitleFromUserMessage()` which uses a separate `generateText()` call with a small model to produce a title. This runs before streaming starts, so the title is available immediately.

---

## Reference 4: RainbowKit + SIWE + NextAuth (Web3 Auth)

**Source**: https://github.com/vincanger/rainbowkit-siew-nextauth-custom
**Stack**: Next.js (Pages Router), RainbowKit 0.5.x, wagmi 0.6.x, SIWE, NextAuth, JWT sessions
**Files studied**: `pages/api/auth/[...nextauth].ts`, `components/auth-adapter.tsx`, `pages/_app.tsx`, `middleware.ts`, all protected page variants

### How it works

**SIWE flow via RainbowKit custom auth adapter**:
1. User clicks "Connect Wallet" in RainbowKit modal
2. `getNonce()` calls `getCsrfToken()` — reuses NextAuth's CSRF token as the SIWE nonce
3. `createMessage()` constructs a `SiweMessage` with domain, address, chainId, nonce
4. RainbowKit prompts the wallet to sign
5. `verify()` calls `signIn('credentials', { message, signature })` — POSTs to NextAuth
6. NextAuth's `CredentialsProvider.authorize()` validates:
   - Domain matches `NEXTAUTH_URL` host
   - Nonce matches CSRF token
   - Signature is valid via `siwe.validate()`
7. On success, returns `{ id: siwe.address }` → NextAuth creates encrypted JWT cookie

**Session management**: JWT strategy, encrypted httpOnly cookie. No database sessions.

**Session restoration on refresh** — three layers:
1. **wagmi `autoConnect: true`**: Restores wallet connection from localStorage
2. **NextAuth `SessionProvider`**: Fetches `/api/auth/session` on mount → decodes JWT cookie → returns session
3. **RainbowKit `RainbowKitAuthenticationProvider`**: Reads `useSession().status` → shows correct UI

**Disconnect**: Must call both `disconnect()` (wagmi) AND `signOut()` (NextAuth). Missing either leaves stale state.

**Server-side auth checking** — four approaches shown:
- `getToken({ req })` — raw JWT payload, `token.sub` = wallet address
- `getServerSession(req, res, authOptions)` — enriched session with callbacks applied
- `withAuth` middleware — route-level protection before page renders
- `getServerSideProps` with `getSession()` — SSR-time auth check

### Key design decisions

| Decision | What they chose | Why |
|---|---|---|
| Nonce strategy | Reuse NextAuth CSRF token | No custom nonce endpoint needed |
| Session storage | JWT (no DB) | Stateless, fast verification |
| Session restoration | wagmi autoConnect + NextAuth cookie + RainbowKit status bridge | Three-layer restoration without user interaction |
| Disconnect | Explicit dual teardown (wagmi + NextAuth) | Prevents stale wallet or session state |

### Relevance to us

Our current SIWE implementation is custom (no NextAuth). We use:
- Custom nonce endpoint (`/api/auth/nonce`) with atomic deletion in Supabase — **more secure** than CSRF token reuse
- Custom JWT via `jose` library with httpOnly cookie — similar to NextAuth JWT strategy
- Manual session restoration via `/api/auth/me` endpoint — similar concept to NextAuth `SessionProvider`
- No `autoConnect` equivalent for wagmi (we use `cookieStorage` + `cookieToInitialState` instead)

The main takeaway is the **three-layer restoration pattern** and the importance of **dual disconnect** (wallet + session). Our current implementation handles both, but the provider nesting order matters.

---

## Reference 5: TanStack Query + Next.js 14/15 Patterns

**Source**: https://github.com/nirajrajgor/tanstack-query-with-nextjs14
**Stack**: Next.js 15 (App Router), React 19, TanStack Query 5, TypeScript
**Files studied**: `app/QueryProvider.tsx`, `app/layout.tsx`, `app/posts/page.tsx`, `app/posts/PostsClient.tsx`, `app/comments/page.tsx`, `app/comments/CommentsClient.tsx`

### Two patterns demonstrated

#### Pattern A: `initialData` (simpler, more limited)

Server component fetches data, passes as prop:
```ts
// Server component
export default async function PostsPage() {
  const posts = await fetchPost();
  return <PostsClientPage initialData={posts} />;
}

// Client component
const { data: posts } = useQuery({
  queryKey: ["posts"],
  queryFn: fetchPost,
  initialData: props.initialData,
});
```

**Tradeoffs**: Simpler code, but data only available to the component that receives the prop. Deeply nested children can't access it without prop drilling.

#### Pattern B: `prefetchQuery` + `HydrationBoundary` (recommended)

Server component prefetches into a temporary QueryClient, dehydrates it, client rehydrates:
```ts
// Server component
export default async function CommentsPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["comments"],
    queryFn: fetchComments,
  });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CommentsClientPage />
    </HydrationBoundary>
  );
}

// Client component — no props needed, data is in the cache
const { data: comments } = useQuery({
  queryKey: ["comments"],
  queryFn: fetchComments,
});
```

**Tradeoffs**: More boilerplate, but data ends up in the global query cache — any child component can `useQuery` with the same key without prop drilling. This is the **officially recommended** TanStack Query pattern.

### QueryClient setup — critical SSR details

```ts
// app/QueryProvider.tsx
let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (isServer) {
    return makeQueryClient(); // Always new on server (prevents cross-request leaks)
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient; // Singleton on browser
  }
}
```

**Key details**:
- Server: always new client per request (prevents data leaking between users)
- Browser: module-level singleton, NOT `useState` — avoids React discarding the client during Suspense
- `staleTime: 6000` (6 seconds) globally — prevents immediate refetch after SSR hydration (without this, server-fetched data is considered stale instantly and refetched on mount)

### Relevance to us

We already use TanStack Query for conversations, feed, and portfolio. Key checks against our implementation:
- **Do we use `staleTime`?** — Need to verify. Without it, SSR data refetches immediately on mount.
- **QueryClient creation** — Need to verify we're using the module-level singleton pattern, not `useState`.
- **Hydration** — We could use `HydrationBoundary` for conversation data loaded in server components, avoiding the loading flash when navigating to `/c/[id]`.

---

## Our Current Architecture (for comparison)

**Files**: `app/(app)/[[...path]]/page.tsx`, `components/chat/ChatContainer.tsx`, `app/api/chat/route.ts`, `app/api/conversations/save/route.ts`

### How it works now

**ID generation**: Server generates ID inside `/api/conversations/save` after the AI finishes its first response. The chat has no ID during streaming.

**Routing**: Catch-all `[[...path]]` handles both `/` and `/c/[id]`. Client component extracts `conversationId` from params.

**Client sends full message history** every request via the transport body.

**Client-side persistence**:
1. `useChat` `onFinish` fires → calls `onConversationSaved(allMessages)`
2. Page component POSTs to `/api/conversations/save` → server creates conversation + bulk inserts all messages
3. Server returns new ID → page sets `savedId` state → effect fires `router.replace(/c/{id})`
4. URL change triggers params change → `conversationId` effect fires → `justSavedIdRef` guard prevents key change → ChatContainer stays mounted (in theory)

**Message storage**: Delete all messages for conversation, then insert all current messages. Last-writer-wins.

**Fallback**: `beforeunload` sends `navigator.sendBeacon` if the user closes the tab before `onFinish`.

### Where it breaks

The `justSavedIdRef` guard is fragile. `router.replace` is a real Next.js navigation that re-renders the page with new params. We're relying on a chain of refs and effects firing in the right order to prevent remount. Any change to React's effect ordering, a concurrent mode edge case, or a re-render from an unrelated state update can break the guard.

---

## Cross-Reference Comparison

| Dimension | Vercel Chatbot | AI SDK Persistence DB | chunlea/chatbot | Our App |
|---|---|---|---|---|
| **ID timing** | Before render (RSC) | Before render (server action + DB insert + redirect) | Before render (RSC), DB deferred | After first AI response |
| **Who persists** | Server (`/api/chat`) | Server (`/api/chat`) | Server (`/api/chat`) | Client (`onFinish` callback) |
| **What client sends** | Last message only | Last message + chatId | Full history | Full history |
| **URL for new chats** | `history.pushState` on first submit | `/chat/{id}` from creation | `history.replaceState` on send | `router.replace` after save |
| **Sidebar update** | Data stream events + SWR mutation | No sidebar (re-query on home visit) | SWR `mutate` on `onFinish` | TanStack Query invalidation |
| **Message storage** | Individual appends, stable IDs | Individual upserts, normalized parts table | Individual inserts, JSON content | Bulk delete+insert |
| **Stream failure** | User msg saved, assistant lost | User msg saved, assistant lost | User msg saved, assistant lost | Nothing saved, beacon fallback |

### Consensus patterns (every reference agrees)

1. **Generate the conversation ID before the first message** — not after the AI responds
2. **Persist messages server-side in the API route** — not via client callbacks
3. **Save the user message before streaming starts** — so it survives stream failures
4. **Save the assistant message in `onFinish`** — after complete response only
5. **The chat component should have zero persistence logic** — no save callbacks, no beacons, no redirects
6. **Avoid `router.push`/`router.replace` for the save transition** — use `history.replaceState` or no URL change at all

---

## Additional Findings (from ChatGPT deep research report)

Source: `docs/deep-research-report.md`

### Correction: `pushState` vs `replaceState`

**Verified**: The actual Vercel chatbot (`vercel/ai-chatbot`) uses `window.history.pushState` in `components/multimodal-input.tsx`, NOT `replaceState`. The chunlea fork uses `replaceState`.

This is a meaningful UX difference:
- **`pushState`** (Vercel chatbot): Back button goes to `/` (previous page). User can navigate back to the "new chat" starting point.
- **`replaceState`** (chunlea fork): Back button skips `/`, goes to whatever was before. User can't go "back" to the pre-chat state.

The Vercel chatbot also handles the back/forward case: in `components/chat.tsx`, a `popstate` listener calls `router.refresh()` to re-sync server-rendered data with the URL. This is the **"missing half"** of the History API approach — without it, hitting back would show stale React state for a URL that no longer matches.

### Supabase community fork (`supabase-community/vercel-ai-chatbot`)

**Source**: https://github.com/supabase-community/vercel-ai-chatbot (≈797 stars)

This is an **older fork** of the Vercel chatbot, using legacy AI SDK patterns (`OpenAIStream`, `StreamingTextResponse`). Less architecturally relevant for streaming/persistence patterns, but useful for:

- **Supabase auth in route handlers**: Uses `createRouteHandlerClient` + `supabase.auth.getSession()` from cookies. Simple pattern: create client with cookie store → check session → reject if no user.
- **Simplified persistence**: Stores entire chat as a single JSON blob via `supabase.from('chats').upsert({ id, payload })` in the `onCompletion` callback. All messages in one column — simpler but doesn't scale for message-level operations (delete, edit, search).
- **ID handling**: Uses `json.id ?? nanoid()` — client can send an ID, server falls back to generating one.

### Centralized error handling pattern (`ChatbotError`)

The Vercel chatbot defines a typed error class in `lib/errors.ts`:
- Single `ChatbotError` class that assigns HTTP status codes by error type
- Has a `.toResponse()` method that serializes to a proper JSON `Response`
- Used consistently across all API routes
- Client-side: `fetchWithErrorHandlers` wrapper in `lib/utils.ts` checks browser offline state, parses error responses, and throws typed errors
- Used as the `fetch` option in `DefaultChatTransport`

Relevant for us: we currently have ad-hoc error handling in each API route. A centralized error class + fetch wrapper would reduce duplication.

### Additional architecture references (not deeply studied)

From ChatGPT's report, potentially useful for future reference:

- **`HungFPTU/fe-sep490-pacsfr`**: Layered architecture (`API → Service → Hooks → Components → Pages`) with Zustand + TanStack Query. Feature-module folder structure.
- **`langchain-ai/agent-chat-ui`** (≈2.6k stars): Production chat UI for LangGraph. API proxy pattern where secrets are injected server-side. Artifact side panels.
- **`spruceid/siwe-next-auth-example`** (≈148 stars): Canonical SIWE verification reference. Auto-login pattern: if wallet is connected but no session, trigger SIWE login automatically.
- **`Dylan-Kentish/siwe-next-auth`**: App Router route handlers for SIWE (`app/api/auth/[...nextauth]/route.ts`). Associates SIWE identity with a database user.
- **RainbowKit monorepo** (`rainbow-me/rainbowkit`): Official examples in `examples/with-next-siwe-next-auth` and `examples/with-next-siwe-iron-session`.

---

## File-Level Comparison: Reference vs Our Implementation

### What the references use (entire chat plumbing)

Every reference implementation handles the full chat flow with roughly **6 core files**:

| # | File | Role | Complexity |
|---|---|---|---|
| 1 | `app/(chat)/page.tsx` | Server component. Generate UUID, render `<Chat id={id}>`. | ~30 lines |
| 2 | `app/(chat)/chat/[id]/page.tsx` | Server component. Load from DB, render `<Chat id={id} initialMessages={...}>`. | ~40 lines |
| 3 | `components/chat.tsx` | Client component. `useChat` + rendering. **Zero persistence logic.** | ~150 lines |
| 4 | `components/multimodal-input.tsx` | Input box. `history.pushState` on first submit. | ~80 lines |
| 5 | `app/(chat)/api/chat/route.ts` | Stream + persist. Create conversation on first msg. Save user msg before stream. Save assistant msg in onFinish. | ~150 lines |
| 6 | `lib/db/queries.ts` | DB CRUD functions (saveChat, saveMessages, getChatById, getMessagesByChatId). | ~100 lines |

**Total: ~550 lines. Clean separation. No refs, no guards, no effects chains.**

The Chat component has no save callbacks, no beforeunload, no redirect logic. The page components are trivially simple server components. All persistence lives in one API route. The DB module is pure functions with no hooks or state.

### What we currently have (same job)

| # | File | Lines | Role | Problem |
|---|---|---|---|---|
| 1 | `app/(app)/[[...path]]/page.tsx` | 252 | Client component. Catch-all router. chatSessionKey. savedId/justSavedIdRef/isInitialMountRef guards. Save handler. Navigation effect. Feed transition. | Rube Goldberg machine of refs and effects |
| 2 | `components/chat/ChatContainer.tsx` | 288 | useChat + bodyStore + onFinish save callback + beforeunload beacon + execution persistence + strategy auto-continue + auth expiry | Does 6 jobs. Should do 1 (rendering). |
| 3 | `app/api/chat/route.ts` | 87 | Streaming only — zero persistence | Missing its main job (persistence) |
| 4 | `app/api/conversations/save/route.ts` | 101 | Create OR update conversation + bulk delete+insert messages | Exists because client saves. Shouldn't exist. |
| 5 | `app/api/conversations/route.ts` | 17 | List conversations | Fine — stays |
| 6 | `app/api/conversations/[id]/route.ts` | 105 | Load + delete conversation | Fine — stays |
| 7 | `app/api/execution-states/route.ts` | 53 | Persist tool execution states | Fine — stays |
| 8 | `hooks/useConversations.ts` | 111 | TanStack Query wrapper: list + save mutation + delete mutation | Save mutation shouldn't exist (server persists) |
| 9 | `hooks/useConversationLoader.ts` | 61 | TanStack Query wrapper: load single conversation | Could be a server component DB call instead |
| 10 | `hooks/useExecutionPersistence.ts` | 90 | In-memory state + pending queue + flush logic | Pending queue only exists because ID arrives late |
| 11 | `hooks/useStrategyAutoContinue.ts` | 106 | Strategy step detection + portfolio refetch wait + auto-send | Stays — unique to us |
| 12 | `components/chat/ExecutionStateContext.tsx` | 23 | Context for tool cards | Stays — fine |

**Total: ~1,300 lines across 12 files. Complex interdependencies. Save flow bounces through 5 files.**

### The save flow: reference vs ours

**Vercel chatbot (2 steps)**:
```
User sends message → POST /api/chat { id, message }
  → server saves user msg, streams, saves assistant msg in onFinish
  → done
```

**Our app (8 steps)**:
```
User sends message → POST /api/chat { messages } (no persistence)
  → stream finishes → onFinish fires in ChatContainer
  → calls onConversationSaved(allMessages) callback
  → page.tsx handleConversationSaved calls useConversations.saveConversation
  → POSTs to /api/conversations/save (creates conversation, bulk inserts all messages)
  → returns ID → page.tsx sets savedId state
  → triggers navigation effect → router.replace(/c/{id})
  → URL changes → conversationId effect fires → justSavedIdRef guard prevents key change
```

### What needs to be redesigned vs kept

**REDESIGN from reference patterns** (the chat plumbing):
- `page.tsx` — replace catch-all client component with two simple server component routes
- `ChatContainer.tsx` — strip out all persistence logic, keep rendering
- `/api/chat/route.ts` — add server-side persistence (the big change)
- `/api/conversations/save/route.ts` — remove or repurpose as lightweight update-only
- `useConversations.ts` — remove save mutation (keep list + delete)
- `useConversationLoader.ts` — may become unnecessary if server components load data
- `useExecutionPersistence.ts` — simplify (remove pending queue, ID always known)

**KEEP as-is** (rendering + domain logic):
- `ChatInput.tsx` — add `history.pushState` on submit
- `MessageList.tsx`, `ChatMessage.tsx`, `MarkdownRenderer.tsx`, `ToolPartRenderer.tsx`
- `QuickActions.tsx`, `WelcomeScreen.tsx`, `CardErrorBoundary.tsx`
- All 19 card components in `components/chat/cards/`
- `useStrategyAutoContinue.ts` — unique to us, stays
- `ExecutionStateContext.tsx` — stays
- `app/api/execution-states/route.ts` — stays
- `app/api/conversations/route.ts` (list) — stays
- `app/api/conversations/[id]/route.ts` (load/delete) — stays
- All auth files, all AI tools, all protocol configs, all hooks not in the list above

---

## Patterns to Watch For (across all references)

As we study more projects, track how each one handles:

1. **When is the conversation ID created?** (before render / on first message / after first response)
2. **Where are messages persisted?** (client-side callback / server-side in API route / both)
3. **What does the client send?** (full history / latest message only / delta)
4. **How does the URL update?** (router.push / router.replace / history.replaceState / no change)
5. **How does the sidebar learn about new conversations?** (cache invalidation / stream events / polling / websocket)
6. **How are messages stored?** (individual rows with stable IDs / bulk replace / event log)
7. **How is streaming failure handled?** (user message already saved / beacon fallback / retry with resume)
