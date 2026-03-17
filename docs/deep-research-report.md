# Open-Source Reference Architectures for a Next.js App Router AI Chat + Web3 Wallet Auth App

## What you’re building and what to benchmark against

You described a Next.js **App Router** application with: streaming AI chat via the **Vercel AI SDK**, **conversation persistence** (save/load/delete) with routes like `/chat/{id}`, a **sidebar chat history**, and **authenticated API routes**. You also want **Web3 wallet authentication** (RainbowKit + wagmi), ideally with **SIWE**, and robust “session restoration” behavior on refresh and clean disconnect handling.

To find strong reference implementations, I prioritized repositories that (a) demonstrably implement the relevant patterns (streaming, persistence, auth), (b) have meaningful adoption signals (stars/forks) and ongoing activity, and (c) expose the architecture clearly (readable code + obvious entrypoints). The best “all-in-one” reference for your AI-chat portion is Vercel’s own chatbot template (19.9k⭐), because it contains a very specific solution to your hardest UI problem: transitioning from `/` → `/chat/{id}` **without remounting the UI** by updating browser history rather than triggering a Next.js route transition. citeturn5view0turn23view0

## AI chat with persistence, streaming, and `/chat/{id}` routing

### Vercel Chatbot

**GitHub repo**
```text
https://github.com/vercel/chatbot
```
**Why it’s worth studying**: This is the highest-signal repo in the set (≈19.9k⭐, 6.4k forks) and explicitly positions itself as a full-featured, hackable **Next.js App Router + AI SDK** chatbot with **data persistence**. citeturn5view0

**Stack (as implemented)**
- Next.js App Router + React Server Components + Suspense citeturn5view0turn10view0turn12view0  
- Vercel AI SDK (“AI SDK”) and `@ai-sdk/react` (`useChat`) with streaming transport to `/api/chat` citeturn17view0turn16view1  
- Postgres persistence (README calls out Neon Serverless Postgres), Drizzle config present, plus DB query layer in `lib/db/*` citeturn5view0turn28view0turn27view0  
- Auth.js (Auth.js is called out in README; server pages use `auth()` for access control) citeturn5view0turn12view0turn9view0  
- Client data cache uses **SWR** (not TanStack Query) for history, votes, etc. citeturn16view1turn17view0  
- Centralized error object (`ChatbotError`) and centralized fetch wrappers (`fetcher`, `fetchWithErrorHandlers`) citeturn30view0turn31view0turn17view0  

**The exact patterns to study**
- **Route-group layout that keeps the sidebar mounted** across `/` and `/chat/[id]`: `app/(chat)/layout.tsx` wraps `children` with `SidebarProvider`, renders `AppSidebar`, and injects the page inside `SidebarInset`. This ensures the sidebar frame doesn’t get re-created as you move between chat routes in the `(chat)` group. citeturn9view0turn8view0  
- **New chat ID is created immediately on `/`** (before any message is sent): `app/(chat)/page.tsx` generates an `id = generateUUID()` and renders `<Chat id={id} ... initialMessages={[]} />`. This is crucial: a chat already has a stable ID even while the URL is still `/`. citeturn10view0  
- **Solving `/` → `/chat/{id}` without remounting UI**: instead of `router.push("/chat/...")`, they update the URL via the History API:
  - On message submit, `components/multimodal-input.tsx` does `window.history.pushState({}, "", \`/chat/${chatId}\`)` and *then* calls `sendMessage(...)`. This changes the visible URL without triggering a Next.js navigation (no React tree remount). citeturn23view0turn23view3  
  - In `components/chat.tsx`, they also attach a `popstate` listener and call `router.refresh()` on back/forward navigation so the server-rendered data stays consistent with the URL. This is the “missing half” of the History API approach. citeturn17view0  
  - They also use `window.history.replaceState` in a URL-query bootstrap path to normalize the location after auto-sending a query. citeturn17view0  
