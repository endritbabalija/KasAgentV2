import type { SerializedPortfolio } from "./serializers";

export interface SnapshotData {
  balances: { symbol: string; balance: string }[];
  lpPositions: {
    pair: string;
    lpBalance: string;
    token0Amount: string;
    token1Amount: string;
    protocol?: string;
  }[];
  farmPositions: {
    pid: number;
    stakedAmount: string;
    pendingReward: string;
    canWithdraw: boolean;
  }[];
  stakingPositions: {
    pool: string;
    xTokenBalance: string;
    underlyingAmount: string;
    exchangeRate: string;
  }[];
  snapshotAt: Date;
}

function pctChange(oldVal: number, newVal: number): number {
  if (oldVal === 0) return newVal === 0 ? 0 : 100;
  return ((newVal - oldVal) / oldVal) * 100;
}

function fmtPct(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function relativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (days > 0) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (minutes > 0) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  return "just now";
}

const THRESHOLD = 0.01; // 1%

export function computePortfolioDiff(
  current: SerializedPortfolio,
  previous: SnapshotData,
  snapshotAt: Date
): string {
  const changes: string[] = [];

  // ── Balance diffs ──
  const prevBalMap = new Map(previous.balances.map((b) => [b.symbol, b.balance]));
  const currBalMap = new Map(current.balances.map((b) => [b.symbol, b.balance]));

  for (const [symbol, currBal] of currBalMap) {
    const prevBal = prevBalMap.get(symbol);
    if (!prevBal) {
      changes.push(`New token: ${symbol} (${fmtNum(parseFloat(currBal))})`);
      continue;
    }
    const oldVal = parseFloat(prevBal);
    const newVal = parseFloat(currBal);
    const pct = pctChange(oldVal, newVal);
    if (Math.abs(pct) > THRESHOLD * 100) {
      changes.push(
        `${symbol}: ${fmtNum(oldVal)} → ${fmtNum(newVal)} (${fmtPct(pct)})`
      );
    }
  }
  for (const [symbol, prevBal] of prevBalMap) {
    if (!currBalMap.has(symbol)) {
      changes.push(`${symbol}: ${fmtNum(parseFloat(prevBal))} → 0 (removed)`);
    }
  }

  // ── LP position diffs ──
  // Key by pair+protocol to avoid collisions if same pair exists on multiple DEXes
  const lpKey = (lp: { pair: string; protocol?: string }) =>
    `${lp.pair}:${lp.protocol ?? "unknown"}`;
  const lpLabel = (lp: { pair: string; protocol?: string }) =>
    lp.protocol ? `${lp.pair} (${lp.protocol})` : lp.pair;

  const prevLpMap = new Map(previous.lpPositions.map((lp) => [lpKey(lp), lp]));
  const currLpMap = new Map(current.lpPositions.map((lp) => [lpKey(lp), lp]));

  for (const [key, currLp] of currLpMap) {
    const prevLp = prevLpMap.get(key);
    if (!prevLp) {
      changes.push(`New LP position: ${lpLabel(currLp)}`);
      continue;
    }
    const oldBal = parseFloat(prevLp.lpBalance);
    const newBal = parseFloat(currLp.lpBalance);
    const pct = pctChange(oldBal, newBal);
    if (Math.abs(pct) > THRESHOLD * 100) {
      changes.push(`LP ${lpLabel(currLp)}: ${fmtPct(pct)} change in position size`);
    }
  }
  for (const [key, prevLp] of prevLpMap) {
    if (!currLpMap.has(key)) {
      changes.push(`Removed LP position: ${lpLabel(prevLp)}`);
    }
  }

  // ── Farm position diffs ──
  const prevFarmMap = new Map(previous.farmPositions.map((f) => [f.pid, f]));
  const currFarmMap = new Map(current.farmPositions.map((f) => [f.pid, f]));

  for (const [pid, currFarm] of currFarmMap) {
    const prevFarm = prevFarmMap.get(pid);
    if (!prevFarm) {
      changes.push(`New farm position: PID ${pid}`);
      continue;
    }
    // Always flag pending reward growth
    const oldReward = parseFloat(prevFarm.pendingReward);
    const newReward = parseFloat(currFarm.pendingReward);
    if (newReward > oldReward && newReward > 0) {
      const earned = newReward - oldReward;
      changes.push(
        `Farm PID ${pid}: ${fmtNum(earned)} rewards accrued (${fmtNum(newReward)} total unclaimed)`
      );
    }
    // Flag stake changes > 1%
    const oldStake = parseFloat(prevFarm.stakedAmount);
    const newStake = parseFloat(currFarm.stakedAmount);
    const stakePct = pctChange(oldStake, newStake);
    if (Math.abs(stakePct) > THRESHOLD * 100) {
      changes.push(
        `Farm PID ${pid}: staked ${fmtNum(oldStake)} → ${fmtNum(newStake)} (${fmtPct(stakePct)})`
      );
    }
  }
  for (const [pid] of prevFarmMap) {
    if (!currFarmMap.has(pid)) {
      changes.push(`Removed farm position: PID ${pid}`);
    }
  }

  // ── Staking position diffs ──
  const prevStakeMap = new Map(
    previous.stakingPositions.map((s) => [s.pool, s])
  );
  const currStakeMap = new Map(
    current.stakingPositions.map((s) => [s.pool, s])
  );

  for (const [pool, currStake] of currStakeMap) {
    const prevStake = prevStakeMap.get(pool);
    if (!prevStake) {
      changes.push(`New staking position: ${pool}`);
      continue;
    }
    // Always flag exchange rate increases (earnings)
    const oldRate = parseFloat(prevStake.exchangeRate);
    const newRate = parseFloat(currStake.exchangeRate);
    if (newRate > oldRate) {
      const oldUnderlying = parseFloat(prevStake.underlyingAmount);
      const newUnderlying = parseFloat(currStake.underlyingAmount);
      const earned = newUnderlying - oldUnderlying;
      if (earned > 0) {
        changes.push(
          `${pool} staking: earned ~${fmtNum(earned)} ${pool} (underlying ${fmtNum(oldUnderlying)} → ${fmtNum(newUnderlying)})`
        );
      }
    }
  }
  for (const [pool] of prevStakeMap) {
    if (!currStakeMap.has(pool)) {
      changes.push(`Removed staking position: ${pool}`);
    }
  }

  if (changes.length === 0) return "";

  const dateStr = snapshotAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const relative = relativeTime(snapshotAt);

  return `### Portfolio Changes (since ${dateStr}, ${relative})\n${changes.map((c) => `- ${c}`).join("\n")}`;
}
