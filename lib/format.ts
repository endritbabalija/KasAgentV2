import { formatUnits } from "viem";

export function formatTokenAmount(
  value: bigint,
  decimals: number,
  displayDecimals: number = 4
): string {
  const formatted = formatUnits(value, decimals);
  const [whole, frac = ""] = formatted.split(".");
  const truncated = frac.slice(0, displayDecimals);
  if (!truncated || truncated === "0".repeat(truncated.length)) {
    return whole;
  }
  return `${whole}.${truncated.replace(/0+$/, "")}`;
}

export function shortenAddress(address: string, chars: number = 4): string {
  if (address.length < chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
