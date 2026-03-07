Plan: Dynamic On-Chain Token Discovery

 Context

 KasAgent hardcodes 5 tokens in config/tokens.ts. Any token not in that list shows as "???". ZealousSwap has ~20-30 tokens. The goal: discover ALL tokens dynamically from the
 Factory contract so KasAgent automatically knows every tradeable token without manual updates.

 What Changes

 New Files (2)

 1. lib/token-registry.ts — Server-side token discovery (used by AI tools)
 - Reads Factory allPairsLength() + allPairs(i) to find all pair addresses
 - Reads token0(), token1() from each pair to collect unique token addresses
 - Reads ERC20 name(), symbol(), decimals() for each unique token
 - In-memory cache with 5-minute TTL (server process persists across requests)
 - Always includes KAS (native) and WKAS
 - Exports async helpers: resolveTokenAddress(), addressToSymbol(), getTokenDecimals(), getAllTokens()

 2. hooks/useTokenRegistry.ts — Client-side token discovery (used by UI)
 - Builds on existing useAllPairs hook (already reads Factory pairs)
 - Extracts unique token addresses from pairs
 - Batch-reads ERC20 metadata via useReadContracts
 - Returns tokens[], tokenMap, getTokenSymbol(), isLoading

 Modified Files (15)

 ┌─────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │                  File                   │                                                     Change                                                     │
 ├─────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ config/tokens.ts                        │ Remove KASPLEX_TOKENS array. Keep Token interface, add KAS_NATIVE constant and TOKEN_LOGOS address-to-logo map │
 ├─────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ lib/ai/tools/helpers.ts                 │ Remove sync lookup functions, re-export async versions from token-registry.ts                                  │
 ├─────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ lib/ai/tools/swap.ts                    │ Remove KASPLEX_TOKENS import, await helpers, remove hardcoded "Supported tokens" from tool descriptions        │
 ├─────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ lib/ai/tools/liquidity.ts               │ Same as swap.ts                                                                                                │
 ├─────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ lib/ai/tools/farms.ts                   │ Remove KASPLEX_TOKENS import, await addressToSymbol()                                                          │
 ├─────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ lib/ai/tools/yield.ts                   │ Replace KASPLEX_TOKENS with getAllTokens() for price derivation and symbol resolution                          │
 ├─────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ lib/ai/tools/history.ts                 │ Build token address map dynamically inside execute() instead of at module level                                │
 ├─────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ lib/ai/system-prompt.ts                 │ Make buildProtocolKnowledge() and buildSystemPrompt() async, use getAllTokens()                                │
 ├─────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ app/api/chat/route.ts                   │ await buildSystemPrompt()                                                                                      │
 ├─────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ lib/token-utils.ts                      │ Accept optional tokenMap parameter for symbol resolution                                                       │
 ├─────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ lib/ai/serializers.ts                   │ Accept symbol resolver function parameter                                                                      │
 ├─────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ hooks/useTokenBalances.ts               │ Use useTokenRegistry instead of KASPLEX_TOKENS to know which tokens to check                                   │
 ├─────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ hooks/usePortfolio.ts                   │ Minor wiring if needed                                                                                         │
 ├─────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ components/PortfolioDashboard.tsx       │ Use useTokenRegistry().getTokenSymbol instead of imported getTokenSymbol                                       │
 ├─────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ components/sidebar/PortfolioSidebar.tsx │ Same as PortfolioDashboard                                                                                     │
 └─────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

 Implementation Order

 Phase 1: config/tokens.ts refactor (KAS_NATIVE, TOKEN_LOGOS, remove KASPLEX_TOKENS)
 Phase 2: lib/token-registry.ts (new — server-side discovery)
 Phase 3: hooks/useTokenRegistry.ts (new — client-side discovery)
 Phase 4: AI tools layer (helpers, swap, liquidity, farms, yield, history, system-prompt, route)
 Phase 5: Client layer (token-utils, serializers, useTokenBalances, usePortfolio)
 Phase 6: Components (PortfolioDashboard, PortfolioSidebar)

 Key Design Decisions

 - Sync-to-async: resolveTokenAddress, addressToSymbol, getTokenDecimals become async. TypeScript will flag most missed awaits.
 - KAS native: Always injected manually (no on-chain contract). resolveTokenAddress("KAS") still returns WKAS address for routing.
 - Logos: Small TOKEN_LOGOS map for known tokens. Unknown tokens get no logo. Logos are the only thing that can't come from on-chain.
 - Cache: Server-side 5-minute TTL. Client-side uses wagmi's built-in query caching.
 - Scale: ~20-30 tokens = ~100 RPC calls on cold start, all parallelized. Negligible.
 - Tool descriptions: Remove hardcoded "Supported tokens: KAS, WKAS, ZEAL, NACHO, KASPER" — AI will see all discovered tokens in system prompt instead.

 Verification

 1. npm run build — TypeScript catches any missed async/sync issues
 2. Connect wallet, check that all ZealousSwap tokens appear in portfolio (not just 5)
 3. Ask the AI "what tokens can I swap?" — should list all discovered tokens
 4. Ask the AI to swap a token that was NOT in the old hardcoded list (e.g. KBOY, USDC)
 5. Check that LP positions show proper pair names (no more "???")
 6. Check yield discovery finds opportunities for all tokens