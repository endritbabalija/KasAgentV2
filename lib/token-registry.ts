import { CONTRACTS } from "@/config/contracts";
import { getAllV2Factories, type ProtocolId } from "@/config/protocols";
import { factoryAbi, pairAbi, erc20Abi } from "@/config/abis";
import type { Token } from "@/config/tokens";
import { KAS_NATIVE } from "@/config/tokens";
import { client } from "@/lib/viem-client";
import { mcResult } from "@/lib/multicall";

export interface PairDiscoveryData {
  address: `0x${string}`;
  token0: string;
  token1: string;
  reserve0: bigint;
  reserve1: bigint;
  protocolId: ProtocolId;
}

interface DiscoveryCache {
  tokens: Token[];
  pairs: PairDiscoveryData[];
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let cached: DiscoveryCache | null = null;
let cachedAt = 0;

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as `0x${string}`;

/** Discover pairs from a single V2 factory. */
async function discoverFactory(
  factoryAddress: `0x${string}`,
  protocolId: ProtocolId
): Promise<{ pairs: PairDiscoveryData[]; uniqueAddresses: Set<string>; wkasLiquidity: Map<string, bigint> }> {
  const wkasAddr = CONTRACTS.WKAS.toLowerCase();

  // Round 1: pair count
  const pairsLength = (await client.readContract({
    address: factoryAddress,
    abi: factoryAbi,
    functionName: "allPairsLength",
  })) as bigint;

  const n = Number(pairsLength);
  if (n === 0) {
    return { pairs: [], uniqueAddresses: new Set(), wkasLiquidity: new Map() };
  }

  // Round 2: batch all allPairs(i)
  const pairAddressResults = await client.multicall({
    contracts: Array.from({ length: n }, (_, i) => ({
      address: factoryAddress,
      abi: factoryAbi,
      functionName: "allPairs" as const,
      args: [BigInt(i)] as const,
    })),
    allowFailure: true,
  });

  const pairAddresses = pairAddressResults
    .map((r) => mcResult<`0x${string}`>(r, ZERO_ADDR))
    .filter((a) => a !== ZERO_ADDR);

  // Round 3: token0 + token1 + getReserves per pair
  const pairDetailResults = await client.multicall({
    contracts: pairAddresses.flatMap((addr) => [
      { address: addr, abi: pairAbi, functionName: "token0" as const },
      { address: addr, abi: pairAbi, functionName: "token1" as const },
      { address: addr, abi: pairAbi, functionName: "getReserves" as const },
    ]),
    allowFailure: true,
  });

  const uniqueAddresses = new Set<string>();
  const wkasLiquidity = new Map<string, bigint>();
  const pairs: PairDiscoveryData[] = [];

  for (let i = 0; i < pairAddresses.length; i++) {
    const base = i * 3;
    const t0 = mcResult<string>(pairDetailResults[base], ZERO_ADDR).toLowerCase();
    const t1 = mcResult<string>(pairDetailResults[base + 1], ZERO_ADDR).toLowerCase();
    const reserves = mcResult<[bigint, bigint, number]>(pairDetailResults[base + 2], [0n, 0n, 0]);

    if (t0 === ZERO_ADDR || t1 === ZERO_ADDR) continue;

    const [r0, r1] = reserves;
    pairs.push({
      address: pairAddresses[i],
      token0: t0,
      token1: t1,
      reserve0: r0,
      reserve1: r1,
      protocolId,
    });

    uniqueAddresses.add(t0);
    uniqueAddresses.add(t1);

    // Track max WKAS-paired liquidity per token (for dedup)
    if (t0 === wkasAddr) {
      const prev = wkasLiquidity.get(t1) ?? 0n;
      if (r0 > prev) wkasLiquidity.set(t1, r0);
    } else if (t1 === wkasAddr) {
      const prev = wkasLiquidity.get(t0) ?? 0n;
      if (r1 > prev) wkasLiquidity.set(t0, r1);
    }
  }

  return { pairs, uniqueAddresses, wkasLiquidity };
}

async function discoverAll(): Promise<DiscoveryCache> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL) return cached;

  const factories = getAllV2Factories();

  // Discover pairs from all factories in parallel
  const factoryResults = await Promise.all(
    factories.map((f) => discoverFactory(f.address, f.protocolId))
  );

  // Merge results
  const allPairs: PairDiscoveryData[] = [];
  const allUniqueAddresses = new Set<string>();
  const mergedWkasLiquidity = new Map<string, bigint>();

  for (const result of factoryResults) {
    allPairs.push(...result.pairs);
    for (const addr of result.uniqueAddresses) allUniqueAddresses.add(addr);
    for (const [addr, liq] of result.wkasLiquidity) {
      const prev = mergedWkasLiquidity.get(addr) ?? 0n;
      if (liq > prev) mergedWkasLiquidity.set(addr, liq);
    }
  }

  if (allPairs.length === 0) {
    const result: DiscoveryCache = { tokens: [KAS_NATIVE], pairs: [] };
    cached = result;
    cachedAt = now;
    return result;
  }

  // Round 4: 1 multicall — batch name + symbol + decimals per unique token
  const addresses = Array.from(allUniqueAddresses);
  const metadataResults = await client.multicall({
    contracts: addresses.flatMap((addr) => [
      { address: addr as `0x${string}`, abi: erc20Abi, functionName: "name" as const },
      { address: addr as `0x${string}`, abi: erc20Abi, functionName: "symbol" as const },
      { address: addr as `0x${string}`, abi: erc20Abi, functionName: "decimals" as const },
    ]),
    allowFailure: true,
  });

  const metadataTokens: Token[] = [];
  for (let i = 0; i < addresses.length; i++) {
    const base = i * 3;
    const name = mcResult<string>(metadataResults[base], "Unknown");
    const symbol = mcResult<string>(metadataResults[base + 1], addresses[i].slice(0, 8));
    const decimals = mcResult<number>(metadataResults[base + 2], 18);

    metadataTokens.push({
      address: addresses[i] as `0x${string}`,
      symbol,
      name,
      decimals: Number(decimals),
    });
  }

  // Deduplicate by symbol — prefer deepest WKAS-paired liquidity
  const bySymbol = new Map<string, Token[]>();
  for (const token of metadataTokens) {
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
    let best = candidates[0];
    let bestLiq = mergedWkasLiquidity.get(best.address!.toLowerCase()) ?? 0n;
    for (let i = 1; i < candidates.length; i++) {
      const liq = mergedWkasLiquidity.get(candidates[i].address!.toLowerCase()) ?? 0n;
      if (liq > bestLiq) {
        best = candidates[i];
        bestLiq = liq;
      }
    }
    deduped.push(best);
  }

  const result: DiscoveryCache = {
    tokens: [KAS_NATIVE, ...deduped],
    pairs: allPairs,
  };

  cached = result;
  cachedAt = now;
  return result;
}

/** Returns both tokens and pair data from the same cache. */
export async function getDiscoveryData(): Promise<DiscoveryCache> {
  return discoverAll();
}

export async function getAllTokens(): Promise<Token[]> {
  const data = await discoverAll();
  return data.tokens;
}

export async function resolveTokenAddress(symbol: string): Promise<`0x${string}` | null> {
  if (symbol.toUpperCase() === "KAS") return CONTRACTS.WKAS;
  const { tokens } = await discoverAll();
  const token = tokens.find(
    (t) => t.symbol.toUpperCase() === symbol.toUpperCase()
  );
  return token?.address ?? null;
}

export async function addressToSymbol(addr: string): Promise<string> {
  const { tokens } = await discoverAll();
  return (
    tokens.find((t) => t.address?.toLowerCase() === addr.toLowerCase())?.symbol ?? "???"
  );
}

export async function getTokenDecimals(symbol: string): Promise<number> {
  const { tokens } = await discoverAll();
  const token = tokens.find(
    (t) => t.symbol.toUpperCase() === symbol.toUpperCase()
  );
  return token?.decimals ?? 18;
}
