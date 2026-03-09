# ZealousSwap Integration Architecture

Concrete implementation plan for building the remaining ZealousSwap features into KasAgent.
Each section maps to the gaps in `zealousswap-feature-coverage.md`.
Last updated: 2025-03-09

---

## 1. Fee Discount Detection

**Goal**: Pass correct `isDiscountEligible` boolean to all Router calls.

### New Files

```
config/abis/discountManager.ts          — parseAbi for DiscountManager
```

ABI (minimal — only what we need):
```
isDiscountEligible(address user) view returns (bool)
getDiscountEligibilitySource(address user) view returns (bool, string)
nftStakingContract() view returns (address)
membershipContract() view returns (address)
```

```
lib/discount.ts                         — server-side discount check helper
```

Exports:
- `checkDiscountEligibility(address: string): Promise<{ isEligible: boolean; source: string }>`
- Uses shared viem client to call DiscountManager
- Cached per-address for duration of request (no persistent cache — eligibility can change)

### Edited Files

```
config/contracts.ts                     — add DISCOUNT_MANAGER address
config/abis/index.ts                    — re-export discountManagerAbi

lib/ai/tools/swap.ts                    — import checkDiscountEligibility
                                          pass result to getAmountsOut/getAmountsIn in findBestPath()
                                          include discount info in prepareSwap response
                                          show "Discounted fee: 0.2%" vs "Standard fee: 0.3%" in result

lib/ai/tools/yield.ts                   — use correct fee rate (0.2% vs 0.3%) per user in APY calc
                                          accept walletAddress param to check eligibility

lib/ai/system-prompt.ts                 — add discount status to wallet context block:
                                          "Fee discount: Active (source: Membership)" or "Fee discount: Not eligible"
```

### Data Flow

```
User sends chat message
  → chat route builds system prompt (includes discount status)
  → AI calls prepareSwap / getSwapQuote
    → swap tool calls checkDiscountEligibility(walletAddress)
    → passes boolean to Router.getAmountsOut(amount, path, isEligible)
    → returns quote with correct fee tier
```

---

## 2. Spy Mode (Wallet Watching)

**Goal**: Let users inspect any wallet's portfolio through chat.

### New Files

```
lib/ai/tools/spy.ts                     — spyOnWallet tool
```

Tool definition:
- **Name**: `spyOnWallet`
- **Params**: `{ walletAddress: string }`
- **Logic**:
  1. Validate address format
  2. Get all tokens from token registry (already cached server-side)
  3. Read native KAS balance via viem `getBalance()`
  4. Batch read ERC-20 balances via multicall
  5. Read LP positions: for each pair, read `balanceOf(targetAddress)`
  6. Read farm positions: for each active pool, read `userInfo(pid, targetAddress)` + `pendingReward`
  7. Read staking positions: for each InfinityPool xToken, read `balanceOf(targetAddress)`
  8. Format and return complete portfolio snapshot
- **Returns**: `{ address, balances[], lpPositions[], farmPositions[], stakingPositions[], discountStatus }`

```
components/chat/SpyPortfolioCard.tsx     — renders spied wallet's portfolio
```

Card layout (similar to PortfolioSidebar portfolio tab but inline in chat):
- Header: "Portfolio for 0xABC...DEF" with explorer link
- Sections: Balances, LP Positions, Farm Positions, Staking Positions
- All read-only — no action buttons
- Collapsible sections for large portfolios

### Edited Files

```
lib/ai/tools/index.ts                   — spread ...spyTools
components/chat/ToolPartRenderer.tsx     — add 'spyOnWallet' → SpyPortfolioCard
lib/ai/system-prompt.ts                 — mention spy capability in behavior rules
```

---

## 3. Membership Status

**Goal**: Show membership status and let users know about discount benefits.

### New Files

```
config/abis/membership.ts               — parseAbi for Membership contract
```

ABI:
```
hasActiveMembership(address user) view returns (bool)
getUserMembership(address user) view returns (uint256 expiresAt, bool isLifetime, bool isActive)
```

```
lib/ai/tools/membership.ts              — getMembershipStatus tool
```

Tool definition:
- **Name**: `getMembershipStatus`
- **Params**: `{ walletAddress: string }`
- **Logic**:
  1. Call `Membership.getUserMembership(address)`
  2. Call `DiscountManager.getDiscountEligibilitySource(address)` for full picture
  3. Call `NFTStaking.getUserTotalPower(address)` + `hasStakedForRequiredDays(address)` for NFT status
  4. Format expiry as human-readable date
  5. Calculate days remaining
- **Returns**: `{ membership: { isActive, isLifetime, expiresAt, daysRemaining }, nftStaking: { totalPower, isEligible, nftCount }, discountEligible, discountSource }`

```
components/chat/MembershipStatusCard.tsx — displays membership + NFT staking + discount status
```

Card layout:
- Discount status banner (eligible/not eligible + source)
- Membership section: active/expired, tier, expiry date, days remaining
- NFT Staking section: power points (X / 100,000), NFT count, qualified yes/no
- If not eligible: brief explanation of how to qualify (buy membership or stake NFTs)

### Edited Files

```
config/contracts.ts                     — add MEMBERSHIP, NFT_STAKING addresses
config/abis/index.ts                    — re-export membershipAbi
lib/ai/tools/index.ts                   — spread ...membershipTools
components/chat/ToolPartRenderer.tsx     — add 'getMembershipStatus' → MembershipStatusCard
```

