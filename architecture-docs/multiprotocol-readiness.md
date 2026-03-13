Assessment: No

  The codebase cannot support a second protocol without refactoring. Here's why, and what the minimal fix is.                                                                      
  ---                                                                                                                                                                                The 5 Structural Blockers
                                                                                                                                                                                     ┌─────────────────────┬─────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │       Blocker       │                  Where                  │                                               Why it breaks                                                │     ├─────────────────────┼─────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Single factory      │ useAllPairs, token-registry.ts          │ A second DEX's pairs are invisible — tokens, LP positions, and routing all miss them                       │
  ├─────────────────────┼─────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Single MasterChef   │ useActiveFarms, useFarmPositions        │ A second farm source's pools don't exist in the portfolio                                                  │
  ├─────────────────────┼─────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────┤     │ Fixed 3-pool        │ useInfinityPoolData, staking tools,     │ Can't represent a different staking product at all — the shape is hardcoded                                │
  │ staking             │ cards                                   │                                                                                                            │     ├─────────────────────┼─────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ WKAS-only routing   │ helpers.ts, oracle.ts, yield.ts         │ Pricing and swap paths break for tokens that only have liquidity on the new protocol                       │     ├─────────────────────┼─────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Flat tool dispatch  │ ToolPartRenderer, tool names, cards     │ Tool names like prepareSwap are globally unique — a second protocol's swap tool collides or needs a        │     │                     │                                         │ different name                                                                                             │
  └─────────────────────┴─────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   
  These aren't naming issues — they're structural. You can't just add files alongside the existing ones; the existing code actively assumes it's the only source.                  
  ---                                                                                                                                                                                Minimal Prep Work — 7 Changes

  The goal: make shared layers protocol-aware without building a framework. Each protocol keeps its own tool modules, ABIs, and execution cards. The shared infrastructure just
  stops assuming there's only one.                                                                                                                                                 
  ---                                                                                                                                                                                1. Protocol config object (config/protocols.ts) — NEW FILE

  Right now CONTRACTS is a flat bag of addresses. Add a typed protocol config so each protocol is self-describing.
                                                                                                                                                                                     // config/protocols.ts
  export interface ProtocolConfig {                                                                                                                                                    id: string;                          // "zealous" | "newdex"
    name: string;                        // "ZealousSwap"                                                                                                                              factory?: `0x${string}`;            // for pair discovery
    router?: `0x${string}`;             // for swaps
    masterChef?: `0x${string}`;         // for farms                                                                                                                                   wrappedNative: `0x${string}`;       // WKAS
    stakingPools?: {                                                                                                                                                                     name: string;
      address: `0x${string}`;                                                                                                                                                            abi: any;
      tokenSymbol: string;
      xTokenFn: string;
    }[];                                                                                                                                                                             }
                                                                                                                                                                                     export const PROTOCOLS: ProtocolConfig[] = [
    {
      id: "zealous",
      name: "ZealousSwap",
      factory: CONTRACTS.FACTORY,
      router: CONTRACTS.ROUTER,
      masterChef: CONTRACTS.MASTER_CHEF,                                                                                                                                                 wrappedNative: CONTRACTS.WKAS,
      stakingPools: [                                                                                                                                                                      { name: "ZEAL", address: CONTRACTS.INFINITY_POOL_ZEAL,
          abi: infinityPoolZealAbi, tokenSymbol: "ZEAL", xTokenFn: "xZealToken" },
        // ... NACHO, KASPER                                                                                                                                                             ],
    },                                                                                                                                                                                 // second protocol goes here — same shape, different addresses
  ];                                                                                                                                                                               
  config/contracts.ts stays unchanged — ZealousSwap tools keep importing from it. The new file is for shared layers that need to iterate over protocols.                           
  What this unblocks: Every layer below can loop over PROTOCOLS instead of hardcoding one source.                                                                                  
  ---                                                                                                                                                                                2. Token registry accepts multiple factories (lib/token-registry.ts)

  Current code:
  // reads from single CONTRACTS.FACTORY                                                                                                                                             const pairCount = await client.readContract({
    address: CONTRACTS.FACTORY, ...
  });
                                                                                                                                                                                     Change: accept an array of factory addresses, union the results, deduplicate.
                                                                                                                                                                                     export async function getDiscoveryData(
    factories?: `0x${string}`[]                                                                                                                                                      ) {
    const sources = factories ?? PROTOCOLS
      .filter(p => p.factory)                                                                                                                                                            .map(p => p.factory!);
                                                                                                                                                                                       // for each factory: read allPairsLength, enumerate pairs                                                                                                                          // union all pairs, deduplicate tokens (same WKAS-liquidity logic)
  }
                                                                                                                                                                                     Scope: ~30 lines changed in one file. The client-side useTokenRegistry hook similarly passes useAllPairs results from multiple factories.                                                                                                                                                                                                                             ---                                                                                                                                                                                3. Discovery hooks accept addresses as params

  The 3 discovery hooks hardcode their contract address. Make each accept an optional override:
                                                                                                                                                                                     useAllPairs(options?: { factory?, enabled? })                                                                                                                                      // Before
  const { data: pairCount } = useReadContract({                                                                                                                                        address: CONTRACTS.FACTORY, ...
  });
                                                                                                                                                                                     // After — default preserved, override available                                                                                                                                   const factory = options?.factory ?? CONTRACTS.FACTORY;                                                                                                                           
  useActiveFarms(options?: { masterChef?, enabled? }) — same pattern
                                                                                                                                                                                     useInfinityPoolData(pools?: StakingPoolConfig[]) — instead of hardcoded 3, accept the array from protocol config. Falls back to ZealousSwap's 3 pools if no arg.                                                                                                                                                                                                      Scope: ~10 lines per hook. Existing callers don't break (defaults match current behavior).                                                                                       
  ---                                                                                                                                                                                4. Portfolio aggregator unions multiple sources

  usePortfolio currently calls each wallet hook once. It needs to call them per-protocol and merge:
                                                                                                                                                                                     // Pseudocode — not a framework, just a loop
  const allLpPositions = PROTOCOLS                                                                                                                                                     .filter(p => p.factory)
    .flatMap(p => useLpPositions({ factory: p.factory }));                                                                                                                         
  const allFarmPositions = PROTOCOLS                                                                                                                                                   .filter(p => p.masterChef)
    .flatMap(p => useFarmPositions({ masterChef: p.masterChef }));
                                                                                                                                                                                     const allStakingPositions = PROTOCOLS
    .flatMap(p => useStakingPositions(p.stakingPools ?? []));
                                                                                                                                                                                     Caveat: React hooks can't be called in loops. The practical implementation is one of:                                                                                              - Option A: Each protocol gets its own useZealousPositions() / useNewDexPositions() hook, and usePortfolio calls both. This is the simplest — no abstraction, just two calls.      - Option B: A useMultiProtocolPositions(protocols) hook that does a single large multicall. Cleaner but more work.                                                               
  Recommendation: Option A for now. It's 2 protocols — explicit is fine.
                                                                                                                                                                                     ---
  5. Tool modules stay per-protocol, tool names get namespaced                                                                                                                     
  Don't abstract tools. Each protocol gets its own tool directory:
                                                                                                                                                                                     lib/ai/tools/
    zealous/          ← renamed from current flat files
      swap.ts
      liquidity.ts
      farms.ts
      staking.ts                                                                                                                                                                       newprotocol/      ← second protocol's tools
      swap.ts                                                                                                                                                                            lending.ts
    shared/           ← helpers used by both
      helpers.ts                                                                                                                                                                         oracle.ts
    index.ts          ← merges both
                                                                                                                                                                                     Tool names get a prefix to avoid collision:                                                                                                                                        - zealous_prepareSwap instead of prepareSwap                                                                                                                                       - newdex_prepareLend for the new protocol                                                                                                                                        
  index.ts merges:
  export const aiTools = { ...zealousTools, ...newProtocolTools, ...sharedTools };                                                                                                 
  Scope: Rename existing tool names (with a find-replace) and move files into zealous/ subdirectory. Existing logic untouched.
                                                                                                                                                                                     ---
  6. ToolPartRenderer gets a registry instead of a switch                                                                                                                          
  Current 16-case switch is the main UI bottleneck. Replace with a map:
                                                                                                                                                                                     // Before: 16-case switch
  switch (toolName) {                                                                                                                                                                  case "getSwapQuote": return <SwapQuoteCard ... />;
    ...                                                                                                                                                                              }
                                                                                                                                                                                     // After: registry object
  const TOOL_CARD_REGISTRY: Record<string, React.ComponentType<any>> = {
    zealous_getSwapQuote: SwapQuoteCard,
    zealous_prepareSwap: SwapExecutionCard,
    // ... all zealous tools
    newdex_prepareLend: LendCard,                                                                                                                                                      // ... new protocol tools
  };
                                                                                                                                                                                     const Card = TOOL_CARD_REGISTRY[toolName];
  if (Card) return <Card data={output} ... />;
  return <JsonFallback ... />;                                                                                                                                                     
  Scope: Same file, same logic — just a data structure instead of control flow. New protocols add entries without touching the router.                                             
  ---                                                                                                                                                                                7. System prompt becomes composable

  Current buildSystemPrompt has one giant template. Split into:
                                                                                                                                                                                     async function buildSystemPrompt(portfolio, pools) {
    return [
      buildIdentityBlock(),          // "You are KasAgent..." (static)
      buildProtocolBlocks(),         // one block per protocol (semi-static)
      buildWalletContext(portfolio, pools),  // user positions (dynamic)
    ];                                                                                                                                                                               }
                                                                                                                                                                                     function buildProtocolBlocks() {
    return PROTOCOLS.map(p => ({
      role: "system",                                                                                                                                                                    content: `### ${p.name}\n- Router: ${p.router}\n- Factory: ${p.factory}\n...`,
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    }));
  }                                                                                                                                                                                                                                                                                                                                                                     Each protocol's knowledge block is generated from its config + a protocol-specific description string (added to ProtocolConfig).                                                 
  Scope: Restructure the template string into sections. ZealousSwap's content stays identical — just extracted.                                                                    
  ---                                                                                                                                                                                What This Does NOT Include (intentionally)

  - No generic execution card abstraction — ZealousSwap cards keep their ABI imports. A new protocol writes its own cards. Duplication of card boilerplate (approve → execute →
  success) is fine for 2 protocols.                                                                                                                                                  - No multi-chain — stays on Kasplex L2. Chain abstraction is a separate effort.
  - No dynamic ABI loading — ABIs stay as static imports. Good enough for known protocols.
  - No protocol auto-discovery — protocols are manually registered in PROTOCOLS[]. You know which protocols you're integrating.
                                                                                                                                                                                     ---
  Execution Order                                                                                                                                                                  
  If you want to do this incrementally:
                                                                                                                                                                                     ┌──────┬───────────────────────────────────────────────┬───────────────────────────────────────────────────────────┬─────────────────────────┐                                     │ Step │                    Change                     │                           Risk                            │         Touches         │
  ├──────┼───────────────────────────────────────────────┼───────────────────────────────────────────────────────────┼─────────────────────────┤                                     │ 1    │ Create config/protocols.ts                    │ None — additive                                           │ 1 new file              │
  ├──────┼───────────────────────────────────────────────┼───────────────────────────────────────────────────────────┼─────────────────────────┤
  │ 2    │ Namespace tool names (zealous_* prefix)       │ Medium — touches tools + ToolPartRenderer + quick-actions │ ~10 files, find-replace │
  ├──────┼───────────────────────────────────────────────┼───────────────────────────────────────────────────────────┼─────────────────────────┤                                     │ 3    │ ToolPartRenderer → registry map               │ Low — same behavior                                       │ 1 file                  │
  ├──────┼───────────────────────────────────────────────┼───────────────────────────────────────────────────────────┼─────────────────────────┤                                     │ 4    │ Discovery hooks accept params                 │ Low — defaults preserve current behavior                  │ 3 hooks                 │
  ├──────┼───────────────────────────────────────────────┼───────────────────────────────────────────────────────────┼─────────────────────────┤                                     │ 5    │ Token registry accepts multiple factories     │ Low-Medium — needs testing                                │ 1-2 files               │
  ├──────┼───────────────────────────────────────────────┼───────────────────────────────────────────────────────────┼─────────────────────────┤                                     │ 6    │ Portfolio aggregator calls per-protocol hooks │ Medium — new hook composition                             │ 1-2 files               │
  ├──────┼───────────────────────────────────────────────┼───────────────────────────────────────────────────────────┼─────────────────────────┤                                     │ 7    │ System prompt composable blocks               │ Low — string restructure                                  │ 1 file                  │
  └──────┴───────────────────────────────────────────────┴───────────────────────────────────────────────────────────┴─────────────────────────