- **Direct-load `/chat/{id}` (hard refresh / deep link) pulls from DB and enforces access**: `app/(chat)/chat/[id]/page.tsx` loads the chat (`getChatById`) and messages (`getMessagesByChatId`), checks session via `auth()`, enforces “private chat belongs to user”, and passes DB-backed `initialMessages` into `<Chat autoResume={true} ...>`. citeturn12view0  
- **Streaming response + persistence in the same request**:
  - The chat route handler uses AI SDK streaming primitives like `createUIMessageStream`, `createUIMessageStreamResponse`, and `streamText`. citeturn27view0  
  - It persists the user message early (`await saveMessages(...)` when role is `"user"`). citeturn27view0  
  - On stream completion, it persists assistant/tool messages via `onFinish`, including a special case for “tool approval flow” where it updates existing messages or inserts new ones. citeturn27view0  
  - It pushes a stream part `data-chat-title` and calls `updateChatTitleById`, and the client reacts by mutating sidebar history. This is a nice example of “streaming UI metadata” for live sidebar updates. citeturn27view0turn20view1  
- **Sidebar history refresh strategy**:
  - In `components/chat.tsx`, `onFinish` calls SWR `mutate(unstable_serialize(getChatHistoryPaginationKey))`. citeturn17view0  
  - In `components/data-stream-handler.tsx`, when a stream delta is `data-chat-title`, it triggers the same SWR mutation pattern. citeturn20view1  

**Where to start in the codebase**
- Routing & UI shell: `app/(chat)/layout.tsx`, `components/app-sidebar.tsx`, `components/sidebar-history.tsx` citeturn9view0turn14view0turn24view0  
- URL transition trick: `components/multimodal-input.tsx` (look for `window.history.pushState`), `components/chat.tsx` (look for `popstate` + `router.refresh`) citeturn23view0turn17view0  
- Server-side chat persistence & streaming: `app/(chat)/api/chat/route.ts`, plus `app/(chat)/api/chat/[id]/stream/*` for resumable streams citeturn25view0turn27view0  
- Error and fetch centralization: `lib/errors.ts`, `lib/utils.ts` (especially `ChatbotError`, `fetchWithErrorHandlers`) citeturn30view0turn31view0  

---

### Supabase community fork of Vercel Chatbot

**GitHub repo**
```text
https://github.com/supabase-community/vercel-ai-chatbot
```

**Why it’s worth studying**: This is a fork of `vercel/chatbot` (≈797⭐) but swaps the auth/persistence story to **Supabase Auth + Supabase Postgres** while keeping the general Next.js AI-chat architecture. If you want to compare “Vercel Postgres/Neon + Auth.js” vs “Supabase Auth + Supabase DB,” this is a practical adaptation. citeturn32view0

**Stack (as stated in the repo)**
- Next.js App Router + RSC/Suspense/Server Actions citeturn32view0  
- Vercel AI SDK for streaming chat UI citeturn32view0  
- Supabase Postgres for chat history and Supabase Auth for authentication citeturn32view0  

**Patterns to study**
- How the fork threads Supabase session/auth across route handlers and server components (compare to Vercel’s `auth()` boundaries in `/chat/[id]`). citeturn32view0turn12view0  
- How it organizes Supabase-specific assets (a `supabase/` directory exists at repo root) alongside the App Router and component structure. citeturn32view0  
- If you’re considering storing chat history *and* user profiles/metadata in Supabase: this fork is a closer conceptual match to that world than the Neon-based original. citeturn32view0  

**Where to start**
- `app/` (routes), `components/` (chat UI), `lib/` (data + utilities), and `supabase/` (Supabase configuration/migrations/scripts). citeturn32view0  

---

### LangChain Agent Chat UI (LangGraph front-end)

**GitHub repo**
```text
https://github.com/langchain-ai/agent-chat-ui
```