### Future: Buy Membership

We have the read interface but not the purchase function ABI. Once discovered:
- Add `prepareBuyMembership` tool (approve ZEAL → call purchase function)
- Add `BuyMembershipCard` execution card (same state machine pattern as other execution cards)

---

## 4. TWAP Oracle / Token Prices

**Goal**: Let AI answer "what's the ZEAL price?" directly.

### New Files

```
lib/ai/tools/oracle.ts                  — getTokenPrice tool
```

Tool definition:
- **Name**: `getTokenPrice`
- **Params**: `{ token: string }` (symbol)
- **Logic**:
  1. Resolve token address from registry
  2. Find WKAS pair via `Factory.getPair(tokenAddress, WKAS)`
  3. Read `Pair.getReserves()` + `Pair.token0()` to determine ordering
  4. Calculate spot price: `reserveWKAS / reserveToken` (adjusted for token ordering)
  5. Optionally read `price0CumulativeLast` / `price1CumulativeLast` for TWAP reference
  6. Get pair total liquidity in KAS terms
- **Returns**: `{ token, priceInKAS, pairAddress, liquidityKAS, liquidityToken }`

```
components/chat/PriceCard.tsx            — displays token price with context
```

Card layout:
- Token name + price in KAS (large, prominent)
- Pair liquidity depth (KAS side + token side)
- Pair address with explorer link

### Edited Files

```
config/abis/pair.ts                     — add price0CumulativeLast(), price1CumulativeLast()
lib/ai/tools/index.ts                   — spread ...oracleTools
components/chat/ToolPartRenderer.tsx     — add 'getTokenPrice' → PriceCard
```

---

## 5. Missing Router Functions

**Goal**: Complete the Router ABI for edge cases.

### Edited Files

```
config/abis/router.ts                   — add missing functions:
```

Priority additions:
```solidity
// Sell exact tokens for KAS (we only have buy-exact-KAS variant)
function swapExactTokensForKAS(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[])

// Buy exact amounts
function swapKASForExactTokens(uint amountOut, address[] path, address to, uint deadline) payable returns (uint[])
function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] path, address to, uint deadline) returns (uint[])

// Fee-on-transfer support (add if any Kasplex token needs it)
function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)
function swapExactKASForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] path, address to, uint deadline) payable
function swapExactTokensForKASSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)

// Helpers
function factory() pure returns (address)
function quote(uint amountA, uint reserveA, uint reserveB) pure returns (uint amountB)
```

```
lib/ai/tools/swap.ts                    — use swapExactTokensForKAS for TOKEN->KAS swaps
                                          (currently uses swapTokensForExactKAS which requires exact output)
```

---

## 6. ZEAL Tokenomics (System Prompt)

### Edited Files

```
lib/ai/system-prompt.ts                 — add to static block:
```

Add under protocol knowledge:
```
ZEAL Token: 240M total supply. Allocation: 42% yield/incentives (7-9yr distribution),
32% protocol security/dev, 16% team (2yr cliff + 2yr unlock), 10% airdrops.
Utility: fee discounts, staking, governance, revenue sharing. Future burn mechanism planned.
```

---

## Implementation Order

Build in this sequence — each step is independently shippable:

### Phase 1: Discount Detection (highest ROI, smallest change)
1. Add DiscountManager ABI + address to config
2. Create `lib/discount.ts` helper
3. Wire into swap tools (getSwapQuote, prepareSwap)
4. Wire into yield tool
5. Add discount status to system prompt wallet context
6. Add missing Router functions to ABI

### Phase 2: Membership + NFT Status (builds on Phase 1)
1. Add Membership ABI + NFT Staking ABI + addresses to config
2. Create `getMembershipStatus` tool
3. Create MembershipStatusCard component
4. Register in tools/index and ToolPartRenderer

### Phase 3: Spy Mode (independent, can parallel with Phase 2)
1. Create `spyOnWallet` tool
2. Create SpyPortfolioCard component
3. Register in tools/index and ToolPartRenderer
4. Add spy capability mention to system prompt

### Phase 4: Token Prices (independent)
1. Extend pair ABI with cumulative price functions
2. Create `getTokenPrice` tool
3. Create PriceCard component
4. Register in tools/index and ToolPartRenderer

### Phase 5: Polish
1. Add ZEAL tokenomics to system prompt
2. Query contract optimization (when address found)

---

## Contract Addresses Reference

| Contract | Address | Needed For |
|---|---|---|
| DiscountManager | 0x3da82fa26d8756a557e475cfb2ee854937618e83 | Phase 1 |
| Membership | 0x8b32421d78a066f52035c242513055ed15047ee6 | Phase 2 |
| NFT Staking | 0xc5919064b3751d9402a974fff2680f78a36e1ff6 | Phase 2 |
| NACHO KAT NFT | 0x38a1a56f4d130417e92705d15eada9c9421de305 | Phase 2 (reference) |
| xZEAL Staking | 0x0000000000000000000000000000000000000000 | Not deployed |
| Query | TBD | Phase 5 |

All other contracts (Router, Factory, MasterChef, InfinityPools, WKAS) already in `config/contracts.ts`.
