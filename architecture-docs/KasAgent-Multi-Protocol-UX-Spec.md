# KasAgent — Multi-Protocol UX Spec

**Version:** 1.0
**Date:** March 2026
**Status:** Pre-implementation — informs refactoring and integration work

---

## 1. Core Principle

KasAgent is an opinionated guide, not a black box and not a passive marketplace. It checks multiple protocols, recommends the best option with a clear reason, and lets the user compare or override.

The user talks naturally. The agent does the work. The protocols are visible but not in the way.

---

## 2. Who We're Designing For

**The Explorer** — crypto-native, ecosystem-new.

They understand DeFi concepts (swaps, LPs, yield farming) but they don't know the Kasplex ecosystem yet. They don't know which DEX has better liquidity for which pair, which farm has the best APR, or even what protocols exist.

They want a guide that shows them around, earns their trust by being transparent, and makes them smarter over time.

---

## 3. The Pattern: Smart Default + Compare

Every action where multiple protocols could serve the user follows this pattern:

### What the user sees

1. **One recommended option** — shown prominently with a clear reason why it was picked
2. **A "Compare" toggle** — expands to show alternatives from other protocols
3. **One-tap execute** — the recommendation has a primary action button, no extra steps to accept it

### What the AI does

1. Queries all relevant protocols in parallel
2. Picks the best option based on the action type (best price, best yield, lowest risk)
3. Responds with natural language explaining the recommendation
4. Attaches a comparison card with all results

### What this earns

- New users follow the recommendation and learn to trust
- Experienced users expand, compare, and feel in control
- Everyone learns the ecosystem naturally — protocol names become familiar over time
- The value prop is visible: "I checked 3 DEXes and found you the best price"

---

## 4. Action-Specific Behavior

### 4.1 Swaps

**User says:** "Swap 10 KAS for NACHO"

**Agent behavior:**
- Queries swap quotes from all integrated DEXes
- Picks the one with the best output amount (accounting for price impact)
- If the difference is negligible (<0.5%), just recommend the more liquid one
- If one DEX doesn't have the pair at all, mention it briefly but don't waste space

**Card: SwapComparisonCard**

Shows:
- Recommended DEX name and logo
- Output amount (large, prominent)
- Price impact percentage
- Route summary (e.g., "Direct pair" or "Via WKAS, 2 hops")
- Reason tag (e.g., "Best price", "Lower price impact", "Only available here")
- Execute button

Compare section (collapsed by default) shows:
- Other DEX quotes in a compact row format
- Output amount, price impact, and route for each
- Each row has its own "Use this instead" action
- If a DEX doesn't support the pair: "Pair not available" in muted text

**Edge cases:**
- Only one DEX has the pair → show it directly, no comparison toggle. Mention "Only available on [protocol]."
- All DEXes have identical prices → recommend the one with deeper liquidity. Reason: "Similar prices — recommending deeper liquidity."
- One DEX is significantly better (>2%) → emphasize the savings: "KrokoSwap saves you ~3.2% on this swap."

### 4.2 Yield / APR Discovery

**User says:** "Where can I earn yield on NACHO?" or "What's the best APR right now?"

**Agent behavior:**
- Queries yield sources across all protocols: farms, staking pools, LP APRs
- Ranks by APR but also surfaces risk context (IL exposure, lock periods, protocol maturity)
- Groups results by type: farming, staking, LP provision

**Card: YieldComparisonCard**

Shows:
- Top recommendation with APR, protocol name, and type (farm/stake/LP)
- Brief risk note if relevant (e.g., "Impermanent loss exposure" for LPs)
- Action button ("Stake", "Add Liquidity", "Farm")

Compare section shows:
- All yield opportunities in a sorted table
- Columns: Protocol, Type, APR/APY, Token, Risk Level
- Each row actionable — tapping it starts that specific flow

**Edge cases:**
- One protocol has farms and the other doesn't → still show everything, just label the source
- High APR but sketchy → agent should flag it in natural language, not just show numbers

### 4.3 Liquidity Provision

**User says:** "I want to add liquidity for KAS/NACHO"

**Agent behavior:**
- Checks if the pair exists on multiple DEXes
- Compares: pool TVL, fee tier, current APR from fees
- For V3 pools, note the added complexity and that positions need active management
- Recommend based on the user's likely intent (passive → V2, active → V3)

**Card: LiquidityComparisonCard**

Shows:
- Recommended pool with protocol, TVL, fee rate, and estimated APR
- V2 vs V3 distinction clearly labeled if both exist
- Reason tag (e.g., "Higher TVL", "Better fee APR", "Simpler — full range")
- Action button ("Add Liquidity")

Compare section shows:
- All available pools for the pair across protocols
- Pool type (V2/V3), TVL, fee tier, estimated APR
- Each row actionable

