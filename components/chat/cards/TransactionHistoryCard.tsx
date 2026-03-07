import type { TransactionHistoryResult, TransactionHistoryItem } from "@/lib/ai/tool-types";
import { shortenAddress } from "./shared/ExecutionCardParts";

const EXPLORER_URL = "https://explorer.kasplex.org";

function timeAgo(timestamp: string): string {
  if (!timestamp) return "-";
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatFee(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n) || n === 0) return "-";
  if (n < 0.0001) return "<0.0001";
  return n.toFixed(4);
}

function formatAmount(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n) || n === 0) return "";
  if (n >= 1_000_000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

const actionBadgeColors: Record<string, string> = {
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

const tokenColors: Record<string, string> = {
  KAS: "text-emerald-400",
  WKAS: "text-emerald-400",
  ZEAL: "text-blue-400",
  NACHO: "text-orange-400",
  KASPER: "text-purple-400",
};

function StatusDot({ status }: { status: string }) {
  const color =
    status === "confirmed"
      ? "bg-emerald-400"
      : status === "failed"
        ? "bg-red-400"
        : "bg-yellow-400";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

function TokenTransfers({
  tx,
  userAddress,
}: {
  tx: TransactionHistoryItem;
  userAddress: string;
}) {
  const addr = userAddress.toLowerCase();

  if (tx.tokenTransfers.length > 0) {
    return (
      <div className="flex flex-col gap-0.5">
        {tx.tokenTransfers.map((tr, i) => {
          const isOutgoing = tr.from.toLowerCase() === addr;
          const sign = isOutgoing ? "-" : "+";
          const color = isOutgoing ? "text-red-400" : "text-emerald-400";
          const tokenColor = tokenColors[tr.token.toUpperCase()] ?? "text-zinc-300";
          return (
            <div key={i} className="flex items-center gap-1 text-xs">
              <span className={`font-mono ${color}`}>
                {sign}{formatAmount(tr.amount)}
              </span>
              <span className={`font-semibold ${tokenColor}`}>
                {tr.token}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // Fall back to KAS value
  const kasVal = parseFloat(tx.value);
  if (kasVal > 0) {
    const isOutgoing = tx.from.toLowerCase() === addr;
    const sign = isOutgoing ? "-" : "+";
    const color = isOutgoing ? "text-red-400" : "text-emerald-400";
    return (
      <div className="flex items-center gap-1 text-xs">
        <span className={`font-mono ${color}`}>
          {sign}{formatAmount(tx.value)}
        </span>
        <span className="font-semibold text-emerald-400">KAS</span>
      </div>
    );
  }

  return <span className="text-xs text-zinc-600">-</span>;
}

function TransactionRow({
  tx,
  userAddress,
}: {
  tx: TransactionHistoryItem;
  userAddress: string;
}) {
  const badgeColor = actionBadgeColors[tx.action] ?? "bg-zinc-700/40 text-zinc-400";

  return (
    <tr className="border-b border-zinc-700/30 last:border-0">
      {/* Action */}
      <td className="py-2.5 pr-3">
        <div className="flex flex-col gap-0.5">
          <a
            href={`${EXPLORER_URL}/tx/${tx.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 group"
          >
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${badgeColor}`}
            >
              {tx.action}
            </span>
            <svg
              className="w-3 h-3 text-zinc-600 group-hover:text-teal-400 transition-colors"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
          {tx.toLabel && (
            <span className="text-[10px] text-zinc-500 pl-0.5">{tx.toLabel}</span>
          )}
        </div>
      </td>
      {/* Tokens */}
      <td className="py-2.5 pr-3">
        <TokenTransfers tx={tx} userAddress={userAddress} />
      </td>
      {/* Fee */}
      <td className="py-2.5 pr-3 font-mono text-xs text-zinc-400 text-right">
        {formatFee(tx.fee)}
      </td>
      {/* Time */}
      <td className="py-2.5 pr-3 text-xs text-zinc-500 text-right whitespace-nowrap">
        {timeAgo(tx.timestamp)}
      </td>
      {/* Status */}
      <td className="py-2.5 text-center">
        <StatusDot status={tx.status} />
      </td>
    </tr>
  );
}

export function TransactionHistoryCard({
  data,
}: {
  data: TransactionHistoryResult;
}) {
  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 uppercase tracking-wide">
            Transaction History
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-zinc-700/50 text-[10px] text-zinc-400 font-mono">
            {data.transactions.length}
          </span>
        </div>
        <span className="text-[10px] text-zinc-600 font-mono">
          {shortenAddress(data.address)}
        </span>
      </div>

      {/* Table */}
      {data.transactions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 border-b border-zinc-700/50">
                <th className="pb-2 pr-3">Action</th>
                <th className="pb-2 pr-3">Tokens</th>
                <th className="pb-2 pr-3 text-right">Fee</th>
                <th className="pb-2 pr-3 text-right">Time</th>
                <th className="pb-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((tx) => (
                <TransactionRow
                  key={tx.hash}
                  tx={tx}
                  userAddress={data.address}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-sm text-zinc-500 text-center py-4">
          No transactions found.
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <a
          href={data.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
        >
          View all on Explorer &rarr;
        </a>
        {data.hasMore && (
          <span className="text-[10px] text-zinc-600">
            Showing most recent {data.transactions.length}
          </span>
        )}
      </div>
    </div>
  );
}
