# KasAgent Vision: Feed + Conversation Canvas

> Status: Design vision — not yet implemented
> Created: 2026-03-15
> Context: KasAgent is evolving from a DeFi chatbot into the intelligence layer for the entire Kaspa ecosystem

---

## The Problem

KasAgent has 23 AI tools, 3 integrated protocols, a strategy engine, and cross-DEX comparison — all squeezed through a chat text input. This creates three problems:

1. **Discovery bottleneck** — users must know what to type to access capabilities
2. **Passive portfolio** — the sidebar shows data but doesn't suggest actions
3. **DEX-only framing** — the chat UI doesn't scale to lending, bridges, NFTs, L1, governance, etc.

Building a traditional tabbed DeFi dashboard (Dashboard / Trade / Pools / Farms) would solve #3 but lose the AI advantage. Every DEX already has a better version of those pages for their own protocol.

---

## The Vision

**KasAgent becomes the intelligence layer for the Kaspa ecosystem.** The AI is the brain, not the interface. The interface is a Feed + Conversation Canvas where AI intelligence manifests as proactive insights and interactive execution widgets.

### Core Principle

> The AI doesn't wait for you to ask. It sees your portfolio, scans the ecosystem, and surfaces what matters. When you act, the conversation becomes a workspace of live, interactive cards. DEX swap, lending supply, bridge transfer, NFT purchase, governance vote — all identical from the UI's perspective. They're just different tools producing different cards.

---

## App Shell Layout

```
+----------------------------------------------------------+
|  KasAgent            [Portfolio >]        [Connect Wallet] |
+----------+-----------------------------------------------+
|          |                                                 |
| Convos   |  +-- AI Feed Card ---------------------------+ |
|          |  | Your 142 KAS is sitting idle               | |
| Today    |  | Best yield: Farm KAS/USDT (89% APR)       | |
| - Yield  |  | [Do it]  [Tell me more]                    | |
|   check  |  +-------------------------------------------+ |
|          |                                                 |
| - Farm   |  You: "farm 50 KAS"                            |
|   strat  |                                                 |
|          |  +-- Strategy Flow --------------------------+ |
| Yester-  |  | [Swap KAS>USDT] > [Add LP] > [Stake]      | |
| day      |  | [Execute All]                              | |
| - ...    |  +-------------------------------------------+ |
|          |                                                 |
|          |  +-- Live: Swap Comparison ------------------+ |
|          |  | Zealous:  7.12 USDT                        | |
|          |  | Kroko:    7.28 USDT   <-- best             | |
|          |  | KaspaCom: 7.01 USDT                        | |
|          |  | [Swap on Kroko]                            | |
|          |  +-------------------------------------------+ |
|          |                                                 |
|          |  AI: "Step 1 done. Adding LP next..."          |
|          |                                                 |
+----------+-----------------------------------------------+
| Message KasAgent...                              [Send]   |
+----------------------------------------------------------+
```

### Key Structural Decisions

- **No traditional nav tabs** (no /trade, /pools, /farms pages)
- **Left rail**: Conversation list (already exists via Supabase persistence)
- **Main area**: Conversation canvas with rich interactive widget-cards
- **Portfolio**: Slide-out panel (not always-visible sidebar)
- **Chat input**: Always at bottom, always available
- **AI Feed**: Proactive insight cards shown at start of new conversations or on app open

---

## The Proactive AI Feed

When users open the app or start a new conversation, before they type anything, they see 3-5 AI-generated insight cards based on their portfolio and ecosystem state:

### Feed Card Types

