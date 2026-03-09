# ZealousSwap Protocol Reference

Source of truth for all ZealousSwap contract addresses, ABIs, and integration details.
Source repo: https://github.com/zealousswap/zealous-swap-contracts

---

## Kasplex Mainnet

- Chain ID: 202555
- RPC: https://evmrpc.kasplex.org
- Explorer: https://explorer.kasplex.org
- Native currency: KAS (18 decimals)
- Deployer/Owner: 0x0b3427e69d6dd55adf7dc41b5cd46c895f1b1668

### Core Contracts

| Contract            | Address                                    |
|---------------------|--------------------------------------------|
| Router              | 0xA5B0946D31aD2d251e0fe2dfEA8808BFd475e607 |
| Factory             | 0x98Bb580A77eE329796a79aBd05c6D2F2b3D5E1bD |
| Farms (MasterChef)  | 0x97ac386fFf8d25Bc3F949194f74a79E94617bc7F |
| InfinityPool ZEAL   | 0x1E7748BA1d372186a322E7CfaAB1306f19FfB897 |
| InfinityPool NACHO  | 0x0d4f07811718C0eE57EA2FCDb844c3585ae0F315 |
| InfinityPool KASPER | 0xa1074f1cD056862ebA654344518aa8c6DE0afE74 |
| WKAS                | 0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e |

### Discount & Membership Contracts (discovered 2025-03-09)

| Contract         | Address                                    | Status                        |
|------------------|--------------------------------------------|-------------------------------|
| DiscountManager  | 0x3da82fa26d8756a557e475cfb2ee854937618e83 | Active - single entry point   |
| NFT Staking      | 0xc5919064b3751d9402a974fff2680f78a36e1ff6 | Active - 202 stakers          |
| NACHO KAT NFT    | 0x38a1a56f4d130417e92705d15eada9c9421de305 | ERC-721 collection            |
| Membership       | 0x8b32421d78a066f52035c242513055ed15047ee6 | Active                        |
| xZEAL Staking    | 0x0000000000000000000000000000000000000000 | Not deployed (zero address)   |

**How discovered**: Router.discountManagerContract() -> DiscountManager, then read sub-contract addresses from DiscountManager.

### Query Contract (on-chain aggregator)

Address: **TBD** - deployed but address not yet discovered. Stateless read-only helper.

---

## Contract Details

### Router (IZealousSwapRouter02)

Fork of Uniswap V2. ETH renamed to KAS. getAmountsOut/getAmountsIn have extra `isDiscountEligible: bool` param.
Router stores `discountManagerContract` as public state variable (readable on-chain).

#### Swap Functions (currently in our ABI)

| Function                   | Mutability | Key params                                   |
|----------------------------|------------|----------------------------------------------|
| swapExactTokensForTokens   | nonpayable | amountIn, amountOutMin, path[], to, deadline |
| swapExactKASForTokens      | payable    | amountOutMin, path[], to, deadline           |
| swapTokensForExactKAS      | nonpayable | amountOut, amountInMax, path[], to, deadline |

#### Missing Router Functions (from IZealousSwapRouter01 + Router02)

| Function                                              | Mutability | Notes                              |
|-------------------------------------------------------|------------|------------------------------------|
| swapExactTokensForKAS                                 | nonpayable | We only have swapTokensForExactKAS |
| swapKASForExactTokens                                 | payable    | Buy exact token amount with KAS    |
| swapTokensForExactTokens                              | nonpayable | Buy exact token B with token A     |
| swapExactTokensForTokensSupportingFeeOnTransferTokens | nonpayable | Fee-on-transfer token support      |
| swapExactKASForTokensSupportingFeeOnTransferTokens    | payable    | Fee-on-transfer token support      |
| swapExactTokensForKASSupportingFeeOnTransferTokens    | nonpayable | Fee-on-transfer token support      |
| removeLiquidityKASSupportingFeeOnTransferTokens       | nonpayable | Fee-on-transfer liquidity          |
| quote(amountA, reserveA, reserveB)                    | pure       | Simple quote helper                |
| getAmountOut(amountIn, reserveIn, reserveOut, fee)    | pure       | Single-hop with fee param          |
| getAmountIn(amountOut, reserveIn, reserveOut, fee)    | pure       | Single-hop with fee param          |
| factory()                                             | pure       | Get factory address                |

#### Liquidity Functions

| Function           | Mutability | Key params                                                                           |
|--------------------|------------|--------------------------------------------------------------------------------------|
| addLiquidity       | nonpayable | tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline |
| addLiquidityKAS    | payable    | token, amountTokenDesired, amountTokenMin, amountKASMin, to, deadline                |
| removeLiquidity    | nonpayable | tokenA, tokenB, liquidity, amountAMin, amountBMin, to, deadline                      |
| removeLiquidityKAS | nonpayable | token, liquidity, amountTokenMin, amountKASMin, to, deadline                         |

#### View Functions

