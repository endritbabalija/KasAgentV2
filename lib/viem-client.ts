import { createPublicClient, http, fallback } from "viem";
import { kasplexL2 } from "@/config/chains";
import { clientEnv } from "@/lib/env";

const httpOptions = { retryCount: 2, timeout: 15_000 } as const;

const transports = [http(clientEnv.NEXT_PUBLIC_RPC_URL, httpOptions)];
if (clientEnv.NEXT_PUBLIC_RPC_URL_FALLBACK) {
  transports.push(http(clientEnv.NEXT_PUBLIC_RPC_URL_FALLBACK, httpOptions));
}

export const client = createPublicClient({
  chain: kasplexL2,
  transport: transports.length > 1 ? fallback(transports) : transports[0],
});