**Why it’s worth studying**: This is a larger (≈2.6k⭐) Next.js chat UI that’s not a toy demo; it’s positioned as a real UI for interacting with LangGraph backends, including streaming behaviors and production proxy guidance. While it won’t mirror Vercel AI SDK persistence patterns exactly, it’s an excellent reference for “chat UI as a serious product surface.” citeturn34view0

**Stack (from the repo)**
- Next.js application (repo description) with an emphasis on connecting to a LangGraph server and handling streaming and artifacts. citeturn34view0  

**Patterns to study**
- **Production hardening for chat backends**: the README explicitly describes a production approach via an API proxy/passthrough so secrets (LangSmith API key) are injected server-side instead of being exposed to clients. This is conceptually similar to how you’ll want to guard wallet-authenticated per-user APIs. citeturn34view0  
- **Artifact side panels**: it documents a pattern for rendering “artifacts” in a side panel driven by thread metadata, which is relevant if your AI chat produces structured outputs (code, docs, on-chain transaction drafts, etc.). citeturn34view0  

**Where to start**
- The repo concentrates code under `src/`, so start at `src/` and follow the chat entry route(s) and streaming hook(s). citeturn34view0  

## Web3 wallet auth with server-side sessions and per-user data

A key constraint: truly “production-grade” open-source dapps that combine **RainbowKit + wagmi + SIWE + server-side user DB** (and are also large/high-star) are rarer than AI-chat templates. The best way to learn the auth mechanics is to study (a) RainbowKit’s maintained examples and SIWE integration package, then (b) App Router–style NextAuth+SIWE route handler implementations (even if low-star), because the *mechanics* are what you need to transplant into your app.

### RainbowKit monorepo with Next.js App Router + SIWE examples

**GitHub repo**
```text
https://github.com/rainbow-me/rainbowkit
```

**Why it’s worth studying**: RainbowKit is the canonical wallet connection layer (≈2.8k⭐), and its repo explicitly includes examples for:
- Next.js App Router (`with-next-app`)
- SIWE with NextAuth (`with-next-siwe-next-auth`)
- SIWE with iron-session (`with-next-siwe-iron-session`) citeturn36view0  

Even if you don’t copy these examples verbatim, they reflect the maintainers’ recommended wiring patterns.

**Stack (as stated)**
- RainbowKit built on top of wagmi and viem. citeturn36view0  

**Patterns to study**
- **Provider composition** (wallet connectors + wagmi config + RainbowKitProvider) in the Next.js App Router example (`examples/with-next-app`). citeturn36view0  
- **SIWE session flow variants**:
  - With NextAuth: typically message signing on client, nonce/csrf on server, session cookie + JWT strategy, and server-side authorization checks in API routes. citeturn36view0turn4search6  
  - With iron-session: cookie-based session storage with explicit server session read/write. citeturn36view0  

**Where to start**
- `examples/with-next-app` (App Router baseline wiring) citeturn36view0  
- `examples/with-next-siwe-next-auth` (SIWE + NextAuth reference) citeturn36view0  
- `examples/with-next-siwe-iron-session` (SIWE + cookie-session alternative) citeturn36view0  
- If you need to understand how the SIWE integration package works internally, inspect `packages/` (RainbowKit publishes SIWE-related packages from here). citeturn36view0turn35search6  

---

### Spruce’s SIWE + NextAuth example (canonical SIWE verification flow)

**GitHub repo**
```text
https://github.com/spruceid/siwe-next-auth-example
```

**Why it’s worth studying**: While it’s explicitly an example (≈148⭐), it is widely referenced by NextAuth documentation as *the* SIWE implementation reference, so it’s useful for correctness and interoperability. citeturn4search9turn4search12

**Stack**
- NextAuth with a Credentials provider that verifies a SIWE message signature server-side citeturn4search6  
- wagmi hooks (`useAccount`, `useConnect`, `useSignMessage`) on the clientciteturn4search2  
- SIWE message construction via `siwe` library and nonce via NextAuth CSRF token citeturn4search2turn4search6  