| Function                                            | Notes                    |
|-----------------------------------------------------|--------------------------|
| getAmountsOut(amountIn, path[], isDiscountEligible) | isDiscountEligible: bool |
| getAmountsIn(amountOut, path[], isDiscountEligible) | isDiscountEligible: bool |
| WKAS()                                              | returns WKAS address     |
| discountManagerContract()                           | returns DiscountManager  |

---

### DiscountManager

Single entry point for checking fee discount eligibility. Checks 3 sources in priority order:
1. NFT Staking -> hasStakedForRequiredDays(user)
2. xZEAL Staking -> hasStakedForRequiredDays(user) (not deployed yet)
3. Membership -> hasActiveMembership(user)

| Function                              | Returns        | Notes                                                    |
|---------------------------------------|----------------|----------------------------------------------------------|
| isDiscountEligible(address user)      | bool           | One call checks all 3 sources                            |
| getDiscountEligibilitySource(address) | (bool, string) | Returns source: "NFT", "Token", "Membership", or "None" |
| nftStakingContract()                  | address        | Read sub-contract addresses                              |
| xzealStakingContract()                | address        | Currently zero address                                   |
| membershipContract()                  | address        | Read sub-contract addresses                              |

**Integration**: Call `isDiscountEligible(user)` and pass result to Router's `getAmountsOut(amount, path, isEligible)`.

---

### Membership

| Function                          | Returns                                          | Notes       |
|-----------------------------------|--------------------------------------------------|-------------|
| hasActiveMembership(address user) | bool                                             | Quick check |
| getUserMembership(address user)   | (uint256 expiresAt, bool isLifetime, bool isActive) | Full details |

Memberships are purchased with ZEAL tokens. Tiers: 1 Week, 1 Month, 1 Quarter, 1 Year, Lifetime.
Benefit: 33% fee discount (0.2% instead of 0.3%).

---

### NFT Staking (NACHO KAT)

| Function                              | Returns                          | Notes                          |
|---------------------------------------|----------------------------------|--------------------------------|
| hasStakedForRequiredDays(address user) | bool                            | Discount eligibility check     |
| getUserTotalPower(address user)        | uint256                         | User's accumulated power       |
| getStakedNFTs(address user)            | uint256[]                       | Array of staked NFT IDs        |
| userStakedNFTCount(address user)       | uint256                         | Number of NFTs staked          |
| userPowerInfo(address user)            | (totalPower, minPowerReachedAt) | Power tracking                 |
| isNFTStaked(address user, uint nftID)  | bool                            | Check specific NFT             |
| getNFTPower(uint nftID)                | uint256                         | Power value of specific NFT    |
| totalStakers()                         | uint256                         | Global stat                    |
| requiredStakingDays()                  | uint256                         | Days needed to qualify         |
| minRequiredPower()                     | uint256                         | Power threshold                |
| totalNFTsStaked()                      | uint256                         | Global stat                    |
| totalPowerStaked()                     | uint256                         | Global stat                    |
| nftContract()                          | address                         | NACHO KAT ERC-721 address      |
| stakeNFT(uint nftID)                  | -                                | Write: stake an NFT            |
| unstakeNFT(uint nftID)                | -                                | Write: unstake an NFT          |

**Live parameters** (as of 2025-03-09):
- Min Required Power: 100,000
- Required Staking Days: 1
- Total Stakers: 202
- Total NFTs Staked: 4,915
- Total Power Staked: ~35M

Eligibility: totalPower >= 100,000 AND staked for >= 1 day.

---

### xZEAL Token Staking (IZealousSwapXZEALStaking)

Separate from InfinityPool - specifically for discount eligibility.
**Not deployed yet** (DiscountManager returns zero address).

| Function                               | Returns | Notes                      |
|----------------------------------------|---------|----------------------------|
| hasStakedForRequiredDays(address user)  | bool    | Discount eligibility check |
| getStakedAmount(address user)          | uint256 | ZEAL tokens staked         |
| getUserTotalPower(address user)        | uint256 | Accumulated power          |
| stakeTokens(uint amount)              | -       | Write: stake ZEAL          |
| unstakeTokens()                        | -       | Write: unstake all         |

---

### ZealousSwapQuery (On-Chain Aggregator)

Stateless read-only helper contract that batches multiple reads into single calls.
**Address: TBD** - not yet discovered.

| Function                                                | Returns                   | Notes                             |
|---------------------------------------------------------|---------------------------|-----------------------------------|
| getUserLiquidityPools(user, factory)                    | PoolInfo[]                | All user LP positions in one call |
| getUserLiquidityPoolsPaginated(user, factory, start, end) | PoolInfo[]             | Paginated version                 |
| getStakingInfo(user, nftStaking)                        | StakingInfo               | All NFT staking data in one call  |
| getInfinityPoolInfo(user, zealPool)                     | InfinityPoolInfo          | ZEAL pool + user data             |
| getNachoInfinityPoolInfo(user, nachoPool)               | NachoInfinityPoolInfo     | NACHO pool + user data            |
| getKasperInfinityPoolInfo(user, kasperPool)             | KasperInfinityPoolInfo    | KASPER pool + user data           |
| getFarmInfoForUser(user, farms)                         | (FarmInfo[], GlobalInfo)  | ALL farms + user positions        |
| getAllPools(factory)                                    | PoolInfo[]                | All pairs in one call             |
| getPoolsPaginated(factory, start, end)                  | PoolInfo[]                | Paginated version                 |
| getUserBalances(user, tokens[])                         | uint256[]                 | Batch balance check               |

