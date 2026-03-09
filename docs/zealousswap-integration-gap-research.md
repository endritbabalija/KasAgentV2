Research Report: ZealousSwap Integration Gaps

  I've read all three docs and cross-referenced them against the actual codebase. Here's the full picture.

  ---
  1. Gap Verification — All Gaps Are Real

  Fee Discount Detection — CONFIRMED
  - lib/ai/tools/helpers.ts hardcodes false in both getAmountsOut calls (direct path and WKAS multi-hop)
  - swap.ts hardcodes 0.003 (0.3%) per hop for fee calculation — never queries on-chain fee tier
  - No DiscountManager ABI, no address in config/contracts.ts, no discount check anywhere in the codebase
  - Users with NFT staking or memberships are getting incorrect quotes right now

  Memberships — CONFIRMED
  - Zero mention of membership anywhere in hooks, tools, or config
  - No Membership ABI, no NFT Staking ABI, no addresses defined

  Spy Mode — CONFIRMED
  - Every wallet hook (useLpPositions, useFarmPositions, useStakingPositions, useTokenBalances) only uses useAccount().address — no parameter for arbitrary addresses
  - The server-side tools could query any address via viem, but none currently accept an arbitrary address parameter

  TWAP / Token Prices — CONFIRMED
  - No getTokenPrice tool exists
  - Pair ABI is missing price0CumulativeLast() / price1CumulativeLast()
  - Spot price could be derived from getReserves() which we already read, but no tool exposes it

  Missing Router Functions — CONFIRMED
  - Router ABI has 3 swap functions; zealous-info.md documents 9 total (+ 3 fee-on-transfer variants)
  - Critically missing: swapExactTokensForKAS — we only have swapTokensForExactKAS. This means selling a token for KAS uses the wrong function (exact-output instead of
  exact-input), which is a UX issue

  ZEAL Tokenomics — CONFIRMED
  - System prompt has no ZEAL token knowledge

  ---
  2. Contract Addresses — All Correct

  Every address in config/contracts.ts matches zealous-info.md exactly:
  - Router, Factory, MasterChef, 3 InfinityPools, WKAS — all 7 match
  - New addresses in zealous-info.md (DiscountManager, NFT Staking, Membership, NACHO KAT NFT) are not yet in the codebase — expected since they're part of the gaps

  ---
  3. Things I'd Flag or Change

  A. swapExactTokensForKAS is more urgent than the docs suggest

  The feature-coverage doc lists missing Router functions as "LOW-MEDIUM" priority. But swapExactTokensForKAS is the natural function for "sell X ZEAL for KAS" — the most common
  swap direction. We currently use swapTokensForExactKAS which requires the user to specify an exact output amount, not input. The swap tool works around this by using
  getAmountsOut to estimate output, but it's semantically wrong and could cause unnecessary reverts with slippage. I'd bump this to Phase 1 alongside discount detection.

  B. Yield APY doesn't hardcode 0.3% — but it probably should factor in fees

  The doc says yield.ts uses 0.3% for APY. Actually, yield.ts calculates farm APY purely from emission rewards (rewardPerBlock × BLOCKS_PER_YEAR), not from trading fees. The
  NACHO/KASPER InfinityPools return null APY with "fee-based" label. This is technically correct — but if we add discount detection, the yield tool should mention whether the user
   gets discounted trading fees (affects LP fee income indirectly). The architecture doc already accounts for this.

  C. The architecture doc's Phase 3 (Spy Mode) is truly independent

  Confirmed — spy mode needs zero changes to existing code. It's a pure addition: new tool + new card + registration. Could run in parallel with Phase 1 or 2.

  D. Membership purchase ABI is a real blocker

  The docs correctly flag this. We have hasActiveMembership and getUserMembership (read functions), but without the purchase function signature we can't build a buy flow.
  Read-only membership status is still valuable on its own though.

  E. Query contract address TBD is fine to defer

  Current approach (per-pair multicall) works. The chain is young with few pairs. This only matters at scale.

  ---
  4. Recommendation: Start with Phase 1, but include swapExactTokensForKAS

  Phase 1 (Discount Detection + Router Fix) is the right starting point because:

  1. Highest user-facing impact — every swap quote is currently wrong for discount-eligible users
  2. Smallest change surface — touches existing files only (no new cards needed)
  3. Foundation for Phase 2 — discount check is reused by membership status tool
  4. Adding swapExactTokensForKAS to the Router ABI is a 2-line addition that fixes a real correctness issue in the swap path selection

  Concrete Phase 1 scope:
  1. New file: config/abis/discountManager.ts (4 functions)
  2. New file: lib/discount.ts (check helper)
  3. Edit: config/contracts.ts — add DISCOUNT_MANAGER address
  4. Edit: config/abis/index.ts — re-export
  5. Edit: config/abis/router.ts — add swapExactTokensForKAS + factory() + quote()
  6. Edit: lib/ai/tools/helpers.ts — accept + pass isDiscountEligible param
  7. Edit: lib/ai/tools/swap.ts — call checkDiscountEligibility(), show fee tier in result, use correct swap function for TOKEN→KAS
  8. Edit: lib/ai/tools/yield.ts — mention discount status
  9. Edit: lib/ai/system-prompt.ts — add discount status to wallet context + ZEAL tokenomics
