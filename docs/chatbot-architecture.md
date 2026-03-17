the comprehensive documentation of the Vercel AI Chatbot codebase across all seven areas:

  ---
  1. Project Structure                                                                                                                                                             
  chatbot/
  ├── app/                           Next.js App Router                                                                                                                              │   ├── (auth)/                    Auth route group (no URL prefix)
  │   │   ├── auth.ts                NextAuth config
  │   │   ├── auth.config.ts         Shared auth config
  │   │   ├── actions.ts             Server actions (login, register)
  │   │   ├── login/page.tsx         /login
  │   │   ├── register/page.tsx      /register
  │   │   └── api/auth/                                                                                                                                                              │   │       ├── [...nextauth]/route.ts   NextAuth handler
  │   │       └── guest/route.ts           Auto-create guest accounts                                                                                                                │   └── (chat)/                    Chat route group
  │       ├── layout.tsx             Sidebar + session wrapper                                                                                                                       │       ├── page.tsx               / (new chat)
  │       ├── actions.ts             Server actions (title, visibility, etc.)
  │       ├── chat/[id]/page.tsx     /chat/:id (existing chat)                                                                                                                       │       └── api/
  │           ├── chat/route.ts      POST /api/chat (stream), DELETE
  │           ├── chat/[id]/stream/route.ts   Resume interrupted streams
  │           ├── document/route.ts  GET/POST/DELETE documents
  │           ├── files/upload/route.ts  Upload images to Vercel Blob
  │           ├── history/route.ts   GET/DELETE chat history
  │           ├── suggestions/route.ts  GET suggestions                                                                                                                              │           └── vote/route.ts      GET/PATCH votes
  ├── components/                                                                                                                                                                    │   ├── ui/                        Shadcn/Radix primitives (25 files)
  │   ├── ai-elements/               AI-specific UI (28 files)
  │   ├── elements/                  Base message elements (15 files)
  │   └── (root)                     Chat, artifact, message, sidebar, etc. (40+ files)
  ├── lib/                                                                                                                                                                           │   ├── ai/
  │   │   ├── models.ts              Model definitions (OpenAI, Anthropic, Google, xAI)
  │   │   ├── providers.ts           Gateway + reasoning middleware
  │   │   ├── prompts.ts             System prompts + artifact instructions
  │   │   ├── entitlements.ts        Rate limits per user type
  │   │   └── tools/                 4 tool definitions
  │   ├── db/
  │   │   ├── schema.ts              Drizzle ORM schema (PostgreSQL)
  │   │   ├── queries.ts             All DB operations
  │   │   └── migrations/            9 migration files
  │   ├── artifacts/server.ts        DocumentHandler factory
  │   ├── errors.ts                  ChatbotError class
  │   ├── ratelimit.ts               Redis IP-based rate limiting
  │   ├── types.ts                   ChatMessage, CustomUIDataTypes, ChatTools
  │   └── utils.ts                   fetcher, generateUUID, convertToUIMessages
  ├── artifacts/                     Artifact implementations
  │   ├── text/{client,server}.ts
  │   ├── code/{client,server}.ts
  │   ├── sheet/{client,server}.ts
  │   └── image/client.tsx                                                                                                                                                           └── hooks/                         Custom hooks (artifact, auto-resume, visibility, etc.)
                                                                                                                                                                                     Why this structure: Route groups (auth) and (chat) share layout boundaries without affecting URLs. AI tools are separated from the API route to keep each tool testable.           Artifacts split client/server because server generates content via AI while client handles rendering and streaming display.
                                                                                                                                                                                     ---
  2. Chat Persistence

  Database Schema (lib/db/schema.ts)
                                                                                                                                                                                     Tables: User, Chat, Message_v2 (role + JSON parts), Vote_v2, Document, Suggestion, Stream.                                                                                                                                                                                                                                                                            Every Chat has a userId foreign key. Messages store structured parts (text, files, tool calls) as JSON.                                                                          
  New Chat Flow                                                                                                                                                                    
  1. app/(chat)/page.tsx — Server component generates UUID via generateUUID() before rendering                                                                                       2. components/multimodal-input.tsx submitForm() — On first message send, calls window.history.pushState({}, "", /chat/${chatId}) to update the URL without a navigation
  3. app/(chat)/api/chat/route.ts — Checks getChatById(). If no chat exists, calls saveChat({ id, userId, title: "New chat" }) and kicks off async title generation with
  generateTitleFromUserMessage()                                                                                                                                                     4. Title streams back to client via dataStream.write({ type: "data-chat-title", data: title })
                                                                                                                                                                                     Existing Chat Flow                                                                                                                                                                                                                                                                                                                                                    1. app/(chat)/chat/[id]/page.tsx — Server component loads chat with getChatById(), messages with getMessagesByChatId(), converts via convertToUIMessages(), and passes to <Chat    initialMessages={...} autoResume={true} />
  2. hooks/use-auto-resume.ts — If last message is from user (stream was interrupted), calls resumeStream() to recover
                                                                                                                                                                                     Message Persistence During Streaming
                                                                                                                                                                                     In the API route's createUIMessageStream → onFinish callback:                                                                                                                      - Normal flow: saveMessages() batch-inserts all assistant messages
  - Tool approval flow: updateMessage() for existing messages, saveMessages() for new ones                                                                                         
  Sidebar History (components/sidebar-history.tsx)
                                                                                                                                                                                     Uses useSWRInfinite with cursor-based pagination:                                                                                                                                  /api/history?limit=20
  /api/history?ending_before={lastChatId}&limit=20                                                                                                                                 
  Cache invalidated via mutate(unstable_serialize(getChatHistoryPaginationKey)) on: message completion (onFinish), chat deletion, title update (data-chat-title stream event).
                                                                                                                                                                                     ---                                                                                                                                                                                3. Auth & Session Management                                                                                                                                                     
  Stack: NextAuth v5 beta with two Credentials providers
                                                                                                                                                                                     app/(auth)/auth.ts configures:                                                                                                                                                     - Regular provider — email/password with bcrypt comparison, returns { ...user, type: "regular" }                                                                                   - Guest provider (id: "guest") — creates guest-{timestamp} user with random password, returns { ...user, type: "guest" }                                                         
  JWT Callbacks                                                                                                                                                                    
  jwt({ token, user }) → token.id = user.id, token.type = user.type
  session({ session, token }) → session.user.id = token.id, session.user.type = token.type                                                                                                                                                                                                                                                                              Route Protection                                                                                                                                                                 
  No middleware.ts file — protection happens at the route level:                                                                                                                     - Server pages call auth() and redirect to /api/auth/guest if no session
  - API routes check session?.user and return ChatbotError("unauthorized:chat").toResponse() (401)                                                                                   - Private chats verify chat.userId === session.user.id, return notFound() if mismatch

  Guest Flow
                                                                                                                                                                                     /api/auth/guest auto-creates a guest account and signs in. Guest UI shows "Guest" instead of email, and "Login to your account" instead of "Sign out". Detection via regex:        /^guest-\d+$/.
                                                                                                                                                                                     Rate Limiting (Two Layers)                                                                                                                                                       
  1. IP-based (lib/ratelimit.ts) — Redis counter ip-rate-limit:{ip}, 10 requests/hour, throws ChatbotError("rate_limit:chat")                                                        2. User-based (lib/ai/entitlements.ts) — getMessageCountByUserId() checks DB, both guest and regular get 10 messages/hour
                                                                                                                                                                                     ---
  4. AI Tool Definitions                                                                                                                                                           
  Tool Files (lib/ai/tools/)
                                                                                                                                                                                     ┌────────────────────┬────────────────────────┬────────────────────────────────┬───────────────────────────────────────────────────────────┐                                       │        Tool        │          File          │             Schema             │                        Key Feature                        │
  ├────────────────────┼────────────────────────┼────────────────────────────────┼───────────────────────────────────────────────────────────┤                                       │ getWeather         │ get-weather.ts         │ {latitude?, longitude?, city?} │ needsApproval: true, uses Open-Meteo API                  │
  ├────────────────────┼────────────────────────┼────────────────────────────────┼───────────────────────────────────────────────────────────┤
  │ createDocument     │ create-document.ts     │ {title, kind}                  │ Factory fn closing over session + dataStream              │
  ├────────────────────┼────────────────────────┼────────────────────────────────┼───────────────────────────────────────────────────────────┤                                       │ updateDocument     │ update-document.ts     │ {id, description}              │ Fetches existing doc, delegates to handler                │
  ├────────────────────┼────────────────────────┼────────────────────────────────┼───────────────────────────────────────────────────────────┤                                       │ requestSuggestions │ request-suggestions.ts │ {documentId}                   │ Uses streamText with Output.array() for structured output │
  └────────────────────┴────────────────────────┴────────────────────────────────┴───────────────────────────────────────────────────────────┘                                     
  Registration (app/(chat)/api/chat/route.ts)                                                                                                                                      
  streamText({
    tools: {                                                                                                                                                                             getWeather,                                    // stateless
      createDocument: createDocument({ session, dataStream }),  // factory
      updateDocument: updateDocument({ session, dataStream }),
      requestSuggestions: requestSuggestions({ session, dataStream }),                                                                                                                 },
    experimental_activeTools: isReasoningModel ? [] : ["getWeather", "createDocument", ...],
    stopWhen: stepCountIs(5),  // max 5 multi-step tool calls
  })                                                                                                                                                                                                                                                                                                                                                                    Reasoning models (e.g. Claude 3.7 Sonnet thinking) get tools disabled and thinking budget enabled instead.                                                                       
  Document Handlers (lib/artifacts/server.ts + artifacts/*/server.ts)                                                                                                              
  createDocumentHandler() wraps onCreateDocument and onUpdateDocument with DB persistence. Each handler uses streamText or streamObject to generate content, writing deltas via      dataStream.write({ type: "data-textDelta" | "data-codeDelta" | "data-sheetDelta", ... }).
                                                                                                                                                                                     Tool → UI Connection                                                                                                                                                             
  1. Tool results appear as tool-{name} parts in messages                                                                                                                            2. components/message.tsx pattern-matches on type === "tool-getWeather" etc.
  3. Weather renders <Weather> component; document tools render <DocumentPreview>
  4. Approval flow: state === "approval-requested" shows Allow/Deny buttons → addToolApprovalResponse()
  5. data-* stream events route through DataStreamHandler → artifact onStreamPart handlers → UI updates
                                                                                                                                                                                     ---
  5. Data Fetching Patterns
                                                                                                                                                                                     Libraries
                                                                                                                                                                                     - Server: Drizzle ORM direct DB queries, Next.js Server Actions                                                                                                                    - Client: SWR (caching + revalidation), useChat from @ai-sdk/react, native fetch
  - No tRPC or React Query                                                                                                                                                         
  Patterns                                                                                                                                                                         
  ┌─────────────────────────────────┬─────────────────────────┬───────────────────────────────────────────────────────────────────────────┐                                          │             Pattern             │       Where Used        │                                  Example                                  │
  ├─────────────────────────────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ Server Component data loading   │ chat/[id]/page.tsx      │ getChatById() + getMessagesByChatId() before render                       │
  ├─────────────────────────────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ Server Actions                  │ app/(chat)/actions.ts   │ saveChatModelAsCookie(), updateChatVisibility(), deleteTrailingMessages() │
  ├─────────────────────────────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────┤                                          │ SWR as local state              │ hooks/use-artifact.ts   │ useSWR("artifact", null) — null fetcher, uses SWR as reactive state       │
  ├─────────────────────────────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────┤                                          │ SWR infinite pagination         │ sidebar-history.tsx     │ useSWRInfinite with cursor-based keys                                     │
  ├─────────────────────────────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────┤                                          │ SWR conditional keys            │ components/chat.tsx     │ useSWR(messages.length >= 2 ? /api/vote?chatId=${id} : null)              │
  ├─────────────────────────────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────┤                                          │ Optimistic + debounced mutation │ components/artifact.tsx │ mutate() with local update, useDebounceCallback(2000) for saves           │
  ├─────────────────────────────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────┤                                          │ Streaming via useChat           │ components/chat.tsx     │ DefaultChatTransport with custom prepareSendMessagesRequest               │
  └─────────────────────────────────┴─────────────────────────┴───────────────────────────────────────────────────────────────────────────┘                                        
  Cache Invalidation                                                                                                                                                               
  - On message finish: mutate(unstable_serialize(getChatHistoryPaginationKey))                                                                                                       - On delete: manual cache filter mutate(histories => histories.map(h => ({...h, chats: h.chats.filter(...)})))
  - On vote: mutate(/api/vote?chatId=..., currentVotes => [...filtered, newVote], {revalidate: false})
  - On title update: data-stream event triggers mutate(getChatHistoryPaginationKey)
                                                                                                                                                                                     ---
  6. Error Handling                                                                                                                                                                
  Centralized Error Class (lib/errors.ts)
                                                                                                                                                                                     ChatbotError maps error codes like "rate_limit:chat" to status codes (429) and user-facing messages. Visibility control: database surface hides internal details, chat/api         surfaces expose them.
                                                                                                                                                                                     new ChatbotError("unauthorized:chat").toResponse()
  // → Response.json({ code, message, cause }, { status: 401 })
                                                                                                                                                                                     API Route Pattern (every protected route)                                                                                                                                                                                                                                                                                                                             BotID check → auth() → rate limit → Zod schema validation → ownership check → operation
                                                                                                                                                                                     Each step returns a ChatbotError.toResponse() on failure.                                                                                                                                                                                                                                                                                                             Client-Side                                                                                                                                                                      
  - fetchWithErrorHandlers (lib/utils.ts) — wraps fetch, detects offline (navigator.onLine), parses error JSON into ChatbotError                                                     - useChat onError — credit card errors → modal dialog; ChatbotError → toast notification; unknown → generic toast
  - Toast system — Sonner (components/toast.tsx) renders at <Toaster position="top-center" />
                                                                                                                                                                                     Streaming Errors
                                                                                                                                                                                     createUIMessageStream's onError returns user-friendly strings. Credit card gateway errors get special handling. Redis failures are silently ignored (graceful degradation — app    works without Redis).
                                                                                                                                                                                     Database Errors

  Every function in lib/db/queries.ts wraps operations in try/catch, converting to ChatbotError("bad_request:database", "descriptive cause").                                      
  ---                                                                                                                                                                                7. Streaming Architecture

  Full Pipeline
                                                                                                                                                                                     Client: sendMessage() → prepareSendMessagesRequest()
    ↓ POST /api/chat
  Server: validate → auth → rate limit → model selection
    ↓                                                                                                                                                                                streamText({ model, system, messages, tools })
    ↓                                                                                                                                                                                createUIMessageStream({
    execute: async ({ writer: dataStream }) => {
      dataStream.merge(result.toUIMessageStream({ sendReasoning }))
      // + custom data: data-chat-title, data-id, data-kind, etc.
    },                                                                                                                                                                                 onFinish: async ({ messages }) => { saveMessages() },
    onError: () => "user-friendly error string"                                                                                                                                      })
    ↓                                                                                                                                                                                createUIMessageStreamResponse({ stream, consumeSseStream })
    ↓ SSE response                                                                                                                                                                   Client: useChat processes stream
    ├── onData → setDataStream() → DataStreamHandler
    │     ├── "data-chat-title" → mutate sidebar cache
    │     ├── "data-textDelta" → artifact.onStreamPart → append content
    │     ├── "data-codeDelta" → artifact.onStreamPart → replace content
    │     └── "data-id/title/kind/clear/finish" → update artifact state
    ├── messages update → re-render Message components
    │     ├── tool-getWeather → <Weather> or approval buttons
    │     ├── tool-createDocument → <DocumentPreview>                                                                                                                                  │     └── reasoning parts → <MessageReasoning>
    └── onFinish → mutate(getChatHistoryPaginationKey)
                                                                                                                                                                                     Key Design Decisions
                                                                                                                                                                                     - window.history.pushState instead of router.push — avoids full page navigation on new chat                                                                                        - Resumable streams — stream IDs stored in Redis via createStreamId(). On reconnect, useAutoResume calls resumeStream() which hits /api/chat/[id]/stream
  - smoothStream({ chunking: "word" }) — artifact text/code handlers use this transform for smoother visual rendering
  - stopWhen: stepCountIs(5) — caps multi-step tool reasoning to 5 iterations
  - Reasoning middleware — extractReasoningMiddleware({ tagName: "thinking" }) wraps reasoning models to separate <thinking> tags into dedicated UI parts
  - Transient data — all dataStream.write() calls use transient: true so custom events aren't persisted to the message DB, only the final tool results are