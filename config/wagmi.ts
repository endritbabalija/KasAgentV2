import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { kasplexL2 } from "./chains";

export const config = getDefaultConfig({
  appName: "KasAgent",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  chains: [kasplexL2],
  transports: {
    [kasplexL2.id]: http("https://evmrpc.kasplex.org", {
      retryCount: 0,
      timeout: 10_000,
      batch: { batchSize: 100, wait: 50 },
    }),
  },
  ssr: true,
});