**Edge cases:**
- V3 pool exists but has very low TVL → agent should note liquidity risk
- User is clearly a beginner → agent should lean toward V2 recommendation with explanation

### 4.4 Portfolio Overview

**User says:** "What's in my wallet?" or "Show my positions"

**Agent behavior:**
- This is NOT a comparison action — it's a read action
- Show all positions across all protocols in one unified view
- Group by type: tokens, LP positions, farm positions, staking positions
- Label each position with its protocol source

**No comparison card needed here.** The portfolio sidebar and the AI response both just show everything the user has, clearly labeled by protocol.

### 4.5 Transaction History

**User says:** "Show my recent transactions"

**Agent behavior:**
- Pull from the block explorer as it does today
- Label each transaction with the protocol it interacted with (based on contract address matching)
- No comparison — this is purely informational

---

## 5. Card Design Principles

### Hierarchy

1. **Recommendation** is the hero. Big number, clear action.
2. **Reason** is always visible. One line explaining why. Users should never wonder "why this one?"
3. **Comparison** is one tap away. Not hidden, not forced. A subtle toggle.
4. **Protocol identity** is present but secondary. Protocol name + small logo. Not a banner.

### Consistency

Every comparison card follows the same layout pattern regardless of action type. The user learns the pattern once:
- Top section = recommendation with execute button
- Bottom section = expandable comparison
- Protocol labels always in the same position

### No dead ends

Every row in a comparison is actionable. If the user sees an alternative, they can switch to it. No "view only" comparisons that make the user start over.

### Protocol labels

Use a consistent format everywhere: small protocol icon + name. Examples:
- "via ZealousSwap"
- "via KrokoSwap"
- "via Kaspa Finance"

Same label style in cards, portfolio sidebar, transaction history. The user starts recognizing protocols naturally.

---

## 6. AI Behavior Rules

These go into the system prompt to govern how the agent handles multi-protocol scenarios:

### Always do

- Check all integrated protocols when the user asks for a swap, yield, or liquidity action
- Recommend one option with a clear, specific reason
- Show the comparison data in a structured card, not as a text dump
- Label every quote, position, and action with its protocol source
- When prices are very close, say so: "Both DEXes offer similar prices — going with [X] for deeper liquidity"

### Never do

- Silently pick a protocol without telling the user which one
- Show raw data without a recommendation
- Force comparison for simple actions where only one protocol applies
- Use protocol-specific jargon the user might not know without explaining it
- Make the user choose between protocols before showing any data

### Tone

The agent speaks like a knowledgeable friend walking you through a new neighborhood:
- "I checked both ZealousSwap and KrokoSwap — KrokoSwap gives you 3% more NACHO on this swap."
- "This pair only has liquidity on ZealousSwap right now."
- "Both have farms for this pair. ZealousSwap's is at 42% APR, KrokoSwap's at 38%. I'd go with ZealousSwap here."

---

## 7. How This Affects the Technical Architecture

This UX spec has direct implications for the prep refactoring:

### System prompt

Must instruct the AI to query multiple protocols and follow the "recommend + compare" pattern. The prompt needs protocol blocks that describe each protocol's capabilities so the AI knows what to query where.

### Tool architecture

The AI will call multiple tools per user request (e.g., both `zealous_getSwapQuote` and `kroko_getSwapQuote`). The system prompt governs this, not any aggregation layer in code. The AI is the aggregator.

### Card types

Two new categories of cards:
1. **Comparison cards** — protocol-agnostic, display results from multiple sources. These are new.
2. **Protocol execution cards** — protocol-specific, handle the actual on-chain transaction. These are the existing pattern (one per protocol per action).

Flow: Comparison card → user picks → protocol execution card activates.

### Tool dispatch

Tool names must be namespaced by protocol so the AI can call the right one. The card renderer must handle both comparison cards (new) and protocol-specific cards (existing).

### Quick actions

After a comparison card, quick actions should include:
- "Execute [recommended option]"
- "Tell me more about [protocol]"
- "What about [alternative action]?"

---

## 8. What This Spec Does NOT Cover

- **Visual design** — exact colors, spacing, animations. That comes during implementation.
- **Mobile-specific UX** — the comparison pattern works on mobile but the collapsed/expanded state needs touch-friendly sizing. Address during build.
- **Three or more protocols** — the pattern scales (sorted list in compare section) but the card layout may need tweaking when there are 4+ options. Cross that bridge later.
- **Autonomous execution** — the user always confirms. No "auto-swap at best price" mode. That's a Phase 2/3 product decision.

---

## 9. Success Criteria

The UX is working when:

- A new user can swap tokens without knowing what ZealousSwap or KrokoSwap is
- An experienced user can see exactly why the agent picked a specific protocol and override it in one tap
- After a week of use, the user has naturally learned which protocols are better for what — without reading any docs
- Adding a third protocol to the comparison doesn't require redesigning the cards
