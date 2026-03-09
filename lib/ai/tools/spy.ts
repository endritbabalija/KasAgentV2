import { z } from "zod";
import { tool } from "ai";
import { formatEther, formatUnits } from "viem";
import { CONTRACTS } from "@/config/contracts";
import {
  erc20Abi,
  factoryAbi,
  pairAbi,
  masterchefAbi,
  infinityPoolZealAbi,
  infinityPoolNachoAbi,
  infinityPoolKasperAbi,
} from "@/config/abis";
import { getAllTokens, addressToSymbol } from "@/lib/token-registry";
import { checkDiscountEligibility } from "@/lib/discount";
import { client, safeRead } from "./helpers";
import type {
  SpyTokenBalance,
  SpyLpPosition,
  SpyFarmPosition,
  SpyStakingPosition,
  SpyPortfolioResult,
} from "@/lib/ai/tool-types";

const INFINITY_POOLS = [
  {
    name: "ZEAL",
    address: CONTRACTS.INFINITY_POOL_ZEAL,
    abi: infinityPoolZealAbi,
    xTokenFn: "xZealToken" as const,
  },
  {
    name: "NACHO",
    address: CONTRACTS.INFINITY_POOL_NACHO,
    abi: infinityPoolNachoAbi,
    xTokenFn: "xNachoToken" as const,
  },
  {
    name: "KASPER",
    address: CONTRACTS.INFINITY_POOL_KASPER,
    abi: infinityPoolKasperAbi,
    xTokenFn: "xKasperToken" as const,
  },
] as const;