**Patterns to study**
- **Server-side SIWE verification**: In `pages/api/auth/[...nextauth].ts`, it parses the SIWE message, verifies signature + domain, and uses `getCsrfToken({ req })` as the nonce in verification. citeturn4search6  
- **Session restoration on refresh**: It uses NextAuth `useSession()` on the client to know whether a session exists; once a valid cookie/JWT exists, refresh restores session state through NextAuth as usual. citeturn4search2turn4search6  
- **Auto-login upon wallet connection**: The client page uses wagmi `isConnected` and triggers `handleLogin()` if connected and no session exists. This is an explicit “if wallet reconnects, re-auth if needed” pattern. citeturn4search2  

**Where to start**
- Client SIWE flow: `pages/siwe.tsx` citeturn4search2  
- NextAuth credential verification: `pages/api/auth/[...nextauth].ts` citeturn4search6  

---

### Next.js App Router SIWE + NextAuth route handler (DB user association)

**GitHub repo**
```text
https://github.com/Dylan-Kentish/siwe-next-auth
```

**Why it’s worth studying**: This is valuable specifically because it uses **App Router route handlers** for NextAuth (`app/api/auth/[...nextauth]/route.ts`) and mentions associating SIWE auth with a database user—exactly the server-side data pattern you described. citeturn4search3

**Patterns to study**
- Translating NextAuth SIWE credential verification into the App Router routing model (route handlers exports `GET`/`POST`) rather than the legacy Pages Router API route. citeturn4search3  
- How it attaches an “associated db user” to the SIWE identity (address) for per-user storage. citeturn4search3  

**Where to start**
- `src/app/api/auth/[...nextauth]/route.ts` citeturn4search3  

---

### WalletConnect/AppKit SIWE example using App Router route handlers

**GitHub repo (file reference within repo)**
```text
https://github.com/reown-com/web-examples
```

**Why it’s worth studying**: You asked for session restoration and cleanup behavior in modern Next.js. This repo includes an App Router NextAuth handler for a SIWE flow in an example dapp (`dapps/appkit-siwe/next/app/api/auth/[...nextauth]/route.ts`). Even if it uses WalletConnect’s stack rather than RainbowKit, the route-handler patterns transfer. citeturn4search1

**Where to start**
- `dapps/appkit-siwe/next/app/api/auth/[...nextauth]/route.ts` citeturn4search1  

---

### A “modern dapp app” example with server-side APIs + wagmi + Zustand/React Query

**GitHub repo**
```text
https://github.com/payroute-protocol/payroute-web
```

**Why it’s worth studying**: It’s not RainbowKit+SIWE; instead it uses Privy for auth while still using wagmi and a server-side SDK. But architecturally it matches your “wallet auth + server-side data + Zustand + TanStack Query” interest well. The repo README describes how state is split into Zustand stores, with wagmi wiring in `src/lib/wagmi.ts`, and server-side logic via Next.js API routes for sensitive operations. citeturn2search8

**Patterns to study**
- Feature/domain-based Zustand stores and a TanStack Query provider in one top-level provider wrapper citeturn2search8  
- Route groups to split public vs authenticated surfaces, plus `/api/*` routes for server-only functionality citeturn2search8  

**Where to start**
- `src/lib/wagmi.ts` (wallet client setup), `src/stores/*` (Zustand domain stores), `/api/*` routes for server-side actions, and the provider wrapper mentioned in the README (`PrivyWagmiProvider`). citeturn2search8  

## Next.js App Router architecture examples using TanStack Query + Zustand

Your AI-chat reference (Vercel Chatbot) uses SWR and some custom hooks/stores, so it won’t answer your “TanStack Query + Zustand” architecture question. Below are App Router projects whose own docs/READMEs explicitly describe how they structure state, API layers, and folders.

