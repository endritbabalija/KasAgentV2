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

  // Step 2: Read token0/token1 from each pair
  const uniqueAddresses = new Set<string>();
  const pairTokens = await Promise.all(
    pairAddresses.map(async (addr) => {
      const [token0, token1] = await Promise.all([
        client.readContract({ address: addr, abi: pairAbi, functionName: "token0" }),
        client.readContract({ address: addr, abi: pairAbi, functionName: "token1" }),
      ]);
      return [token0 as string, token1 as string];
    })
  );

  for (const [t0, t1] of pairTokens) {
    uniqueAddresses.add(t0.toLowerCase());
    uniqueAddresses.add(t1.toLowerCase());
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

  // Always include KAS native
  const tokens: Token[] = [KAS_NATIVE, ...metadataResults];

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
