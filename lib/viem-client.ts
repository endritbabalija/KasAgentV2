import { createPublicClient, http } from "viem";
import { kasplexL2 } from "@/config/chains";

export const client = createPublicClient({
  chain: kasplexL2,
  transport: http(),
});