export const spyTools = {
  spyOnWallet: tool({
    description:
      "Inspect any wallet address to see its full DeFi portfolio — token balances, LP positions, farm positions, staking positions, and discount eligibility. Read-only, no wallet connection needed.",
    inputSchema: z.object({
      walletAddress: z
        .string()
        .describe("The wallet address to inspect (0x...)"),
    }),
    execute: async ({ walletAddress }): Promise<SpyPortfolioResult> => {
      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        return {
          address: walletAddress,
          balances: [],
          lpPositions: [],
          farmPositions: [],
          stakingPositions: [],
          discountStatus: { isEligible: false, source: "None" },
          fetchedAt: new Date().toISOString(),
          error: "Invalid wallet address format",
        };
      }

      const addr = walletAddress as `0x${string}`;

      try {
        // ── Phase A: Discovery ──
        const [tokens, nativeBalance, pairsLength, activePools, ...xTokenAddresses] =
          await Promise.all([
            getAllTokens(),
            safeRead(() => client.getBalance({ address: addr }), 0n),
            safeRead(
              () =>
                client.readContract({
                  address: CONTRACTS.FACTORY,
                  abi: factoryAbi,
                  functionName: "allPairsLength",
                }) as Promise<bigint>,
              0n
            ),
            safeRead(
              () =>
                client.readContract({
                  address: CONTRACTS.MASTER_CHEF,
                  abi: masterchefAbi,
                  functionName: "getActivePools",
                }) as Promise<bigint[]>,
              [] as bigint[]
            ),
            ...INFINITY_POOLS.map((pool) =>
              safeRead(
                () =>
                  client.readContract({
                    address: pool.address,
                    abi: pool.abi,
                    functionName: pool.xTokenFn,
                  }) as Promise<`0x${string}`>,
                "0x0000000000000000000000000000000000000000" as `0x${string}`
              )
            ),
          ]);

        // Get all pair addresses
        const pairAddresses = await Promise.all(
          Array.from({ length: Number(pairsLength) }, (_, i) =>
            safeRead(
              () =>
                client.readContract({
                  address: CONTRACTS.FACTORY,
                  abi: factoryAbi,
                  functionName: "allPairs",
                  args: [BigInt(i)],
                }) as Promise<`0x${string}`>,
              "0x0000000000000000000000000000000000000000" as `0x${string}`
            )
          )
        );
        const validPairs = pairAddresses.filter(
          (a) => a !== "0x0000000000000000000000000000000000000000"
        );

        // ERC20 tokens (exclude native KAS)
        const erc20Tokens = tokens.filter((t) => t.address != null);

        // ── Phase B: Batch reads ──
        const [
          tokenBalances,
          pairBalances,
          farmData,
          xTokenBalances,
          discount,
        ] = await Promise.all([
          // Token balances
          Promise.all(
            erc20Tokens.map((t) =>
              safeRead(
                () =>
                  client.readContract({
                    address: t.address as `0x${string}`,
                    abi: erc20Abi,
                    functionName: "balanceOf",
                    args: [addr],
                  }) as Promise<bigint>,
                0n
              )
            )
          ),
          // LP balances
          Promise.all(
            validPairs.map((pairAddr) =>
              safeRead(
                () =>
                  client.readContract({
                    address: pairAddr,
                    abi: pairAbi,
                    functionName: "balanceOf",
                    args: [addr],
                  }) as Promise<bigint>,
                0n
              )
            )
          ),
          // Farm data for each active pool
          Promise.all(
            activePools.map(async (pid) => {
              const [userInfo, pending, canWithdrawResult] = await Promise.all([
                safeRead(
                  () =>
                    client.readContract({
                      address: CONTRACTS.MASTER_CHEF,
                      abi: masterchefAbi,
                      functionName: "userInfo",
                      args: [pid, addr],
                    }) as Promise<[bigint, bigint, bigint]>,
                  [0n, 0n, 0n] as [bigint, bigint, bigint]
                ),
                safeRead(
                  () =>
                    client.readContract({
                      address: CONTRACTS.MASTER_CHEF,
                      abi: masterchefAbi,
                      functionName: "pendingReward",
                      args: [pid, addr],
                    }) as Promise<bigint>,
                  0n
                ),
                safeRead(
                  () =>
                    client.readContract({
                      address: CONTRACTS.MASTER_CHEF,
                      abi: masterchefAbi,
                      functionName: "canWithdraw",
                      args: [pid, addr],
                    }) as Promise<boolean>,
                  false
                ),
              ]);
              return {
                pid: Number(pid),
                stakedAmount: userInfo[0],
                pendingReward: pending,
                canWithdraw: canWithdrawResult,
              };
            })
          ),
          // xToken balances
          Promise.all(
            xTokenAddresses.map((xAddr) =>
              xAddr === "0x0000000000000000000000000000000000000000"
                ? Promise.resolve(0n)
                : safeRead(
                    () =>
                      client.readContract({
                        address: xAddr,
                        abi: erc20Abi,
                        functionName: "balanceOf",
                        args: [addr],
                      }) as Promise<bigint>,
                    0n
                  )
            )
          ),
          // Discount
          checkDiscountEligibility(walletAddress),
        ]);

        // ── Phase C: Detail reads (only non-zero positions) ──

        // Build token balances result (include native KAS + non-zero ERC20)
        const balances: SpyTokenBalance[] = [];
        if (nativeBalance > 0n) {
          balances.push({
            symbol: "KAS",
            balance: formatEther(nativeBalance),
            address: null,
          });
        }
        for (let i = 0; i < erc20Tokens.length; i++) {
          if (tokenBalances[i] > 0n) {
            balances.push({
              symbol: erc20Tokens[i].symbol,
              balance: formatUnits(tokenBalances[i], erc20Tokens[i].decimals),
              address: erc20Tokens[i].address!,
            });
          }
        }

        // LP positions — detail reads for non-zero balances
        const lpPositions: SpyLpPosition[] = [];
        const nonZeroLpIndices = pairBalances
          .map((bal, i) => (bal > 0n ? i : -1))
          .filter((i) => i >= 0);

        if (nonZeroLpIndices.length > 0) {
          const lpDetails = await Promise.all(
            nonZeroLpIndices.map(async (idx) => {
              const pairAddr = validPairs[idx];
              const balance = pairBalances[idx];
              const [reserves, totalSupply, token0, token1] = await Promise.all(
                [
                  safeRead(
                    () =>
                      client.readContract({
                        address: pairAddr,
                        abi: pairAbi,
                        functionName: "getReserves",
                      }) as Promise<[bigint, bigint, number]>,
                    [0n, 0n, 0] as [bigint, bigint, number]
                  ),
                  safeRead(
                    () =>
                      client.readContract({
                        address: pairAddr,
                        abi: pairAbi,
                        functionName: "totalSupply",
                      }) as Promise<bigint>,
                    0n
                  ),
                  safeRead(
                    () =>
                      client.readContract({
                        address: pairAddr,
                        abi: pairAbi,
                        functionName: "token0",
                      }) as Promise<`0x${string}`>,
                    "0x0000000000000000000000000000000000000000" as `0x${string}`
                  ),
                  safeRead(
                    () =>
                      client.readContract({
                        address: pairAddr,
                        abi: pairAbi,
                        functionName: "token1",
                      }) as Promise<`0x${string}`>,
                    "0x0000000000000000000000000000000000000000" as `0x${string}`
                  ),
                ]
              );

              const [t0Sym, t1Sym] = await Promise.all([
                addressToSymbol(token0),
                addressToSymbol(token1),
              ]);

              const token0Amount =
                totalSupply > 0n
                  ? (reserves[0] * balance) / totalSupply
                  : 0n;
              const token1Amount =
                totalSupply > 0n
                  ? (reserves[1] * balance) / totalSupply
                  : 0n;

              return {
                pairAddress: pairAddr,
                pair: `${t0Sym}/${t1Sym}`,
                lpBalance: formatEther(balance),
                token0Symbol: t0Sym,
                token0Amount: formatEther(token0Amount),
                token1Symbol: t1Sym,
                token1Amount: formatEther(token1Amount),
              } satisfies SpyLpPosition;
            })
          );
          lpPositions.push(...lpDetails);
        }

        // Farm positions — only non-zero staked
        const farmPositions: SpyFarmPosition[] = [];
        const nonZeroFarms = farmData.filter((f) => f.stakedAmount > 0n);

        if (nonZeroFarms.length > 0) {
          // Get reward token symbol once
          const rewardTokenAddr = await safeRead(
            () =>
              client.readContract({
                address: CONTRACTS.MASTER_CHEF,
                abi: masterchefAbi,
                functionName: "rewardToken",
              }) as Promise<`0x${string}`>,
            "0x0000000000000000000000000000000000000000" as `0x${string}`
          );
          const rewardTokenSymbol = await addressToSymbol(rewardTokenAddr);

          // Get LP token info for each active farm with stakes
          const farmDetails = await Promise.all(
            nonZeroFarms.map(async (farm) => {
              const poolInfo = await safeRead(
                () =>
                  client.readContract({
                    address: CONTRACTS.MASTER_CHEF,
                    abi: masterchefAbi,
                    functionName: "poolInfo",
                    args: [BigInt(farm.pid)],
                  }) as Promise<
                    [
                      `0x${string}`,
                      bigint,
                      bigint,
                      bigint,
                      bigint,
                      boolean,
                      boolean,
                    ]
                  >,
                [
                  "0x0000000000000000000000000000000000000000" as `0x${string}`,
                  0n,
                  0n,
                  0n,
                  0n,
                  false,
                  false,
                ] as [
                  `0x${string}`,
                  bigint,
                  bigint,
                  bigint,
                  bigint,
                  boolean,
                  boolean,
                ]
              );

              const lpToken = poolInfo[0];
              // Try to resolve LP pair symbols
              let lpSymbol = "LP";
              try {
                const [t0, t1] = await Promise.all([
                  client.readContract({
                    address: lpToken,
                    abi: pairAbi,
                    functionName: "token0",
                  }) as Promise<`0x${string}`>,
                  client.readContract({
                    address: lpToken,
                    abi: pairAbi,
                    functionName: "token1",
                  }) as Promise<`0x${string}`>,
                ]);
                const [s0, s1] = await Promise.all([
                  addressToSymbol(t0),
                  addressToSymbol(t1),
                ]);
                lpSymbol = `${s0}/${s1} LP`;
              } catch {
                // Not a pair LP token, use generic label
              }

              return {
                pid: farm.pid,
                lpTokenSymbol: lpSymbol,
                stakedAmount: formatEther(farm.stakedAmount),
                pendingReward: formatEther(farm.pendingReward),
                rewardToken: rewardTokenSymbol,
                canWithdraw: farm.canWithdraw,
              } satisfies SpyFarmPosition;
            })
          );
          farmPositions.push(...farmDetails);
        }

        // Staking positions — only non-zero xToken balances
        const stakingPositions: SpyStakingPosition[] = [];
        for (let i = 0; i < INFINITY_POOLS.length; i++) {
          if (xTokenBalances[i] > 0n) {
            const pool = INFINITY_POOLS[i];
            const exchangeRate = await safeRead(
              () =>
                client.readContract({
                  address: pool.address,
                  abi: pool.abi,
                  functionName: "getExchangeRate",
                }) as Promise<bigint>,
              BigInt(1e18)
            );

            const underlyingAmount =
              (xTokenBalances[i] * exchangeRate) / BigInt(1e18);

            stakingPositions.push({
              pool: pool.name,
              xTokenBalance: formatEther(xTokenBalances[i]),
              underlyingAmount: formatEther(underlyingAmount),
              exchangeRate: formatEther(exchangeRate),
            });
          }
        }

        return {
          address: walletAddress,
          balances,
          lpPositions,
          farmPositions,
          stakingPositions,
          discountStatus: {
            isEligible: discount.isEligible,
            source: discount.source,
          },
          fetchedAt: new Date().toISOString(),
        };
      } catch (e) {
        return {
          address: walletAddress,
          balances: [],
          lpPositions: [],
          farmPositions: [],
          stakingPositions: [],
          discountStatus: { isEligible: false, source: "None" },
          fetchedAt: new Date().toISOString(),
          error: `Failed to scan wallet: ${e instanceof Error ? e.message : "Unknown error"}`,
        };
      }
    },
  }),
};
