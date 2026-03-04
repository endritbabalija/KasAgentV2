import { defineChain } from "viem";

export const kasplexL2 = defineChain({
  id: 202555,
  name: "Kasplex L2",
  nativeCurrency: {
    name: "KAS",
    symbol: "KAS",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://evmrpc.kasplex.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "Kasplex Explorer",
      url: "https://explorer.kasplex.org",
    },
  },
  contracts: {
    multicall3: {
      address: "0x52f1eCcB5af51F2AFe0Dfb2f809F8617fDAA5be4",
    },
  },
});
