 CONFIG LAYER — 100% Protocol-Specific                                                                                                                                            
  config/contracts.ts
                                                                                                                                                                                     All 10 addresses are ZealousSwap-specific. No protocol registry or abstraction.                                                                                                                                                                                                                                                                                       ┌───────────────────────────────────────────┬──────────────────────────────────────────────────────────────────┐                                                                   │                 Constant                  │                             Coupling                             │
  ├───────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤                                                                   │ ROUTER                                    │ ZealousSwap Router02 (UniV2 fork)                                │
  ├───────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ FACTORY                                   │ ZealousSwap Factory — assumed as the only pair source everywhere │
  ├───────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤                                                                   │ MASTER_CHEF                               │ ZealousSwap farming — assumed as the only farm source            │
  ├───────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤                                                                   │ INFINITY_POOL_ZEAL/NACHO/KASPER           │ 3 hardcoded pools — no dynamic pool discovery                    │
  ├───────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤                                                                   │ WKAS                                      │ Assumed as the only intermediary/bridge token                    │
  ├───────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤                                                                   │ DISCOUNT_MANAGER, MEMBERSHIP, NFT_STAKING │ ZealousSwap loyalty program                                      │
  └───────────────────────────────────────────┴──────────────────────────────────────────────────────────────────┘                                                                 
  config/tokens.ts                                                                                                                                                                 
  - TOKEN_LOGOS maps 4 addresses: WKAS, ZEAL, NACHO, KASPER — hardcoded to ZealousSwap tokens                                                                                      
  config/abis/*.ts                                                                                                                                                                 
  - 11 ABI files. Variable names embed token names: infinityPoolZealAbi, infinityPoolNachoAbi, infinityPoolKasperAbi                                                                 - ABIs themselves are generic EVM patterns, but naming + exports lock to ZealousSwap
                                                                                                                                                                                     ---
  HOOKS LAYER — Structural Single-Source Assumptions
                                                                                                                                                                                     hooks/useAllPairs.ts (lines 25, 43)
                                                                                                                                                                                     - Reads from single CONTRACTS.FACTORY — misses any non-ZealousSwap pairs                                                                                                         
  hooks/useActiveFarms.ts (lines 33-50, 81)                                                                                                                                        
  - Reads from single CONTRACTS.MASTER_CHEF — getActivePools(), getPoolInfo(pid) hardcoded                                                                                         
  hooks/useInfinityPoolData.ts (lines 27-115) — MOST HARDCODED HOOK                                                                                                                
  - 3 pools hardcoded by address AND name: "ZEAL", "NACHO", "KASPER"                                                                                                                 - Adding a 4th pool requires modifying this file
  - Returns array of exactly 3 InfinityPoolInfo objects
                                                                                                                                                                                     hooks/useTokenRegistry.ts (lines 16, 25-31, 71-96)                                                                                                                                                                                                                                                                                                                    - CONTRACTS.WKAS used as the dedup key — tokens without WKAS pairs get lower priority                                                                                              - Inherits single-factory assumption from useAllPairs
                                                                                                                                                                                     hooks/useStakingPositions.ts (line 19)                                                                                                                                           
  - Inherits 3-pool hardcoding from useInfinityPoolData                                                                                                                            
  hooks/useFarmPositions.ts (lines 36, 42, 48)                                                                                                                                     
  - 3 calls hardcoded to CONTRACTS.MASTER_CHEF                                                                                                                                     
  hooks/useLpPositions.ts (line 22)                                                                                                                                                
  - Inherits single-factory from useAllPairs                                                                                                                                       
  hooks/useTokenBalances.ts (line 18)                                                                                                                                              
  - Inherits single-factory from useTokenRegistry                                                                                                                                  
  hooks/usePortfolio.ts                                                                                                                                                            
  - Clean aggregator — but propagates all coupling from sub-hooks                                                                                                                  
  ---                                                                                                                                                                                LIB LAYER — Registry & Discount Coupling
                                                                                                                                                                                     lib/token-registry.ts (lines 31, 47, 71, 96-102)
                                                                                                                                                                                     - Single CONTRACTS.FACTORY as token source                                                                                                                                         - WKAS as canonical dedup key — same logic as client-side registry
                                                                                                                                                                                     lib/discount.ts (line 15)
                                                                                                                                                                                     - Single CONTRACTS.DISCOUNT_MANAGER — ZealousSwap loyalty program                                                                                                                
  lib/viem-client.ts (line 13)                                                                                                                                                     
  - Single kasplexL2 chain — no multi-chain                                                                                                                                        
  ---                                                                                                                                                                                AI TOOLS LAYER — Deepest Protocol Coupling

  lib/ai/tools/helpers.ts (lines 16-48)
                                                                                                                                                                                     - findBestPath() hardcodes WKAS as the only intermediary — direct pair → WKAS hop → fail                                                                                           - Uses single CONTRACTS.ROUTER for all getAmountsOut calls
                                                                                                                                                                                     lib/ai/tools/swap.ts                                                                                                                                                                                                                                                                                                                                                  - Line 26: Description says "ZealousSwap"                                                                                                                                          - Lines 163-168: Fee model hardcoded: 0.003 standard, 0.002 discount
  - Lines 248-250: Contract descriptions reference "ZealousSwap Router"
                                                                                                                                                                                     lib/ai/tools/liquidity.ts (lines 23, 90, 239, 284, 375)                                                                                                                                                                                                                                                                                                               - 5 string literals mentioning "ZealousSwap" in tool/contract descriptions                                                                                                       
  lib/ai/tools/farms.ts (lines 17, 89, 195, 212, 307)                                                                                                                              
  - Tool descriptions hardcode "ZealousSwap MasterChef"                                                                                                                              - Contract info strings reference MasterChef farm pools
                                                                                                                                                                                     lib/ai/tools/staking.ts — CRITICAL

  - Lines 76-80, 170-174: Two hardcoded poolMap objects mapping only ZEAL/NACHO/KASPER → address + ABI                                                                               - Lines 84, 178: Error messages say "Supported: ZEAL, NACHO, KASPER"
  - Lines 18, 67, 161: Descriptions mention "ZealousSwap InfinityPool"
                                                                                                                                                                                     lib/ai/tools/yield.ts (lines 69-76, 149, 267-309, 366)                                                                                                                           
  - Hardcoded reads for exactly 3 InfinityPools                                                                                                                                      - WKAS as sole pricing anchor
  - ZEAL-specific emission logic vs NACHO/KASPER fee-based logic hardcoded separately
                                                                                                                                                                                     lib/ai/tools/history.ts (lines 15-51)                                                                                                                                            
  - Method selector → label map hardcodes ZealousSwap function sigs                                                                                                                  - Contract address → label map: "ZealousSwap Router", "ZealousSwap Factory", "ZEAL InfinityPool", etc.
                                                                                                                                                                                     lib/ai/tools/oracle.ts (lines 45, 49)                                                                                                                                            
  - Prices only through WKAS pairs — "No WKAS pair found" error if none exists                                                                                                     
  lib/ai/tools/spy.ts (lines 27-46)                                                                                                                                                
  - INFINITY_POOLS constant: hardcoded array of 3 pools with names, addresses, ABIs                                                                                                
  lib/ai/tools/membership.ts (line 12)

  - Description: "ZealousSwap discount eligibility"                                                                                                                                
  ---
  AI PROMPT LAYER — Identity & Knowledge
                                                                                                                                                                                     lib/ai/system-prompt.ts

  - Line 7: Agent identity: "navigate the ZealousSwap DEX ecosystem"                                                                                                                 - Lines 51-60: ### ZealousSwap Contracts section with all 10 addresses labeled
  - Lines 62-69: Feature descriptions hardcode: "ZealousSwap DEX", "MasterChef", "InfinityPools", "ZEAL/NACHO/KASPER", emission rules per pool, WKAS wrapping
  - Line 68: Fee structure: 0.3% → 0.2% with membership/NFT/xZEAL
  - Line 69: ZEAL tokenomics (240M supply, distribution breakdown)
  - Line 146: "fee-based InfinityPools (NACHO, KASPER)" + "2s block time"
                                                                                                                                                                                     lib/ai/serializers.ts (line 108)                                                                                                                                                 
  - zealPerBlock field name hardcoded in InfinityPool serialization                                                                                                                
  lib/ai/tool-types.ts (lines 40, 280, 413)                                                                                                                                        
  - zealPerBlock field appears in 2 interfaces                                                                                                                                       - SpyStakingPosition.pool comment: "ZEAL" | "NACHO" | "KASPER"
                                                                                                                                                                                     lib/ai/quick-actions.ts (lines 7-22)                                                                                                                                             
  - ACTION_TOOLS set: 14 ZealousSwap-specific tool names                                                                                                                           
  ---                                                                                                                                                                                COMPONENT LAYER — Execution Cards & Routing

  components/chat/ToolPartRenderer.tsx (lines 76-119) — CRITICAL SEAM
                                                                                                                                                                                     - Switch statement routes exactly 16 tool names to card components                                                                                                                 - No dynamic registration — adding a new protocol tool requires editing this file
                                                                                                                                                                                     components/chat/cards/SwapExecutionCard.tsx (lines 6, 57, 65, 78)                                                                                                                
  - Imports routerAbi, calls swapExactKASForTokens, swapExactTokensForKAS, swapExactTokensForTokens                                                                                
  components/chat/cards/AddLiquidityCard.tsx (lines 6, 83, 91)                                                                                                                     
  - Imports routerAbi, calls addLiquidityKAS, addLiquidity                                                                                                                         
  components/chat/cards/RemoveLiquidityCard.tsx (lines 6, 62, 69)                                                                                                                  
  - Imports routerAbi, calls removeLiquidityKAS, removeLiquidity                                                                                                                   
  components/chat/cards/FarmStakeCard.tsx (lines 6, 50-52)                                                                                                                         
  - Imports masterchefAbi, calls deposit(pid, amount)                                                                                                                              
  components/chat/cards/FarmUnstakeCard.tsx (lines 6, 36-38)                                                                                                                       
  - Imports masterchefAbi, calls withdraw(pid, amount)                                                                                                                             
  components/chat/cards/InfinityStakeCard.tsx (lines 6, 20-24, 56)                                                                                                                 
  - Hardcoded poolAbis map: { ZEAL, NACHO, KASPER } → ABI, fallback to infinityPoolZealAbi                                                                                         
  components/chat/cards/InfinityUnstakeCard.tsx (lines 6, 20-24, 56)                                                                                                               
  - Identical hardcoded poolAbis map                                                                                                                                               
  components/sidebar/PortfolioSidebar.tsx (lines 268, 293, 324)                                                                                                                    
  - Section titles: "InfinityPool Rates", "Staking", Pool #{fp.pid} (MasterChef)                                                                                                   
  components/chat/WelcomeScreen.tsx (lines 8-22)                                                                                                                                   
  - Suggestion text assumes only ZealousSwap features exist                                                                                                                        
  components/header/NetworkStatus.tsx

  - Checks chainId === 202555 for "Kasplex L2" green status                                                                                                                        
  ---
  COUPLING HEAT MAP

                     Single    Single     3-Pool    WKAS      "ZealousSwap"
                     Factory   MasterChef Fixed     Bridge    String Literals
                     ───────   ──────────  ──────   ──────    ──────────────
  config/             ●                     ●        ●
  hooks/              ●         ●           ●        ●                                                                                                                               lib/token-registry  ●                              ●
  lib/ai/tools/       ●         ●           ●        ●         ● (12 instances)
  lib/ai/prompt                             ●                  ● (8+ instances)
  lib/ai/types                              ●
  components/cards                          ●
  ToolPartRenderer    ────────── 16 fixed tool names ──────────
                                                                                                                                                                                     Total hardcoding points: ~85+ across 35 files.                                                                                                                                   
  The structural couplings (single factory, single MasterChef, 3 fixed pools, WKAS-only routing) are the hardest to refactor. The string literals ("ZealousSwap") are easy to        parameterize. The ToolPartRenderer switch and poolMap objects in staking tools are the critical seams where multi-protocol support would need to plug in.