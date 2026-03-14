import { CONTRACTS } from "./contracts";

export type ProtocolId = "zealous" | "kroko" | "kaspacom";

export type ProtocolFeature = "swap" | "liquidity" | "farms" | "staking" | "membership";

export interface ProtocolConfig {
  id: ProtocolId;
  name: string;
  shortName: string;
  features: ProtocolFeature[];
  contracts: Record<string, `0x${string}`>;
  factoryAddress?: `0x${string}`;
  factoryType?: "uniswap-v2";
  apiBaseUrl?: string;
  description: string;
}

export const PROTOCOLS: Record<ProtocolId, ProtocolConfig> = {
  zealous: {
    id: "zealous",
    name: "ZealousSwap",
    shortName: "Zealous",
    features: ["swap", "liquidity", "farms", "staking", "membership"],
    contracts: {
      router: CONTRACTS.ROUTER,
      factory: CONTRACTS.FACTORY,
      masterChef: CONTRACTS.MASTER_CHEF,
      infinityPoolZeal: CONTRACTS.INFINITY_POOL_ZEAL,
      infinityPoolNacho: CONTRACTS.INFINITY_POOL_NACHO,
      infinityPoolKasper: CONTRACTS.INFINITY_POOL_KASPER,
      wkas: CONTRACTS.WKAS,
      discountManager: CONTRACTS.DISCOUNT_MANAGER,
      membership: CONTRACTS.MEMBERSHIP,
      nftStaking: CONTRACTS.NFT_STAKING,
    },
    factoryAddress: CONTRACTS.FACTORY,
    factoryType: "uniswap-v2",
    description: `AMM DEX with token swaps, LP provision, MasterChef farms (ZEAL emissions), and InfinityPool single-sided staking (ZEAL/NACHO/KASPER). Fee discounts available via Membership, NFT staking, or xZEAL holding (0.2% instead of 0.3%). ZEAL token: 240M supply, utility for fee discounts, staking, governance, revenue sharing.`,
  },
  kroko: {
    id: "kroko",
    name: "KrokoSwap",
    shortName: "Kroko",
    features: ["swap", "liquidity"],
    contracts: {
      permit2: "0x2E1987F680FD7Bc8B33d3Bf94f12B988A0B50034" as `0x${string}`,
      universalRouter: "0xefeCc1c2dE3BfE4C6D43030F2AcDD5C3cE279024" as `0x${string}`,
      v2Factory: "0x4373b7Fcf5059A785843cD224129e01d243Aef71" as `0x${string}`,
      v2Router: "0xC7ca845B8302346e1C7227f03bb9EFb35ecD51fe" as `0x${string}`,
      v3Factory: "0x0dfb1Bb755d872EA1fa4d95E4ad0c2E6317Ce9B9" as `0x${string}`,
      v3PositionManager: "0x343b244bEDF133D57C61b241557bF29AA32ea4F9" as `0x${string}`,
      v3Router: "0x1F896179244C2675b6a1F36376cDF3B125d72B63" as `0x${string}`,
      v3QuoterV2: "0xC3D66b70F3BA12c1D1Ec5A20b0feB855b147812e" as `0x${string}`,
    },
    factoryAddress: "0x4373b7Fcf5059A785843cD224129e01d243Aef71" as `0x${string}`,
    factoryType: "uniswap-v2",
    apiBaseUrl: "https://krokoswap.io/swap-api",
    description: `Dual-AMM DEX with V2 constant-product pools and V3 concentrated-liquidity pools. Universal Router handles optimal routing across both pool types. Permit2 approval flow. REST API for swap quoting and calldata generation. No farms or staking currently.`,
  },
  kaspacom: {
    id: "kaspacom",
    name: "KaspaCom",
    shortName: "KaspaCom",
    features: ["swap"],
    contracts: {
      router: "0x3a1f0bD164fe9D8fa18Da5abAB352dC634CA5F10" as `0x${string}`,
      factory: "0xa9CBa43A407c9Eb30933EA21f7b9D74A128D613c" as `0x${string}`,
      proxy: "0x4c5BEaAE83577E3a117ce2F477fC42a1EA39A8a3" as `0x${string}`,
      wkas: "0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e" as `0x${string}`,
    },
    factoryAddress: "0xa9CBa43A407c9Eb30933EA21f7b9D74A128D613c" as `0x${string}`,
    factoryType: "uniswap-v2",
    description: `AMM DEX (Uniswap V2 fork) with a fixed 1% swap fee hardcoded in pair math. Standard V2 Router with swapExactETHForTokens/swapExactTokensForETH naming. No farms, staking, or fee discounts. Swap only.`,
  },
};

export const SHARED = {
  WKAS: "0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e" as `0x${string}`,
};

/** Scan all protocol contracts and return the matching ProtocolConfig, or null. */
export function getProtocolByContract(address: string): ProtocolConfig | null {
  const lower = address.toLowerCase();
  for (const protocol of Object.values(PROTOCOLS)) {
    for (const addr of Object.values(protocol.contracts)) {
      if (addr.toLowerCase() === lower) return protocol;
    }
  }
  return null;
}

/** Return all V2 factory addresses with their protocol IDs. */
export function getAllV2Factories(): { protocolId: ProtocolId; address: `0x${string}` }[] {
  return Object.values(PROTOCOLS)
    .filter((p) => p.factoryAddress && p.factoryType === "uniswap-v2")
    .map((p) => ({ protocolId: p.id, address: p.factoryAddress! }));
}

/** Get a protocol config by ID. */
export function getProtocol(id: ProtocolId): ProtocolConfig {
  return PROTOCOLS[id];
}

/** Filter protocols by feature. */
export function getProtocolsWithFeature(feature: ProtocolFeature): ProtocolConfig[] {
  return Object.values(PROTOCOLS).filter((p) => p.features.includes(feature));
}
