# ZealousSwap Feature Coverage

What KasAgent currently integrates vs what ZealousSwap offers.
Last updated: 2025-03-09

---

## Fully Integrated

| Feature | Status | Files |
|---|---|---|
| Swaps (multi-hop via WKAS) | Done | swap.ts, SwapQuoteCard, SwapExecutionCard |
| Pools / Liquidity (add, remove, reserves) | Done | liquidity.ts, AddLiquidityCard, RemoveLiquidityCard, PoolReservesCard |
| Farms / MasterChef (stake, unstake, rewards) | Done | farms.ts, FarmStakeCard, FarmUnstakeCard, FarmsTableCard |
| InfinityPools (ZEAL, NACHO, KASPER) | Done | staking.ts, InfinityStakeCard, InfinityUnstakeCard, InfinityPoolRatesCard |
| Yield Discovery + APY calculation | Done | yield.ts, YieldOpportunitiesCard |
| Dynamic token discovery from Factory | Done | token-registry.ts, useTokenRegistry.ts |
| Transaction History (Blockscout) | Done | history.ts, TransactionHistoryCard |

---

## Gaps to Build

### 1. Fee Discount Detection — HIGH VALUE

**Problem**: Every Router call passes `isDiscountEligible: false`. Users with NFT staking or memberships see worse quotes than they'd actually get on-chain.

**Contracts discovered**:
- DiscountManager: `0x3da82fa26d8756a557e475cfb2ee854937618e83`
- Single call: `isDiscountEligible(user) -> bool`
- Richer call: `getDiscountEligibilitySource(user) -> (bool, "NFT" | "Token" | "Membership" | "None")`

**What to build**:
- Server-side discount check via DiscountManager
- Pass result to all `getAmountsOut` / `getAmountsIn` calls
- Show discount status in swap quotes and system prompt wallet context
- Update fee calculation in yield discovery (0.2% instead of 0.3% for eligible users)

**Scope**: Edits to existing swap/yield tools + new discount helper. No new UI cards needed — info surfaces in existing cards.

---

### 2. Memberships — HIGH VALUE

**Problem**: Users can't check or buy memberships through KasAgent. Membership gives 33% fee discount + Spy Mode access.

**Contract discovered**: `0x8b32421d78a066f52035c242513055ed15047ee6`
- `hasActiveMembership(user) -> bool`
- `getUserMembership(user) -> (expiresAt, isLifetime, isActive)`

**What to build**:
- AI tool: `getMembershipStatus` — check if user has active membership, show expiry/tier
- AI tool: `prepareBuyMembership` — approve ZEAL + purchase (if we find the buy function ABI)
- UI: MembershipStatusCard (read-only) + BuyMembershipCard (execution)
- System prompt: include membership status in wallet context

**Blocker**: We have the read interface (hasActiveMembership, getUserMembership) but need the full Membership contract source or ABI for the purchase function. The IMembership interface only exposes view functions.

---

### 3. Spy Mode (Wallet Watching) — MEDIUM-HIGH VALUE

**Problem**: Users can't inspect other wallets. Our on-chain read logic already works for any address — we just never expose it.

**No new contracts needed** — uses existing Factory, Pair, MasterChef, InfinityPool contracts.

**What to build**:
- AI tool: `spyOnWallet` — takes any address, returns full portfolio snapshot (balances, LPs, farms, staking)
- Server-side: reuse same viem reads as existing hooks but for arbitrary address
- UI: SpyPortfolioCard — read-only portfolio view, no action buttons
- Natural language: "show me what 0xABC... holds", "spy on this wallet"

**Scope**: New tool + new card. Clean addition, no edits to existing code.

---

### 4. TWAP Oracle / Token Prices — MEDIUM VALUE

**Problem**: AI can't answer "what's the current ZEAL price?" without doing a full swap quote. Pair contracts already store cumulative price data.

**No new contracts needed** — uses existing Pair contracts.
- `price0CumulativeLast()`, `price1CumulativeLast()` — already on every pair
- Spot price derivable from `getReserves()` (which we already read)

**What to build**:
- AI tool: `getTokenPrice` — spot price from reserves + optional TWAP from cumulative data
- UI: PriceCard — shows token price, pair liquidity depth
- Extend pair ABI with cumulative price functions

**Scope**: New tool + new card + ABI extension. Small addition.

---

### 5. Missing Router Functions — LOW-MEDIUM VALUE

**Problem**: Our Router ABI is incomplete. Missing functions that may be needed for edge cases.

**Missing**:
- `swapExactTokensForKAS` — needed when user wants to sell exact token amount for KAS
- `swapKASForExactTokens`, `swapTokensForExactTokens` — "buy exactly X" flows
- `*SupportingFeeOnTransferTokens` — needed if any token on Kasplex has transfer fees
- `quote()`, `getAmountOut(fee)`, `getAmountIn(fee)`, `factory()`

**What to build**:
- Add missing functions to `config/abis/router.ts`
- Update swap tool to use `swapExactTokensForKAS` where appropriate
- Fee-on-transfer support can wait unless a token needs it

**Scope**: ABI additions + minor swap tool edits.

---

### 6. ZealousSwapQuery Aggregator — OPTIMIZATION

**Problem**: Our hooks make many individual RPC calls. The Query contract batches them into single calls.

**Contract**: Address TBD (deployed but not yet discovered).

**What it could replace**:
- `useAllPairs` 3-step cascade -> `getAllPools(factory)` single call
- `useLpPositions` per-pair balanceOf -> `getUserLiquidityPools(user, factory)` single call
- `useFarmPositions` per-pool reads -> `getFarmInfoForUser(user, farms)` single call
- `useStakingPositions` per-pool reads -> individual pool info calls

**Priority**: Low for now. Current approach works. Revisit when pair count grows large or RPC rate limits become an issue. Need to find the deployed address first.

---

### 7. ZEAL Tokenomics Knowledge — LOW (prompt-only)

**Problem**: AI doesn't know ZEAL token details (240M supply, vesting, utility).

**What to build**: Add to `lib/ai/system-prompt.ts` static block. No on-chain integration.

**Scope**: One-line addition to system prompt.

---

## Not Integrating

| Feature | Reason |
|---|---|
| Flash Swaps | Requires custom smart contracts + callback logic. Not a chat UX feature. |
| Vote/Governance | "Coming soon" on ZealousSwap — not live yet. |
| Insurance Fund | Protocol treasury operations, not user-facing. |
| Protocol-Owned Liquidity | Protocol treasury operations, not user-facing. |
| FeeDistributor | Admin-only distribution trigger, not user-facing. |

---

## Implementation Priority

| # | Feature | Value | Effort | Blockers |
|---|---|---|---|---|
| 1 | Fee Discount Detection | High | Small | None — contracts found |
| 2 | Spy Mode | Medium-High | Small | None |
| 3 | Memberships (read) | High | Small | None for status check; purchase ABI TBD |
| 4 | TWAP / Token Prices | Medium | Small | None |
| 5 | Missing Router Functions | Low-Medium | Tiny | None |
| 6 | ZEAL Tokenomics (prompt) | Low | Tiny | None |
| 7 | Query Aggregator | Optimization | Medium | Need deployed address |
