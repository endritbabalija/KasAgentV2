Here's everything from Kasplex L2:

  ---
  Kasplex Mainnet                                                                                                                                                                  
  - Chain ID: 202555                                                                                                                                                                 - RPC: https://evmrpc.kasplex.org
  - Explorer: https://explorer.kasplex.org
  - Native currency: KAS (18 decimals)

  Contracts (Zealous Swap)

  ┌─────────────────────┬────────────────────────────────────────────┐
  │      Contract       │                  Address                   │
  ├─────────────────────┼────────────────────────────────────────────┤
  │ Router              │ 0xA5B0946D31aD2d251e0fe2dfEA8808BFd475e607 │
  ├─────────────────────┼────────────────────────────────────────────┤
  │ Factory             │ 0x98Bb580A77eE329796a79aBd05c6D2F2b3D5E1bD │
  ├─────────────────────┼────────────────────────────────────────────┤
  │ Farms (MasterChef)  │ 0x97ac386fFf8d25Bc3F949194f74a79E94617bc7F │
  ├─────────────────────┼────────────────────────────────────────────┤
  │ InfinityPool ZEAL   │ 0x1E7748BA1d372186a322E7CfaAB1306f19FfB897 │
  ├─────────────────────┼────────────────────────────────────────────┤
  │ InfinityPool NACHO  │ 0x0d4f07811718C0eE57EA2FCDb844c3585ae0F315 │
  ├─────────────────────┼────────────────────────────────────────────┤
  │ InfinityPool KASPER │ 0xa1074f1cD056862ebA654344518aa8c6DE0afE74 │
  ├─────────────────────┼────────────────────────────────────────────┤
  │ WKAS                │ 0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e │
  └─────────────────────┴────────────────────────────────────────────┘

  ---
  Kasplex Testnet

  - Chain ID: 167012
  - RPC: https://rpc.kasplextest.xyz
  - Explorer: https://explorer.kasplextest.xyz
  - Native currency: KAS (18 decimals)

  Contracts (Zealous Swap - partial)

  ┌──────────┬────────────────────────────────────────────┐
  │ Contract │                  Address                   │
  ├──────────┼────────────────────────────────────────────┤
  │ Router   │ 0xaE821200c01E532E5A252FfCaA8546cbdca342DF │
  ├──────────┼────────────────────────────────────────────┤
  │ Factory  │ 0x1f1959fE8E23C84b0147505C0303bd65eaE2680C │
  ├──────────┼────────────────────────────────────────────┤
  │ WKAS     │ 0xf40178040278E16c8813dB20a84119A605812FB3 │
  └──────────┴────────────────────────────────────────────┘

  Farms and InfinityPools not deployed on testnet.

  ---
  Igra Galleon Testnet

  - Chain ID: 38836
  - RPC: https://galleon-testnet.igralabs.com:8545
  - Explorer: https://explorer.galleon-testnet.igralabs.com
  - Native currency: iKAS (18 decimals)
  - No Zealous contracts deployed.

  ---
  Fervent Finance addresses are empty across all chains (not deployed yet). That's everything network/infra-wise from the codebase. Ready for Zealous contracts whenever you are.

✻ Churned for 32s

❯ check again now for zealous swap if we have other infos that i need extracted pls!                                                                                               
● Let me pull all the Zealous Swap contract details - ABIs, function signatures, everything.                                                                                       
● Read 7 files (ctrl+o to expand)