| Card Type | Example | Trigger |
|-----------|---------|---------|
| Idle Capital | "Your 142 KAS is earning nothing. Farm at 89% APR?" | Token balance > threshold, not in any position |
| Better Yield | "Move KAS/USDT LP from Zealous (42%) to Kroko farm (67%)" | Cross-protocol yield comparison |
| Harvest Ready | "5.2 KAS rewards pending. Worth ~$0.73. [Harvest]" | Pending farm rewards > gas cost |
| IL Warning | "KAS/USDT LP: 5.3% impermanent loss this week" | IL exceeds threshold |
| Market Move | "KAS up 12% today. Your portfolio gained $14" | Significant price movement |
| New Opportunity | "New farm launched: MEME/KAS at 340% APR" | New farm/pool detected |
| Governance | "Proposal #12 ends in 6h. Your vote matters." | Active proposal nearing deadline |
| Launch Alert | "IDO starting in 4h: KaspaVault. You're eligible." | Upcoming launchpad event |
| Bridge Suggestion | "You have 200 KAS on L1 idle. Bridge to L2 for yield?" | L1 balance sitting unused |

Each card is a **one-tap conversation starter**. Tap [Do it] and the AI takes over — tools fire, execution cards render, user signs.

### Feed Generation

Server-side computation on portfolio load. Uses existing tools:
- `getTokenPrice` — for market moves
- `zealous_discoverYieldOpportunities` — for yield comparisons
- `usePortfolio` data — for idle capital, positions
- `useFarmPositions` — for pending rewards
- Future protocol tools feed into this same pipeline

---

## Conversation Canvas: Interactive Widget-Cards

The chat isn't just text + static cards. Each tool result renders as a **live, interactive widget** that the user can manipulate and execute from.

### Card Taxonomy (Current + Future)

**DEX Cards (existing)**
| Tool | Card | User Action |
|------|------|-------------|
| `*_getSwapQuote` | SwapQuoteCard | View quote details |
| `*_prepareSwap` | SwapExecutionCard | Approve + Sign swap tx |
| `compareSwapQuotes` | SwapComparisonCard | Pick best DEX, execute |
| `planStrategy` | StrategyPlanCard | View multi-step plan, start execution |
| `*_prepareAddLiquidity` | AddLiquidityCard | Approve + Sign add LP tx |
| `*_prepareRemoveLiquidity` | RemoveLiquidityCard | Sign remove LP tx |
| `*_prepareFarmStake` | FarmStakeCard | Approve + Sign stake tx |
| `*_prepareFarmUnstake` | FarmUnstakeCard | Sign unstake tx |
| `*_prepareInfinityStake` | InfinityStakeCard | Approve + Sign stake tx |
| `*_prepareInfinityUnstake` | InfinityUnstakeCard | Sign unstake tx |
| `zealous_listAllPairs` | AllPairsCard | Browse, filter, paginate |
| `zealous_discoverYieldOpportunities` | YieldOpportunitiesCard | Compare yields, enter position |
| `zealous_getMembershipStatus` | MembershipStatusCard | View discount status |
| `getTokenPrice` | PriceCard | View price |
| `getTransactionHistory` | TransactionHistoryCard | Browse tx history |
| `spyOnWallet` | SpyPortfolioCard | View any wallet |

**Lending Cards (future)**
| Tool | Card | User Action |
|------|------|-------------|
| `*_getMarkets` | LendingMarketsCard | Browse supply/borrow rates |
| `*_prepareSupply` | SupplyCard | Approve + Sign supply tx |
| `*_prepareBorrow` | BorrowCard | Sign borrow tx |
| `*_prepareRepay` | RepayCard | Approve + Sign repay tx |
| `*_getHealthFactor` | HealthFactorCard | View liquidation risk |

**Bridge Cards (future)**
| Tool | Card | User Action |
|------|------|-------------|
| `bridge_transfer` | BridgeCard | Sign bridge tx (L1 or L2 wallet) |
| `bridge_status` | BridgeStatusCard | Track pending bridge |
| `bridge_wrap` | WrapCard | Sign wrap/unwrap tx |

**NFT Cards (future)**
| Tool | Card | User Action |
|------|------|-------------|
| `nft_getTrending` | NFTGalleryCard | Browse NFTs in grid |
| `nft_buy` | NFTBuyCard | Approve + Sign purchase tx |
| `nft_list` | NFTListCard | Set price + Sign list tx |
| `nft_getCollection` | NFTCollectionCard | Browse collection stats |

