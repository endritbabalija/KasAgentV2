import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { kasplexL2 } from "./chains";
import { clientEnv } from "@/lib/env";

export const config = getDefaultConfig({
  appName: "KasAgent",
  projectId: clientEnv.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  chains: [kasplexL2],
  transports: {
    [kasplexL2.id]: http(clientEnv.NEXT_PUBLIC_RPC_URL, {
      retryCount: 0,
      timeout: 10_000,
      batch: { batchSize: 100, wait: 50 },
    }),
  },
  ssr: true,
});