---

### Factory (standard Uniswap V2)

- getPair(tokenA, tokenB) -> pair address
- allPairs(index) -> pair address
- allPairsLength() -> uint256
- feeTo() -> address

---

### Pair (standard Uniswap V2 + ERC20)

- getReserves() -> (reserve0: uint112, reserve1: uint112, blockTimestampLast: uint32)
- token0(), token1(), totalSupply(), decimals(), balanceOf(), symbol(), name(), approve()
- price0CumulativeLast(), price1CumulativeLast() - TWAP oracle data

---

### Farms (MasterChef)

**Write**: deposit(pid, amount), withdraw(pid, amount), claim(pid), emergencyWithdraw(pid)

**Read**:

| Function                                                 | Returns                                                                                |
|----------------------------------------------------------|----------------------------------------------------------------------------------------|
| userInfo(pid, user)                                      | (amount, rewardDebt, lastInteraction)                                                  |
| poolInfo(pid)                                            | (lpToken, allocPoint, lastRewardBlock, accRewardPerShare, totalDeposited, isActive, isRemoved) |
| getPoolInfo(pid)                                         | same as poolInfo + poolShare                                                           |
| pendingReward(pid, user)                                 | uint256                                                                                |
| canWithdraw(pid, user)                                   | bool                                                                                   |
| poolLength() / activePoolLength()                        | uint256                                                                                |
| getActivePools()                                         | uint256[]                                                                              |
| findPoolIdByLpToken(lpToken)                             | uint256                                                                                |
| getLpTokenStatus(lpToken)                                | (exists, pid, isRemoved)                                                               |
| rewardPerBlock() / totalAllocPoint() / rewardToken() / lockingPeriod() | globals                                                                  |

---

### InfinityPool - ZEAL (has emission system)

- stake(amount) / unstake(xTokenAmount)
- getExchangeRate(), previewStake(amount), previewUnstake(xAmount), totalStaked()
- Emission-specific: zealPerBlock(), getPendingEmissions(), getProjectedExchangeRate(), emissionsPaused(), lastRewardBlock()
- zealToken() -> underlying, xZealToken() -> receipt token

### InfinityPool - NACHO (manual rewards, KASPER reuses same ABI)

- stake(amount) / unstake(xTokenAmount)
- getExchangeRate(), previewStake(amount), previewUnstake(xAmount), totalStaked()
- nachoToken() -> underlying, xNachoToken() -> receipt token
- No emissions - rewards added manually via addRewards()

---

### FeeDistributor

Distributes collected protocol fees. Not user-facing but useful for protocol knowledge.

Default split: 30% Nacho Team, 5% Insurance Fund, 5% Protocol-Owned Liquidity, 60% ZealousSwap Treasury.

---

### Fee Structure

| Pool Type | Standard Fee | Discounted Fee | Discount |
|-----------|-------------|----------------|----------|
| Volatile  | 0.3%        | 0.2%           | 33% off  |
| Stable    | 0.05%       | 0.03%          | 40% off  |

Fee split: 0.25% to LPs + 0.05% to protocol (at standard 0.3% rate).

Discount eligibility via DiscountManager (NFT staking OR xZEAL staking OR Membership).

---

### ERC20 (shared)

- balanceOf, decimals, symbol, name, allowance, approve, transfer, transferFrom, totalSupply

---

## Kasplex Testnet

- Chain ID: 167012
- RPC: https://rpc.kasplextest.xyz
- Explorer: https://explorer.kasplextest.xyz
- Native currency: KAS (18 decimals)

| Contract | Address                                    |
|----------|--------------------------------------------|
| Router   | 0xaE821200c01E532E5A252FfCaA8546cbdca342DF |
| Factory  | 0x1f1959fE8E23C84b0147505C0303bd65eaE2680C |
| WKAS     | 0xf40178040278E16c8813dB20a84119A605812FB3 |

Farms, InfinityPools, and Discount contracts not deployed on testnet.

---

## Igra Galleon Testnet

- Chain ID: 38836
- RPC: https://galleon-testnet.igralabs.com:8545
- Explorer: https://explorer.galleon-testnet.igralabs.com
- Native currency: iKAS (18 decimals)
- No Zealous contracts deployed.

---

## ZEAL Token

- Total supply: 240M
- Allocation: 42% Yield/Incentives, 32% Protocol Security/Dev, 16% Team (2yr cliff), 10% Airdrops
- Utility: Revenue sharing, governance, staking, membership discounts, fee reduction
- Future burn mechanism planned
