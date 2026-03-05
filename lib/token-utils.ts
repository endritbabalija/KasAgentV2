import { KASPLEX_TOKENS } from "@/config/tokens";
import { shortenAddress } from "@/lib/format";

export function getTokenSymbol(address: string): string {
  const token = KASPLEX_TOKENS.find(
    (t) => t.address?.toLowerCase() === address.toLowerCase()
  );
  return token?.symbol ?? shortenAddress(address);
}