● Here's the full Zealous Swap reference dump:

  ---
  Router (IZealousSwapRouter02)                                                                                                                                                    
  Note: Fork of Uniswap V2 but ETH renamed to KAS, and getAmountsOut/getAmountsIn have an extra isDiscountEligible: bool param.                                                    
  Swap functions

  ┌──────────────────────────┬────────────┬──────────────────────────────────────────────┐
  │         Function         │ Mutability │                  Key params                  │
  ├──────────────────────────┼────────────┼──────────────────────────────────────────────┤
  │ swapExactTokensForTokens │ nonpayable │ amountIn, amountOutMin, path[], to, deadline │
  ├──────────────────────────┼────────────┼──────────────────────────────────────────────┤
  │ swapExactKASForTokens    │ payable    │ amountOutMin, path[], to, deadline           │
  ├──────────────────────────┼────────────┼──────────────────────────────────────────────┤
  │ swapTokensForExactKAS    │ nonpayable │ amountOut, amountInMax, path[], to, deadline │
  └──────────────────────────┴────────────┴──────────────────────────────────────────────┘

  Liquidity functions

  ┌────────────────────┬────────────┬──────────────────────────────────────────────────────────────────────────────────────┐
  │      Function      │ Mutability │                                      Key params                                      │
  ├────────────────────┼────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
  │ addLiquidity       │ nonpayable │ tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline │
  ├────────────────────┼────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
  │ addLiquidityKAS    │ payable    │ token, amountTokenDesired, amountTokenMin, amountKASMin, to, deadline                │
  ├────────────────────┼────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
  │ removeLiquidity    │ nonpayable │ tokenA, tokenB, liquidity, amountAMin, amountBMin, to, deadline                      │
  ├────────────────────┼────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
  │ removeLiquidityKAS │ nonpayable │ token, liquidity, amountTokenMin, amountKASMin, to, deadline                         │
  └────────────────────┴────────────┴──────────────────────────────────────────────────────────────────────────────────────┘

  View functions

  ┌─────────────────────────────────────────────────────┬──────────────────────────┐
  │                      Function                       │  Extra param vs Uni V2   │
  ├─────────────────────────────────────────────────────┼──────────────────────────┤
  │ getAmountsOut(amountIn, path[], isDiscountEligible) │ isDiscountEligible: bool │
  ├─────────────────────────────────────────────────────┼──────────────────────────┤
  │ getAmountsIn(amountOut, path[], isDiscountEligible) │ isDiscountEligible: bool │
  ├─────────────────────────────────────────────────────┼──────────────────────────┤
  │ WKAS()                                              │ returns WKAS address     │
  └─────────────────────────────────────────────────────┴──────────────────────────┘

  ---
  Factory (IUniswapV2Factory — standard)

  - getPair(tokenA, tokenB) → pair address
  - allPairs(index) → pair address
  - allPairsLength() → uint256
  - feeTo() → address

  ---
  Pair (IUniswapV2Pair — standard + ERC20)

  - getReserves() → (reserve0: uint112, reserve1: uint112, blockTimestampLast: uint32)
  - token0(), token1(), totalSupply(), decimals(), balanceOf(), symbol(), name(), approve()

  ---
  Farms (MasterChef)

  Write

  ┌────────────────────────┬───────────────────────────────────┐
  │        Function        │              Params               │
  ├────────────────────────┼───────────────────────────────────┤
  │ deposit(pid, amount)   │ stake LP tokens                   │
  ├────────────────────────┼───────────────────────────────────┤
  │ withdraw(pid, amount)  │ unstake LP tokens                 │
  ├────────────────────────┼───────────────────────────────────┤
  │ claim(pid)             │ harvest rewards                   │
  ├────────────────────────┼───────────────────────────────────┤
  │ emergencyWithdraw(pid) │ force withdraw (forfeits rewards) │
  └────────────────────────┴───────────────────────────────────┘

  Read

  ┌────────────────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────┐
  │                                Function                                │                                            Returns                                             │
  ├────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ userInfo(pid, user)                                                    │ (amount, rewardDebt, lastInteraction)                                                          │
  ├────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ poolInfo(pid)                                                          │ (lpToken, allocPoint, lastRewardBlock, accRewardPerShare, totalDeposited, isActive, isRemoved) │
  ├────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ getPoolInfo(pid)                                                       │ same as poolInfo + poolShare                                                                   │
  ├────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ pendingReward(pid, user)                                               │ uint256                                                                                        │
  ├────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ canWithdraw(pid, user)                                                 │ bool                                                                                           │
  ├────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ poolLength() / activePoolLength()                                      │ uint256                                                                                        │
  ├────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ getActivePools()                                                       │ uint256[]                                                                                      │
  ├────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ findPoolIdByLpToken(lpToken)                                           │ uint256                                                                                        │
  ├────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ getLpTokenStatus(lpToken)                                              │ (exists, pid, isRemoved)                                                                       │
  ├────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ rewardPerBlock() / totalAllocPoint() / rewardToken() / lockingPeriod() │ globals                                                                                        │
  └────────────────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────┘

  ---
  InfinityPool — ZEAL (has emission system)

  - stake(amount) / unstake(xTokenAmount)
  - getExchangeRate(), previewStake(amount), previewUnstake(xAmount), totalStaked()
  - Emission-specific: zealPerBlock(), getPendingEmissions(), getProjectedExchangeRate(), emissionsPaused(), lastRewardBlock()
  - zealToken() → underlying, xZealToken() → receipt token

  InfinityPool — NACHO (manual rewards, KASPER reuses same ABI)

  - stake(amount) / unstake(xTokenAmount)
  - getExchangeRate(), previewStake(amount), previewUnstake(xAmount), totalStaked()
  - nachoToken() → underlying, xNachoToken() → receipt token
  - No emissions — rewards added manually via addRewards()

  ---
  ERC20 (shared)

  - balanceOf, decimals, symbol, allowance, approve

  ---
  That's everything Zealous-related from the codebase — ABIs, function sigs, contract addresses, and the quirks (KAS naming, discount bool, split InfinityPool patterns).