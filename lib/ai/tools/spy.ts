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
import { client } from "./helpers";
import type {
  SpyTokenBalance,
  SpyLpPosition,
  SpyFarmPosition,
  SpyStakingPosition,
  SpyPortfolioResult,
} from "@/lib/ai/tool-types";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as `0x${string}`;

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

import { mcResult } from "@/lib/multicall";

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
        // ── Phase A: Discovery (4 parallel calls) ──
        const [tokens, nativeBalance, pairsLengthRaw, activePoolsRaw] =
          await Promise.all([
            getAllTokens(),
            client.getBalance({ address: addr }).catch(() => 0n),
            client
              .readContract({
                address: CONTRACTS.FACTORY,
                abi: factoryAbi,
                functionName: "allPairsLength",
              })
              .catch(() => 0n) as Promise<bigint>,
            client
              .readContract({
                address: CONTRACTS.MASTER_CHEF,
                abi: masterchefAbi,
                functionName: "getActivePools",
              })
              .catch(() => [] as bigint[]) as Promise<bigint[]>,
          ]);

        const pairsLength = Number(pairsLengthRaw);
        const activePools = activePoolsRaw;
        const erc20Tokens = tokens.filter((t) => t.address != null);

        // ── Multicall 1: Pair addresses + xToken addresses (single RPC) ──
        const mc1Contracts = [
          // allPairs(i) for each pair
          ...Array.from({ length: pairsLength }, (_, i) => ({
            address: CONTRACTS.FACTORY,
            abi: factoryAbi,
            functionName: "allPairs" as const,
            args: [BigInt(i)],
          })),
          // xToken addresses for 3 InfinityPools
          ...INFINITY_POOLS.map((pool) => ({
            address: pool.address,
            abi: pool.abi,
            functionName: pool.xTokenFn,
          })),
        ];

        const mc1 = mc1Contracts.length > 0
          ? await client.multicall({ contracts: mc1Contracts, allowFailure: true })
          : [];

        const validPairs: `0x${string}`[] = [];
        for (let i = 0; i < pairsLength; i++) {
          const a = mcResult(mc1[i], ZERO_ADDR);
          if (a !== ZERO_ADDR) validPairs.push(a);
        }

        const xTokenAddresses = INFINITY_POOLS.map((_, i) =>
          mcResult(mc1[pairsLength + i], ZERO_ADDR)
        );

        // ── Multicall 2: ALL balance + farm reads (single RPC) ──
        const mc2Contracts = [
          // ERC20 token balances
          ...erc20Tokens.map((t) => ({
            address: t.address as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf" as const,
            args: [addr] as const,
          })),
          // LP pair balances
          ...validPairs.map((pairAddr) => ({
            address: pairAddr,
            abi: pairAbi,
            functionName: "balanceOf" as const,
            args: [addr] as const,
          })),
          // Farm reads: 3 calls per active pool (userInfo, pendingReward, canWithdraw)
          ...activePools.flatMap((pid) => [
            {
              address: CONTRACTS.MASTER_CHEF,
              abi: masterchefAbi,
              functionName: "userInfo" as const,
              args: [pid, addr] as const,
            },
            {
              address: CONTRACTS.MASTER_CHEF,
              abi: masterchefAbi,
              functionName: "pendingReward" as const,
              args: [pid, addr] as const,
            },
            {
              address: CONTRACTS.MASTER_CHEF,
              abi: masterchefAbi,
              functionName: "canWithdraw" as const,
              args: [pid, addr] as const,
            },
          ]),
          // xToken balances (3 calls)
          ...xTokenAddresses.map((xAddr) => ({
            address: xAddr === ZERO_ADDR ? ZERO_ADDR : xAddr,
            abi: erc20Abi,
            functionName: "balanceOf" as const,
            args: [addr] as const,
          })),
        ];

        const [mc2, discount] = await Promise.all([
          mc2Contracts.length > 0
            ? client.multicall({ contracts: mc2Contracts, allowFailure: true })
            : Promise.resolve([]),
          checkDiscountEligibility(walletAddress),
        ]);

        // Parse mc2 results by offset
        let offset = 0;

        // Token balances
        const tokenBalances = erc20Tokens.map((_, i) =>
          mcResult<bigint>(mc2[offset + i], 0n)
        );
        offset += erc20Tokens.length;

        // LP balances
        const pairBalances = validPairs.map((_, i) =>
          mcResult<bigint>(mc2[offset + i], 0n)
        );
        offset += validPairs.length;

        // Farm data
        const farmData = activePools.map((pid, i) => {
          const base = offset + i * 3;
          const userInfo = mcResult<[bigint, bigint, bigint]>(
            mc2[base],
            [0n, 0n, 0n]
          );
          return {
            pid: Number(pid),
            stakedAmount: userInfo[0],
            pendingReward: mcResult<bigint>(mc2[base + 1], 0n),
            canWithdraw: mcResult<boolean>(mc2[base + 2], false),
          };
        });
        offset += activePools.length * 3;

        // xToken balances
        const xTokenBalances = xTokenAddresses.map((xAddr, i) =>
          xAddr === ZERO_ADDR ? 0n : mcResult<bigint>(mc2[offset + i], 0n)
        );

        // ── Build token balances result ──
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

        // ── Multicall 3: LP detail reads + farm detail reads + staking rates (single RPC) ──
        const nonZeroLpIndices = pairBalances
          .map((bal, i) => (bal > 0n ? i : -1))
          .filter((i) => i >= 0);
        const nonZeroFarms = farmData.filter((f) => f.stakedAmount > 0n);
        const nonZeroStakingIndices = xTokenBalances
          .map((bal, i) => (bal > 0n ? i : -1))
          .filter((i) => i >= 0);

        const mc3Contracts = [
          // LP details: 4 calls per non-zero LP (getReserves, totalSupply, token0, token1)
          ...nonZeroLpIndices.flatMap((idx) => {
            const pairAddr = validPairs[idx];
            return [
              { address: pairAddr, abi: pairAbi, functionName: "getReserves" as const },
              { address: pairAddr, abi: pairAbi, functionName: "totalSupply" as const },
              { address: pairAddr, abi: pairAbi, functionName: "token0" as const },
              { address: pairAddr, abi: pairAbi, functionName: "token1" as const },
            ];
          }),
          // Farm details: rewardToken (1 call) + poolInfo per non-zero farm + token0/token1 per farm LP
          ...(nonZeroFarms.length > 0
            ? [
                {
                  address: CONTRACTS.MASTER_CHEF,
                  abi: masterchefAbi,
                  functionName: "rewardToken" as const,
                },
                ...nonZeroFarms.flatMap((farm) => [
                  {
                    address: CONTRACTS.MASTER_CHEF,
                    abi: masterchefAbi,
                    functionName: "poolInfo" as const,
                    args: [BigInt(farm.pid)] as const,
                  },
                ]),
              ]
            : []),
          // Staking: exchange rate per non-zero pool
          ...nonZeroStakingIndices.map((idx) => ({
            address: INFINITY_POOLS[idx].address,
            abi: INFINITY_POOLS[idx].abi,
            functionName: "getExchangeRate" as const,
          })),
        ];

        const mc3 = mc3Contracts.length > 0
          ? await client.multicall({ contracts: mc3Contracts, allowFailure: true })
          : [];

        let mc3Offset = 0;

        // Parse LP positions
        const lpPositions: SpyLpPosition[] = [];
        for (const idx of nonZeroLpIndices) {
          const pairAddr = validPairs[idx];
          const balance = pairBalances[idx];
          const base = mc3Offset;
          mc3Offset += 4;

          const reserves = mcResult<[bigint, bigint, number]>(mc3[base], [0n, 0n, 0]);
          const totalSupply = mcResult<bigint>(mc3[base + 1], 0n);
          const token0 = mcResult<`0x${string}`>(mc3[base + 2], ZERO_ADDR);
          const token1 = mcResult<`0x${string}`>(mc3[base + 3], ZERO_ADDR);

          const [t0Sym, t1Sym] = await Promise.all([
            addressToSymbol(token0),
            addressToSymbol(token1),
          ]);

          const token0Amount =
            totalSupply > 0n ? (reserves[0] * balance) / totalSupply : 0n;
          const token1Amount =
            totalSupply > 0n ? (reserves[1] * balance) / totalSupply : 0n;

          lpPositions.push({
            pairAddress: pairAddr,
            pair: `${t0Sym}/${t1Sym}`,
            lpBalance: formatEther(balance),
            token0Symbol: t0Sym,
            token0Amount: formatEther(token0Amount),
            token1Symbol: t1Sym,
            token1Amount: formatEther(token1Amount),
          });
        }

        // Parse farm positions
        const farmPositions: SpyFarmPosition[] = [];
        if (nonZeroFarms.length > 0) {
          const rewardTokenAddr = mcResult<`0x${string}`>(mc3[mc3Offset], ZERO_ADDR);
          mc3Offset += 1;
          const rewardTokenSymbol = await addressToSymbol(rewardTokenAddr);

          // Get poolInfo for each farm, then resolve LP symbols
          const poolInfos = nonZeroFarms.map((_, i) => {
            const info = mcResult<
              [`0x${string}`, bigint, bigint, bigint, bigint, boolean, boolean]
            >(mc3[mc3Offset + i], [ZERO_ADDR, 0n, 0n, 0n, 0n, false, false]);
            return info;
          });
          mc3Offset += nonZeroFarms.length;

          // Multicall 4: resolve LP pair symbols (token0 + token1 per farm LP)
          const mc4Contracts = poolInfos.flatMap((info) => [
            { address: info[0], abi: pairAbi, functionName: "token0" as const },
            { address: info[0], abi: pairAbi, functionName: "token1" as const },
          ]);

          const mc4 = mc4Contracts.length > 0
            ? await client.multicall({ contracts: mc4Contracts, allowFailure: true })
            : [];

          for (let i = 0; i < nonZeroFarms.length; i++) {
            const farm = nonZeroFarms[i];
            const t0 = mcResult<`0x${string}`>(mc4[i * 2], ZERO_ADDR);
            const t1 = mcResult<`0x${string}`>(mc4[i * 2 + 1], ZERO_ADDR);

            let lpSymbol = "LP";
            if (t0 !== ZERO_ADDR && t1 !== ZERO_ADDR) {
              const [s0, s1] = await Promise.all([
                addressToSymbol(t0),
                addressToSymbol(t1),
              ]);
              lpSymbol = `${s0}/${s1} LP`;
            }

            farmPositions.push({
              pid: farm.pid,
              lpTokenSymbol: lpSymbol,
              stakedAmount: formatEther(farm.stakedAmount),
              pendingReward: formatEther(farm.pendingReward),
              rewardToken: rewardTokenSymbol,
              canWithdraw: farm.canWithdraw,
            });
          }
        }

        // Parse staking positions
        const stakingPositions: SpyStakingPosition[] = [];
        for (const idx of nonZeroStakingIndices) {
          const pool = INFINITY_POOLS[idx];
          const exchangeRate = mcResult<bigint>(mc3[mc3Offset], BigInt(1e18));
          mc3Offset += 1;

          const underlyingAmount =
            (xTokenBalances[idx] * exchangeRate) / BigInt(1e18);

          stakingPositions.push({
            pool: pool.name,
            xTokenBalance: formatEther(xTokenBalances[idx]),
            underlyingAmount: formatEther(underlyingAmount),
            exchangeRate: formatEther(exchangeRate),
          });
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
