import type { Abi } from "viem";
import { CONTRACTS } from "./contracts";
import {
  infinityPoolZealAbi,
  infinityPoolNachoAbi,
  infinityPoolKasperAbi,
} from "./abis";

export interface InfinityPoolConfig {
  name: string;
  address: `0x${string}`;
  abi: Abi;
  xTokenFn: string;
}

export const INFINITY_POOLS: readonly InfinityPoolConfig[] = [
  {
    name: "ZEAL",
    address: CONTRACTS.INFINITY_POOL_ZEAL,
    abi: infinityPoolZealAbi,
    xTokenFn: "xZealToken",
  },
  {
    name: "NACHO",
    address: CONTRACTS.INFINITY_POOL_NACHO,
    abi: infinityPoolNachoAbi,
    xTokenFn: "xNachoToken",
  },
  {
    name: "KASPER",
    address: CONTRACTS.INFINITY_POOL_KASPER,
    abi: infinityPoolKasperAbi,
    xTokenFn: "xKasperToken",
  },
];

/** Lookup a pool config by token symbol (case-insensitive). */
export function getInfinityPool(token: string): InfinityPoolConfig | undefined {
  return INFINITY_POOLS.find((p) => p.name === token.toUpperCase());
}

/** Map of token symbol to ABI, for execution cards. */
export const INFINITY_POOL_ABIS: Record<string, Abi> = Object.fromEntries(
  INFINITY_POOLS.map((p) => [p.name, p.abi])
);