### Next.js App Router layered architecture with React Query + Zustand

**GitHub repo**
```text
https://github.com/HungFPTU/fe-sep490-pacsfr
```

**Why it’s worth studying**: The README explicitly describes a layered architecture (“API → Service → Hooks → Components → Pages”) and a feature-module folder structure, with **Zustand + TanStack Query** and a custom Axios client with interceptors—very close to what you asked for in “centralized API error handling.” citeturn3search3

**Stack (as stated)**
- Next.js 15 App Router + React 19 + TypeScript citeturn3search3  
- Zustand + TanStack Query citeturn3search3  
- Custom Axios client with interceptors citeturn3search3  

**Where to start**
- `modules/<feature>/api/*` and `modules/<feature>/services/*` for separation of raw HTTP vs business logic citeturn3search3  
- `modules/<feature>/hooks/*` for query hooks (React Query per feature) citeturn3search3  
- `modules/<feature>/components/view/*` for “page composition” UI that keeps route segments thin citeturn3search3  

---

### Next.js App Router + Zustand + TanStack Query with explicit “secure server proxy” route

**GitHub repo**
```text
https://github.com/vsvishalsharma/Financial-Dashboard
```

**Why it’s worth studying**: It’s smaller, but the README lays out a clear project structure and explicitly calls out `api/proxy/route.ts` as a “secure server proxy for external APIs” and `store/widgetStore.ts` as Zustand state—concrete examples of how to keep secrets server-side while driving a client dashboard through React Query / Zustand. citeturn3search8

**Stack & structure (as stated)**
- Next.js 15 App Router, Zustand, `@tanstack/react-query` citeturn3search8  
- Explicit structure: `app/`, `components/`, `AppClient.tsx` (providers), and `api/proxy/route.ts` (server proxy), plus `store/widgetStore.ts` (Zustand). citeturn3search8  

**Where to start**
- `AppClient.tsx` (providers and global UI), `api/proxy/route.ts` (server-side proxy), `store/widgetStore.ts` (Zustand), and the `components/widgets/*` layer. citeturn3search8  

---

### Next.js 15 + Zustand + React Query in a “real app” UI with authentication

**GitHub repo**
```text
https://github.com/ericchapman80/choreboard
```

**Why it’s worth studying**: The README describes a production-style setup: Next.js 15 + TS + Zustand + `@tanstack/react-query`, and NextAuth-based authentication (Google OAuth). Even though its backend persistence is Google Sheets (not Postgres), the front-end app architecture is directly reusable. citeturn3search6turn2search0

**Where to start**
- Look for the NextAuth wiring and the “Zustand + React Query” integration points; the README positions those as core building blocks of the app. citeturn3search6  

---

### Next.js e-commerce platform with significant commit history (React Query likely; broader product scope)

**GitHub repo**
```text
https://github.com/lvb2104/nhathuocthanthien
```

**Why it’s worth studying**: It appears to be a larger, full-featured platform (150 commits shown in repo listing) built on Next.js 15 + React 19, and the commit history suggests substantial hook/service/type layering work. This is the kind of repo where you can observe “how the codebase evolves” as features accumulate. citeturn3search9

**Where to start**
- Start in `src/` (the repo listing indicates the app code is concentrated there) and read the patterns used for hooks/services/types as implied by commit messages. citeturn3search9  

## Practical patterns to transplant into your AI + Web3 app

### A reliable `/` → `/chat/{id}` flow without UI remount

The most concrete proven pattern in the set is Vercel Chatbot’s approach:

1. **Allocate a chat ID immediately on `/`** so the UI can already operate “as if” the chat exists: `app/(chat)/page.tsx` generates a UUID and renders `<Chat id={id} ...>`. citeturn10view0  
2. **On first user submit**, update the URL *without navigation* using `window.history.pushState({}, "", \`/chat/${chatId}\`)`. That happens inside the input component right before sending the message. citeturn23view0turn23view3  
3. **Handle browser back/forward** by listening to `popstate` and calling `router.refresh()` to re-sync server-rendered state with the URL. citeturn17view0  
4. **Support deep linking and refresh** via a real server route `app/(chat)/chat/[id]/page.tsx` that loads messages from the DB and enforces auth. citeturn12view0  

