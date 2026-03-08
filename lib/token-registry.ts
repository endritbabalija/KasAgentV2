import { CONTRACTS } from "@/config/contracts";
import { factoryAbi, pairAbi, erc20Abi } from "@/config/abis";
import type { Token } from "@/config/tokens";
import { KAS_NATIVE } from "@/config/tokens";
import { client } from "@/lib/viem-client";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let cachedTokens: Token[] | null = null;
let cachedAt = 0;

async function discoverTokens(): Promise<Token[]> {
  const now = Date.now();
  if (cachedTokens && now - cachedAt < CACHE_TTL) {
    return cachedTokens;
  }

  // Step 1: Get all pair addresses from Factory
  const pairsLength = (await client.readContract({
    address: CONTRACTS.FACTORY,
    abi: factoryAbi,
    functionName: "allPairsLength",
  })) as bigint;

  const pairAddresses = await Promise.all(
    Array.from({ length: Number(pairsLength) }, (_, i) =>
      client.readContract({
        address: CONTRACTS.FACTORY,
        abi: factoryAbi,
        functionName: "allPairs",
        args: [BigInt(i)],
      })
    )
  ) as `0x${string}`[];

  // Step 2: Read token0/token1 and reserves from each pair
  const uniqueAddresses = new Set<string>();
  const wkasAddr = CONTRACTS.WKAS.toLowerCase();
  const wkasLiquidity = new Map<string, bigint>();

  const pairData = await Promise.all(
    pairAddresses.map(async (addr) => {
      const [token0, token1, reserves] = await Promise.all([
        client.readContract({ address: addr, abi: pairAbi, functionName: "token0" }),
        client.readContract({ address: addr, abi: pairAbi, functionName: "token1" }),
        client.readContract({ address: addr, abi: pairAbi, functionName: "getReserves" }),
      ]);
      const t0 = (token0 as string).toLowerCase();
      const t1 = (token1 as string).toLowerCase();
      const [r0, r1] = reserves as [bigint, bigint, number];
      return { token0: t0, token1: t1, reserve0: r0, reserve1: r1 };
    })
  );

  for (const pair of pairData) {
    uniqueAddresses.add(pair.token0);
    uniqueAddresses.add(pair.token1);

    // Track max WKAS-paired liquidity per token
    if (pair.token0 === wkasAddr) {
      const prev = wkasLiquidity.get(pair.token1) ?? 0n;
      if (pair.reserve0 > prev) wkasLiquidity.set(pair.token1, pair.reserve0);
    } else if (pair.token1 === wkasAddr) {
      const prev = wkasLiquidity.get(pair.token0) ?? 0n;
      if (pair.reserve1 > prev) wkasLiquidity.set(pair.token0, pair.reserve1);
    }
  }

  // Step 3: Read ERC20 metadata for each unique token
  const addresses = Array.from(uniqueAddresses);
  const metadataResults = await Promise.all(
    addresses.map(async (addr): Promise<Token> => {
      try {
        const [name, symbol, decimals] = await Promise.all([
          client.readContract({ address: addr as `0x${string}`, abi: erc20Abi, functionName: "name" }),
          client.readContract({ address: addr as `0x${string}`, abi: erc20Abi, functionName: "symbol" }),
          client.readContract({ address: addr as `0x${string}`, abi: erc20Abi, functionName: "decimals" }),
        ]);
        return {
          address: addr as `0x${string}`,
          symbol: symbol as string,
          name: name as string,
          decimals: Number(decimals),
        };
      } catch {
        return {
          address: addr as `0x${string}`,
          symbol: addr.slice(0, 8),
          name: "Unknown",
          decimals: 18,
        };
      }
    })
  );

  // Step 4: Deduplicate by symbol — prefer deepest WKAS-paired liquidity
  const bySymbol = new Map<string, Token[]>();
  for (const token of metadataResults) {
    const sym = token.symbol.toUpperCase();
    const arr = bySymbol.get(sym) ?? [];
    arr.push(token);
    bySymbol.set(sym, arr);
  }

  const deduped: Token[] = [];
  for (const [, candidates] of bySymbol) {
    if (candidates.length === 1) {
      deduped.push(candidates[0]);
      continue;
    }
    // Pick the candidate with the deepest WKAS-paired liquidity
    let best = candidates[0];
    let bestLiq = wkasLiquidity.get(best.address!.toLowerCase()) ?? 0n;
    for (let i = 1; i < candidates.length; i++) {
      const liq = wkasLiquidity.get(candidates[i].address!.toLowerCase()) ?? 0n;
      if (liq > bestLiq) {
        best = candidates[i];
        bestLiq = liq;
      }
    }
    deduped.push(best);
  }

  // Always include KAS native
  const tokens: Token[] = [KAS_NATIVE, ...deduped];

  cachedTokens = tokens;
  cachedAt = now;
  return tokens;
}

export async function getAllTokens(): Promise<Token[]> {
  return discoverTokens();
}

export async function resolveTokenAddress(symbol: string): Promise<`0x${string}` | null> {
  if (symbol.toUpperCase() === "KAS") return CONTRACTS.WKAS;
  const tokens = await discoverTokens();
  const token = tokens.find(
    (t) => t.symbol.toUpperCase() === symbol.toUpperCase()
  );
  return token?.address ?? null;
}

export async function addressToSymbol(addr: string): Promise<string> {
  const tokens = await discoverTokens();
  return (
    tokens.find((t) => t.address?.toLowerCase() === addr.toLowerCase())?.symbol ?? "???"
  );
}

export async function getTokenDecimals(symbol: string): Promise<number> {
  const tokens = await discoverTokens();
  const token = tokens.find(
    (t) => t.symbol.toUpperCase() === symbol.toUpperCase()
  );
  return token?.decimals ?? 18;
}