**Launchpad Cards (future)**
| Tool | Card | User Action |
|------|------|-------------|
| `launchpad_getUpcoming` | LaunchpadCard | Browse upcoming IDOs |
| `launchpad_allocate` | LaunchAllocationCard | Sign allocation tx |
| `launchpad_claim` | LaunchClaimCard | Sign claim tx |

**Governance Cards (future)**
| Tool | Card | User Action |
|------|------|-------------|
| `governance_getProposals` | ProposalsCard | Browse active proposals |
| `governance_vote` | VoteCard | Sign vote tx |

**L1 KRC-20 Cards (future)**
| Tool | Card | User Action |
|------|------|-------------|
| `krc20_getTrending` | KRC20TrendingCard | Browse trending tokens |
| `krc20_trade` | KRC20TradeCard | Sign L1 trade tx |
| `krc20_mint` | KRC20MintCard | Sign L1 mint tx |
| `krc20_transfer` | KRC20TransferCard | Sign L1 transfer tx |

### The Universal Loop

Every protocol type, regardless of what it does, follows this flow:

```
Feed card surfaces opportunity (proactive)
       |
User taps card or types a message (reactive)
       |
AI selects appropriate tool(s) for the task
       |
Tool executes server-side (reads chain / API)
       |
Returns structured result
       |
Card component renders with [Sign] button
       |
User signs -> tx confirmed -> done
       |
Auto-continue fires next step (if strategy)
```

---

## Generalized Protocol Registry

### Current Registry (DEX-only)

```ts
type ProtocolFeature = "swap" | "liquidity" | "farms" | "staking" | "membership"

PROTOCOLS = {
  zealous:  { features: ["swap", "liquidity", "farms", "staking", "membership"] },
  kroko:    { features: ["swap", "liquidity"], apiBaseUrl: "..." },
  kaspacom: { features: ["swap"] },
}
```

### Generalized Registry

```ts
type ProtocolType =
  | "dex"
  | "lending"
  | "bridge"
  | "nft-marketplace"
  | "launchpad"
  | "governance"
  | "l1-tokens"
  | "payments"

type Layer = "l1" | "l2" | "cross-layer"

interface ProtocolConfig {
  id: string
  name: string
  type: ProtocolType
  layer: Layer
  features: string[]                          // type-specific feature list
  contracts?: Record<string, `0x${string}`>   // EVM protocols (L2)
  api?: { baseUrl: string }                   // API-based protocols
  rpc?: { endpoint: string }                  // L1 protocols (Kaspa node)
  description?: string                        // For AI system prompt generation
}

// Registry
PROTOCOLS: Record<string, ProtocolConfig> = {
  // DEXes (existing)
  zealous:  {
    id: "zealous", name: "ZealousSwap",
    type: "dex", layer: "l2",
    features: ["swap", "liquidity", "farms", "staking", "membership"],
    contracts: { factory: "0x...", router: "0x...", masterchef: "0x..." }
  },
  kroko: {
    id: "kroko", name: "KrokoSwap",
    type: "dex", layer: "l2",
    features: ["swap", "liquidity"],
    contracts: { factory: "0x...", permit2: "0x..." },
    api: { baseUrl: "https://api.krokoswap.com" }
  },
  kaspacom: {
    id: "kaspacom", name: "KaspaCom",
    type: "dex", layer: "l2",
    features: ["swap"],
    contracts: { factory: "0x...", router: "0x..." }
  },

  // Future protocols
  kaspaLend: {
    id: "kaspaLend", name: "KaspaLend",
    type: "lending", layer: "l2",
    features: ["lend", "borrow", "liquidation"],
    contracts: { lendingPool: "0x...", oracle: "0x..." }
  },
  kasplexBridge: {
    id: "kasplexBridge", name: "Kasplex Bridge",
    type: "bridge", layer: "cross-layer",
    features: ["bridge", "wrap", "unwrap"],
    contracts: { bridge: "0x...", wrappedKAS: "0x..." }
  },
  kaspaArt: {
    id: "kaspaArt", name: "KaspaArt",
    type: "nft-marketplace", layer: "l2",
    features: ["mint", "list", "bid", "buy"],
    contracts: { marketplace: "0x..." }
  },
  krc20: {
    id: "krc20", name: "KRC-20",
    type: "l1-tokens", layer: "l1",
    features: ["mint-krc20", "transfer-krc20", "trade-krc20"],
    rpc: { endpoint: "https://api.kaspa.org" }
  },
}
```

