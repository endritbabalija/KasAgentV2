import { defineChain } from "viem";
import { clientEnv } from "@/lib/env";

export const EXPLORER_URL = "https://explorer.kasplex.org";

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
      http: [clientEnv.NEXT_PUBLIC_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "Kasplex Explorer",
      url: EXPLORER_URL,
    },
  },
  contracts: {
    multicall3: {
      address: "0x52f1eCcB5af51F2AFe0Dfb2f809F8617fDAA5be4",
    },
  },
});
