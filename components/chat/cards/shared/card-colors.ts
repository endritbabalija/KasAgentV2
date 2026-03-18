import { PROTOCOLS, type ProtocolId } from "@/config/protocols";
import type { StrategyStepType, RiskLevel } from "@/lib/ai/tool-types";

// ── Protocol Badges ──

interface ProtocolBadgeConfig {
  label: string;
  shortLabel: string;
  className: string;
}

const PROTOCOL_BADGE_STYLES: Record<ProtocolId, string> = {
  zealous: "bg-blue-900/50 text-blue-400",
  kroko: "bg-indigo-900/50 text-indigo-400",
  kaspacom: "bg-orange-900/50 text-orange-400",
};

const PROTOCOL_BADGES: Record<string, ProtocolBadgeConfig> = Object.fromEntries(
  Object.values(PROTOCOLS).map((p) => [
    p.id,
    { label: p.name, shortLabel: p.shortName, className: PROTOCOL_BADGE_STYLES[p.id] },
  ])
);

export function getProtocolBadge(protocolId: string): ProtocolBadgeConfig {
  return PROTOCOL_BADGES[protocolId] ?? { label: protocolId, shortLabel: protocolId, className: "bg-zinc-700/50 text-zinc-300" };
}

// ── Token Colors ──

const TOKEN_BADGE_COLORS: Record<string, string> = {
  KAS: "bg-emerald-900/50 text-emerald-400",
  WKAS: "bg-emerald-900/50 text-emerald-400",
  ZEAL: "bg-blue-900/50 text-blue-400",
  NACHO: "bg-orange-900/50 text-orange-400",
  KASPER: "bg-purple-900/50 text-purple-400",
};

export function getTokenBadgeColor(symbol: string): string {
  return TOKEN_BADGE_COLORS[symbol.toUpperCase()] ?? "bg-zinc-700/50 text-zinc-300";
}

const TOKEN_TEXT_COLORS: Record<string, string> = {
  KAS: "text-emerald-400",
  WKAS: "text-emerald-400",
  ZEAL: "text-blue-400",
  NACHO: "text-orange-400",
  KASPER: "text-purple-400",
};

export function getTokenTextColor(symbol: string): string {
  return TOKEN_TEXT_COLORS[symbol.toUpperCase()] ?? "text-zinc-300";
}

// ── Action Badge Colors (TransactionHistoryCard) ──

export const ACTION_BADGE_COLORS: Record<string, string> = {
  Swap: "bg-teal-900/40 text-teal-400",
  "Add Liquidity": "bg-blue-900/40 text-blue-400",
  "Remove Liquidity": "bg-blue-900/40 text-blue-400",
  "Farm Deposit": "bg-purple-900/40 text-purple-400",
  "Farm Withdraw": "bg-purple-900/40 text-purple-400",
  "Farm Emergency Withdraw": "bg-purple-900/40 text-purple-400",
  Stake: "bg-indigo-900/40 text-indigo-400",
  Unstake: "bg-indigo-900/40 text-indigo-400",
  Transfer: "bg-zinc-700/40 text-zinc-300",
  Approve: "bg-zinc-700/40 text-zinc-400",
  "Contract Call": "bg-zinc-700/40 text-zinc-400",
  "Contract Create": "bg-zinc-700/40 text-zinc-400",
};

// ── Strategy Step Type Badges (StrategyPlanCard) ──

export const STRATEGY_TYPE_BADGES: Record<StrategyStepType, { label: string; color: string }> = {
  swap: { label: "Swap", color: "bg-teal-900/50 text-teal-400" },
  addLiquidity: { label: "Add LP", color: "bg-blue-900/50 text-blue-400" },
  removeLiquidity: { label: "Remove LP", color: "bg-blue-900/50 text-blue-400" },
  farmStake: { label: "Farm", color: "bg-amber-900/50 text-amber-400" },
  farmUnstake: { label: "Unfarm", color: "bg-amber-900/50 text-amber-400" },
  infinityStake: { label: "Stake", color: "bg-purple-900/50 text-purple-400" },
  infinityUnstake: { label: "Unstake", color: "bg-purple-900/50 text-purple-400" },
};

// ── Yield Type Badges (YieldOpportunitiesCard) ──

export const YIELD_TYPE_BADGES: Record<string, { label: string; className: string }> = {
  farm: { label: "Farm", className: "bg-teal-900/40 text-teal-400" },
  infinity_pool: { label: "Stake", className: "bg-blue-900/40 text-blue-400" },
};

// ── Infinity Pool Colors (InfinityPoolRatesCard) ──

export const POOL_BORDER_COLORS: Record<string, string> = {
  ZEAL: "border-blue-800/50 bg-blue-950/20",
  NACHO: "border-orange-800/50 bg-orange-950/20",
  KASPER: "border-purple-800/50 bg-purple-950/20",
};

export const POOL_NAME_COLORS: Record<string, string> = {
  ZEAL: "text-blue-400",
  NACHO: "text-orange-400",
  KASPER: "text-purple-400",
};

// ── Risk Dot Colors (YieldOpportunitiesCard) ──

export const RISK_DOT_COLORS: Record<RiskLevel, string> = {
  low: "bg-emerald-400",
  medium: "bg-yellow-400",
  high: "bg-red-400",
};
