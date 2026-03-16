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

/** Format a string-encoded number for display (used in card components). */
export function formatDisplayAmount(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  if (n >= 1_000_000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

/** Format KAS amount with adaptive precision (used in yield cards). */
export function formatKasAmount(n: number): string {
  if (n >= 1_000_000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1_000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

/** Format a price string with special handling for very small values. */
export function formatPrice(price: string): string {
  const num = parseFloat(price);
  if (num === 0) return "0";
  if (num >= 1) return num.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (num < 0.000001) return num.toExponential(4);
  return num.toLocaleString("en-US", { maximumSignificantDigits: 4 });
}

/** Relative time string from an ISO date (e.g. "5m ago", "2h ago", "Mar 15"). */
export function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(dateStr));
}
