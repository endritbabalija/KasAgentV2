 Direction 1: "Protocol Adapter" Pattern
                                                                                                                                                                                     Think of it like USB drivers — each protocol (ZealousSwap, Fervent, future DEXes) is a plugin that implements a standard interface. Each L2 chain is a context.

  chains/
    kasplex/     → chain config, explorer URL, RPC, tokens
    igra/        → chain config, explorer URL, RPC, tokens
  protocols/
    zealousswap/ → swap adapter, farm adapter, pool adapter
    fervent/     → lending adapter, borrow adapter
  tools/
    swap.ts      → generic "swap" tool that delegates to the right protocol adapter
    farm.ts      → generic "farm" tool
    explore.ts   → generic "tx history" tool (uses chain's explorer API)

  The AI doesn't call zealousSwapPrepareSwap — it calls prepareSwap and the system routes to the right protocol based on the user's active chain. Explorer/tx history is a
  chain-level capability (every L2 has a block explorer), not protocol-level.

  Optimizes for: scalability, clean separation, easy onboarding of new protocols

  ---
  Direction 2: "Universal Interface" / Action-Based

  Inspired by how ChatGPT plugins work. Instead of protocol-specific tools, you define actions the user wants to do: swap, lend, stake, explore history, bridge. The AI picks the
  action, and a resolver figures out which chain + protocol can fulfill it.

  "I want to swap KAS for ZEAL"
    → Action: SWAP
    → Resolver checks: user is on Kasplex → ZealousSwap handles swaps
    → Tool executes via ZealousSwap adapter

  "Show me lending rates"
    → Action: LEND_RATES
    → Resolver: Kasplex has no lending → suggests Igra/Fervent
    → Or: shows cross-chain comparison

  The explorer isn't a separate "feature" — it's baked into every action. Every swap result links to the tx. Transaction history is just another action: HISTORY.

  Optimizes for: user experience, cross-chain intelligence, the AI as the "routing layer"

  ---
  Direction 3: "Chain-First" Vertical Slices

  Instead of abstracting across chains, you build complete vertical slices per chain. Each chain gets its own tools file, its own cards, its own prompt section. The AI is aware of
   all chains simultaneously.

  lib/chains/kasplex/tools.ts     → all Kasplex tools (swap, farm, history, explore)
  lib/chains/kasplex/prompts.ts   → Kasplex protocol knowledge
  lib/chains/igra/tools.ts        → all Igra tools
  lib/chains/igra/prompts.ts      → Igra protocol knowledge

  The system prompt dynamically includes the relevant chain's knowledge based on which wallet/chain the user is connected to. Or includes ALL chains so the AI can compare
  ("where's the best yield across all Kaspa L2s?").

  Optimizes for: speed of development, protocol-specific nuance, avoiding premature abstraction

  ---
  Direction 4: "Ecosystem Intelligence Hub"

  Flip the mental model entirely. Instead of "agent that executes on protocols," think "intelligence layer that understands the entire Kaspa ecosystem." The explorer isn't just tx
   history — it's the AI's eyes. It continuously indexes on-chain data across chains, builds a semantic understanding of what's happening, and surfaces insights proactively.

  Transaction history, TVL tracking, whale watching, yield changes, new pool launches — all feed into a knowledge graph. The AI doesn't just respond to "show my transactions" — it
   notices patterns: "You swapped KAS→ZEAL 3 times this week. Want me to set up a recurring strategy?"

  Explorer data becomes a foundation layer that everything else builds on, not an add-on feature.

  Optimizes for: long-term vision (Phase 2 autonomous agent), competitive differentiation, "wow" factor

  ---
  Direction 5: "Modular MCP-Style Tool Registry"

  Treat each protocol/chain as an independent tool server (like Anthropic's MCP pattern). Tools register themselves at runtime. Adding Igra Labs is literally adding a new tool
  server config — no core code changes.

  registry/
    kasplex-zealousswap.json  → tool definitions + endpoints
    kasplex-explorer.json     → blockscout API tools
    igra-fervent.json          → Fervent Finance tools
    igra-explorer.json         → Igra explorer tools

  The chat API dynamically loads tools from the registry based on user's connected chain(s). New protocols = new config files + adapter code, zero changes to core.

  Optimizes for: extensibility, community contributions (others could write adapters), clean boundaries

  ---
  The Explorer Question Specifically

  Across all directions, one thing is clear: explorer/blockchain data is a chain-level capability, not a protocol-level one. Every EVM L2 will have a Blockscout (or similar)
  explorer. So the transaction history tool should be:
  - Parameterized by chain (explorer URL, API path)
  - Not tied to ZealousSwap at all
  - Capable of labeling known contracts (Router, MasterChef, etc.) with human-readable names per chain



  Honest take: Direction 3 (Chain-First Vertical Slices), with Direction 2 as your north star vision.                                                                              
  Here's why:                                                                                                                                                                      
  You have 1 chain and 1 protocol right now. Building adapter interfaces, registries, or resolvers before you have a second concrete implementation is a trap. You'll guess wrong    about what the right abstraction is. Every time.

  The rule is: duplication is far cheaper than the wrong abstraction. You need to see the real patterns emerge from 2-3 actual implementations before you extract them.

  The practical path:

  1. Now — Keep building on Kasplex. Add features like tx history. Start organizing code slightly better (move toward lib/chains/kasplex/ structure) but don't over-architect.
  2. When Igra Labs drops — Build the second vertical slice. You'll copy some patterns from Kasplex, adapt them. You'll immediately see what's truly shared (explorer API calls,
  swap interfaces) vs. what's protocol-specific (contract ABIs, farm mechanics).
  3. After 2 chains work — NOW you extract the common patterns. The adapter interfaces write themselves because you have real examples. You naturally evolve toward Direction 1 or
  2 with confidence.

  Why not the others right now:
  - Direction 1/5 — You'd be designing interfaces for protocols you haven't integrated yet. You'll refactor them when reality hits.
  - Direction 2 — Beautiful end-state, but you need the building blocks first.
  - Direction 4 — Phase 2+ vision, not an architecture decision for today.

  For transaction history specifically: it's a chain-level feature (every EVM L2 has Blockscout). Build it parameterized by explorer URL so it works on any chain — that's the one
  thing worth abstracting now because you know it'll be identical across L2s.