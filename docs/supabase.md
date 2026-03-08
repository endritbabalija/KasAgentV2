# Prompt 5 (UPDATED): Conversation Sidebar UI — Tabbed Approach

```
Read these files first:
- `components/sidebar/PortfolioSidebar.tsx` — this is the existing sidebar
- `components/chat/ChatContainer.tsx` — for chat state management
- `app/page.tsx` — for layout structure

### The feature:
Add conversation history to the existing sidebar using TABS. The sidebar gets two tabs at the top: "Chats" and "Portfolio". Only one tab's content shows at a time. This avoids cramming both into a tight space.

### Sidebar structure:

```
PortfolioSidebar
├── Tab bar: [ Chats | Portfolio ]
├── ── IF "Chats" tab active ──
│   ├── "New Chat" button (full width, top)
│   └── Conversation list (scrollable, fills remaining space)
│       ├── Today
│       │   ├── "Swapped 200 USDC to KAS" (active, highlighted)
│       │   └── "Best yield for stablecoins"
│       ├── Yesterday
│       │   └── "Portfolio summary"
│       └── Previous 7 days
│           └── "How does staking work"
├── ── IF "Portfolio" tab active ──
│   └── Existing portfolio content (balances, LP, farms, staking, infinity pool rates)
│       (completely unchanged)
└──
```

### Tab bar design:
- Two tabs side by side at the top of the sidebar
- Active tab: text-white, border-b-2 border-teal-400
- Inactive tab: text-zinc-500, hover:text-zinc-300
- Tab icons: MessageSquare (lucide) for Chats, Wallet (lucide) for Portfolio
- Default active tab: "Chats" if wallet is connected and conversations exist, "Portfolio" otherwise

### Components to create:

**ConversationList.tsx** (`components/sidebar/ConversationList.tsx`):
- Fetches conversations from GET /api/conversations?wallet=...
- Groups by time (Today, Yesterday, Previous 7 days, Older)
- Each item shows title, truncated with ellipsis
- Click to load that conversation
- Hover shows a delete button (small trash icon)
- Active conversation is highlighted with bg-zinc-700/50

### Modify existing:

**PortfolioSidebar.tsx** — Add the tab bar at the top. Wrap existing portfolio content so it only shows when "Portfolio" tab is active. Show ConversationList when "Chats" tab is active. Keep the sidebar width, collapse behavior, and animation exactly as-is.

### State management:

Create a new hook `hooks/useConversations.ts`:
- `conversations` — list of { id, title, updated_at }
- `activeConversationId` — currently loaded conversation
- `activeTab` — "chats" | "portfolio"
- `createConversation()` — POST /api/conversations, add to list, set as active
- `loadConversation(id)` — GET /api/conversations/[id], load messages into chat
- `deleteConversation(id)` — DELETE /api/conversations/[id], remove from list
- `refreshConversations()` — re-fetch the list

### Integration with ChatContainer:
- ChatContainer receives `activeConversationId` and `initialMessages` as props
- When activeConversationId changes, chat resets with the loaded messages
- "New Chat" creates a new conversation and clears the chat
- Remove the old localStorage persistence — the database replaces it
- Remove the old "+" clear chat button from ChatInput — "New Chat" in sidebar replaces it

### Styling:
- Match existing sidebar dark theme (zinc-800/900)
- Active conversation: bg-zinc-700/50 rounded-lg
- Hover: bg-zinc-800
- Title text: text-sm text-zinc-300, truncate with ellipsis
- Time group headers: text-xs text-zinc-500 uppercase tracking-wide
- Delete button: text-zinc-500 hover:text-red-400, only visible on hover
- "New Chat" button: border border-zinc-700 rounded-lg, text-zinc-300, full width, with a Plus icon from lucide

### What NOT to do:
- Do not modify the portfolio content — it stays exactly as-is, just conditionally rendered
- Do not change sidebar width, collapse behavior, or animations
- Do not add search or filtering
- Do not add conversation renaming
- Do not change the chat AI behavior or tools
```
