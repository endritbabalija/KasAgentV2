/** Extract a successful multicall result or return a fallback. */
export function mcResult<T>(entry: { status: string; result?: unknown }, fallback: T): T {
  return entry.status === "success" ? (entry.result as T) : fallback;
}
