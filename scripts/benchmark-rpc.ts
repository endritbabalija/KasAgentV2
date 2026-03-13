/**
 * KasAgent RPC Benchmark
 *
 * Counts actual HTTP requests to the Kasplex L2 RPC endpoint for each
 * AI tool function, verifying that the multicall optimization reduces
 * RPC calls to the expected targets.
 *
 * Usage:  npm run benchmark
 */

// 1. Load .env.local (same loader Next.js uses)
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

// 2. Patch globalThis.fetch BEFORE any module creates an HTTP transport.
//    Every viem readContract / multicall goes through fetch → 1 HTTP request.
let rpcCount = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
  const input = args[0];
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  if (url.includes("evmrpc") || url.includes("kasplex")) {
    rpcCount++;
  }
  return originalFetch(...args);
}) as typeof fetch;

function reset() {
  rpcCount = 0;
}
function count() {
  return rpcCount;
}

// 3. Benchmark harness
type Result = {
  name: string;
  rpcs: number;
  expected: number;
  ms: number;
  ok: boolean;
  error?: string;
};
const results: Result[] = [];

async function bench(
  name: string,
  expected: number,
  fn: () => Promise<unknown>,
) {
  reset();
  const t0 = performance.now();
  try {
    await fn();
    const ms = performance.now() - t0;
    const rpcs = count();
    results.push({ name, rpcs, expected, ms, ok: rpcs <= expected });
  } catch (e) {
    const ms = performance.now() - t0;
    results.push({
      name,
      rpcs: count(),
      expected,
      ms,
      ok: false,
      error: (e as Error).message.slice(0, 80),
    });
  }
}

// 4. Tool call wrappers — call each tool's execute fn with typed args
//    and a minimal options stub so the AI SDK doesn't complain.
const toolOpts = { toolCallId: "bench", messages: [] as never[] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function callTool(toolObj: { execute?: (...args: any[]) => any }, args: unknown) {
  return toolObj.execute!(args, toolOpts);
}

// 5. Run all benchmarks
async function main() {
  console.log("\n  KasAgent RPC Benchmark — Multicall Optimization");
  console.log("  Counting actual HTTP requests to Kasplex L2 RPC.\n");

  // Dynamic imports so fetch patch is in place before viem client is created
  const { getAllTokens, getDiscoveryData } = await import(
    "@/lib/token-registry"
  );
  const { zealousYieldTools: yieldTools } = await import("@/lib/ai/tools/zealous/yield");
  const { zealousLiquidityTools: liquidityTools } = await import("@/lib/ai/tools/zealous/liquidity");
  const { zealousFarmTools: farmTools } = await import("@/lib/ai/tools/zealous/farms");
  const { zealousStakingTools: stakingTools } = await import("@/lib/ai/tools/zealous/staking");
  const { oracleTools } = await import("@/lib/ai/tools/oracle");
  const { zealousMembershipTools: membershipTools } = await import("@/lib/ai/tools/zealous/membership");

  // ── Phase 1: Token Discovery ──
  // Cold: 1 readContract (allPairsLength) + 3 multicalls = 4 RPCs
  // +2 one-time overhead from viem fallback transport ranking (eth_chainId per transport)
  await bench("Token discovery (cold)", 6, () => getAllTokens());

  // Warm: served from 5-min in-memory cache = 0 RPCs
  await bench("Token discovery (warm)", 0, () => getAllTokens());
  await bench("getDiscoveryData (warm)", 0, () => getDiscoveryData());

  // ── Phase 2: Yield ──
  // Pairs from cache (0 RPCs) + mc1 (yield reads) + mc2 (farm poolInfos) = 2
  await bench("Yield discovery", 2, () =>
    callTool(yieldTools.zealous_discoverYieldOpportunities, {}),
  );

  // ── Phase 3: Farms ──
  // mc1 (4 globals) + mc2 (poolInfo per pool) = 2
  await bench("getActiveFarms", 2, () =>
    callTool(farmTools.zealous_getActiveFarms, {}),
  );

  // ── Phase 4: Staking ──
  // 1 multicall with 8 reads
  await bench("getInfinityPoolRates", 1, () =>
    callTool(stakingTools.zealous_getInfinityPoolRates, {}),
  );

  // ── Phase 5: Liquidity ──
  // getPair (1) + multicall reserves/token0/totalSupply (1) = 2
  await bench("getPoolReserves (KAS/ZEAL)", 2, () =>
    callTool(liquidityTools.zealous_getPoolReserves, { tokenA: "KAS", tokenB: "ZEAL" }),
  );

  // ── Phase 6: Oracle ──
  // getPair (1) + multicall reserves/token0 (1) = 2
  await bench("getTokenPrice (ZEAL)", 2, () =>
    callTool(oracleTools.getTokenPrice, { token: "ZEAL" }),
  );

  // ── Phase 7: Membership ──
  // 1 multicall (9 reads) + 1 discount check = 2  (run in parallel)
  await bench("getMembershipStatus", 2, () =>
    callTool(membershipTools.zealous_getMembershipStatus, {
      walletAddress: "0x0000000000000000000000000000000000000001",
    }),
  );

  // ── Print results table ──
  const nameW = 40;
  const line = (l: string, m: string, r: string) =>
    `  ${l}${"─".repeat(nameW + 2)}${m}${"─".repeat(7)}${m}${"─".repeat(10)}${m}${"─".repeat(9)}${r}`;

  console.log(line("┌", "┬", "┐"));
  console.log(
    `  │ ${"Benchmark".padEnd(nameW)} │ ${"RPCs".padStart(5)} │ ${"Time".padStart(8)} │ ${"Status".padEnd(7)} │`,
  );
  console.log(line("├", "┼", "┤"));

  for (const r of results) {
    const status = r.error
      ? "ERROR"
      : r.ok
        ? `✓ ≤${r.expected}`
        : `✗ >${r.expected}`;
    const rpcs = r.error ? "—" : String(r.rpcs);
    const ms = `${r.ms.toFixed(0)}ms`;
    console.log(
      `  │ ${r.name.padEnd(nameW)} │ ${rpcs.padStart(5)} │ ${ms.padStart(8)} │ ${status.padEnd(7)} │`,
    );
    if (r.error) {
      console.log(
        `  │ ${"  └ " + r.error.padEnd(nameW - 4)} │       │          │         │`,
      );
    }
  }
  console.log(line("└", "┴", "┘"));

  // Summary
  const totalRpcs = results.reduce((s, r) => s + (r.error ? 0 : r.rpcs), 0);
  const budget = results.reduce((s, r) => s + r.expected, 0);
  const allOk = results.every((r) => r.ok && !r.error);
  console.log(
    `\n  Total: ${totalRpcs} RPCs across ${results.length} benchmarks (budget: ≤${budget})`,
  );
  console.log(`  ${allOk ? "✓ ALL PASS" : "✗ SOME FAILURES"}\n`);

  if (!allOk) process.exit(1);
}

main().catch((e) => {
  console.error("\n  Fatal:", e.message);
  process.exit(1);
});