This combination gives you “smooth in-app flow” and “correct on refresh / link sharing,” which is typically the hardest trade-off.

### Centralized API error handling that works with streaming

Vercel Chatbot demonstrates a clean pattern you can reuse even if you switch to TanStack Query:
- Define a single typed error object (`ChatbotError`) that knows how to serialize itself as a JSON response and assigns status codes by error type. citeturn30view0  
- Wrap fetch in a “throw typed errors on non-2xx” helper (`fetchWithErrorHandlers`) and reuse it in your chat transport and everywhere else. It even checks browser offline state before surfacing an error. citeturn31view0turn17view0  

If you move to TanStack Query, you can plug the same “typed error from fetch” into a single `queryFn` wrapper and standardize your `onError` handling in one place.

### Wallet auth + session restoration on refresh

From the SIWE + NextAuth examples:
- **Nonce management**: Use NextAuth CSRF token (`getCsrfToken`) as the SIWE nonce, and verify it server-side when validating the SIWE message. citeturn4search2turn4search6  
- **Session restoration**: On refresh, NextAuth rehydrates session from cookies/JWT; on the client you gate UI by `useSession()` status. citeturn4search2turn4search6  
- **Wallet reconnection → auth reconnection**: When wagmi says the wallet is connected but `useSession()` is empty, automatically trigger the SIWE login flow. citeturn4search2  
- **App Router route handler adaptation**: In App Router projects, implement NextAuth under `app/api/auth/[...nextauth]/route.ts` (as seen in a SIWE NextAuth App Router repo). citeturn4search3turn4search1  

For disconnect/cleanup, the general pattern is: “disconnect wallet connector” **and** “clear server session” (NextAuth `signOut()` or iron-session cookie destroy). While the sources here focus more on the sign-in side than explicit disconnect flows, RainbowKit’s example set is the best place to confirm the intended behavior patterns for RainbowKit+SIWE specifically. citeturn36view0  

## Quick “what to open first” checklist per project

Vercel Chatbot:
- `app/(chat)/layout.tsx` (persistent frame + sidebar) citeturn9view0  
- `app/(chat)/page.tsx` + `app/(chat)/chat/[id]/page.tsx` (new vs persisted chat) citeturn10view0turn12view0  
- `components/multimodal-input.tsx` (History API URL transition) citeturn23view0  
- `components/chat.tsx` (streaming client transport + popstate refresh + sidebar mutations) citeturn17view0  
- `app/(chat)/api/chat/route.ts` (streaming + persistence + title updates) citeturn27view0  
- `lib/errors.ts`, `lib/utils.ts` (central error + fetch) citeturn30view0turn31view0  

RainbowKit:
- `examples/with-next-app` (App Router wiring) citeturn36view0  
- `examples/with-next-siwe-next-auth` and/or `examples/with-next-siwe-iron-session` (SIWE session implementations) citeturn36view0  

SIWE + NextAuth correctness reference:
- `spruceid/siwe-next-auth-example/pages/siwe.tsx` and `pages/api/auth/[...nextauth].ts` citeturn4search2turn4search6  

TanStack Query + Zustand architecture references:
- `HungFPTU/fe-sep490-pacsfr/modules/<feature>/{api,services,hooks,components}` (layered modules) citeturn3search3  
- `vsvishalsharma/Financial-Dashboard/api/proxy/route.ts`, `store/widgetStore.ts`, `AppClient.tsx` citeturn3search8  
- `payroute-protocol/payroute-web/src/stores/*`, `src/lib/wagmi.ts`, and `/api/*` routes citeturn2search8