### Registry Helper Functions

```ts
// Existing pattern — still works
getAllV2Factories()     // Returns DEX factories (type === "dex")

// New helpers
getProtocolsByType(type: ProtocolType)   // e.g., all lending protocols
getProtocolsByLayer(layer: Layer)         // e.g., all L1 protocols
getProtocolsByFeature(feature: string)   // e.g., all protocols with "swap"
getAllProtocols()                          // Everything registered
```

### Shared Layers Read From Registry

Same principle as today — shared layers are registry-driven, not hardcoded:

- `system-prompt.ts` -> generates protocol knowledge blocks for ALL registered protocols
- `token-registry.ts` -> discovers tokens from ALL factories (DEX type)
- `feed-generator.ts` (new) -> generates feed cards based on ALL protocol types
- `strategy.ts` -> can compose steps across ANY protocol type
- `spy.ts` / `oracle.ts` -> reads across ALL relevant protocols

---

## Implementation Roadmap (Layer Cake)

```
Layer 5 (later)   |  Platform / SDK — protocols plug themselves in
Layer 4 (later)   |  Goal Engine — "grow my portfolio 20%"
Layer 3 (soon)    |  Intelligence — whale tracking, analytics, alerts
Layer 2 (next)    |  Cross-layer — L1 + L2 unified, bridge integration
Layer 1 (NOW)     |  App shell redesign + generalized protocol registry
Layer 0 (DONE)    |  Chat + 23 tools + 3 DEXes + strategy engine
```

### Layer 1 — App Shell Redesign (Current Priority)

**Phase 1: Layout restructure**
- Move from single-page chat to app shell layout (left rail + main canvas + input)
- Conversation list in left rail (already have Supabase persistence)
- Portfolio as slide-out panel instead of always-visible sidebar
- Chat input fixed at bottom

**Phase 2: Richer cards**
- Enhance existing tool cards with better visualizations
- Composition bars on LP positions
- Animated strategy flow diagrams
- Sparkline charts where relevant

**Phase 3: Proactive AI feed**
- Server-side feed generation on portfolio load
- Feed cards rendered at start of new conversations
- Each card is a one-tap conversation starter
- Uses existing tools (yield discovery, price oracle, portfolio hooks)

**Phase 4: Generalize protocol registry**
- Add `type` and `layer` fields to ProtocolConfig
- Add registry helper functions
- Update system prompt generator to handle all protocol types
- Update feed generator to handle all protocol types

### Layer 2+ — New Protocol Types

Each new protocol follows the established pattern:
1. Registry entry in `config/protocols.ts`
2. Tool modules in `lib/ai/tools/<protocol-name>/`
3. Card components in `components/chat/cards/`
4. Registry entry in `ToolPartRenderer.tsx`
5. One import + spread in `lib/ai/tools/index.ts`

No shared-layer edits. No new pages or navigation. The conversation canvas handles everything.

---

## What This Is NOT

- **Not a generic DeFi dashboard** — no protocol-specific pages that compete with native UIs
- **Not chat-only** — the feed layer adds proactive, visual intelligence
- **Not DEX-only** — the architecture supports any protocol type on any layer
- **Not a rebuild** — evolves the existing chat + tool + card architecture

## What This IS

- **An AI-native interface** where intelligence is the primary interaction model
- **A protocol-agnostic canvas** where any protocol type renders as interactive cards
- **A proactive copilot** that surfaces opportunities before you ask
- **The intelligence layer for Kaspa** — one surface for the entire ecosystem
