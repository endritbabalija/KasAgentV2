import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, fallback, cookieStorage, createStorage } from "wagmi";
import { kasplexL2 } from "./chains";
import { clientEnv } from "@/lib/env";

const httpOptions = {
  retryCount: 2,
  timeout: 10_000,
  batch: { batchSize: 100, wait: 50 },
} as const;

const transports = [http(clientEnv.NEXT_PUBLIC_RPC_URL, httpOptions)];
if (clientEnv.NEXT_PUBLIC_RPC_URL_FALLBACK) {
  transports.push(http(clientEnv.NEXT_PUBLIC_RPC_URL_FALLBACK, httpOptions));
}

export const config = getDefaultConfig({
  appName: "KasAgent",
  projectId: clientEnv.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  chains: [kasplexL2],
  transports: {
    [kasplexL2.id]: transports.length > 1 ? fallback(transports) : transports[0],
  },
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});
