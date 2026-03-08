"use client";

import type { RiskFlag, RiskLevel, ContractInfo } from "@/lib/ai/tool-types";
import { shortenAddress } from "@/lib/format";
import { EXPLORER_URL } from "@/config/chains";
import { useState } from "react";

export { shortenAddress };

// ── Token Badge ──

const tokenColors: Record<string, string> = {
  KAS: "bg-emerald-900/50 text-emerald-400",
  WKAS: "bg-emerald-900/50 text-emerald-400",
  ZEAL: "bg-blue-900/50 text-blue-400",
  NACHO: "bg-orange-900/50 text-orange-400",
  KASPER: "bg-purple-900/50 text-purple-400",
};

export function TokenBadge({ symbol }: { symbol: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
        tokenColors[symbol.toUpperCase()] ?? "bg-zinc-700/50 text-zinc-300"
      }`}
    >
      {symbol.toUpperCase()}
    </span>
  );
}

// ── Format Amount ──

export function formatAmount(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  if (n >= 1_000_000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

// ── Risk Flags ──

const riskBannerColors: Record<RiskLevel, string> = {
  low: "bg-emerald-900/30 border-emerald-800/50 text-emerald-400",
  medium: "bg-yellow-900/30 border-yellow-800/50 text-yellow-400",
  high: "bg-red-900/30 border-red-800/50 text-red-400",
};

const riskIconColors: Record<RiskLevel, string> = {
  low: "text-emerald-500",
  medium: "text-yellow-500",
  high: "text-red-500",
};

export function RiskFlagList({ flags }: { flags: RiskFlag[] }) {
  if (flags && flags.length > 0) {
    return (
      <div className="space-y-1.5">
        {flags.map((flag, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${riskBannerColors[flag.severity]}`}
          >
            <svg className={`w-3.5 h-3.5 flex-shrink-0 ${riskIconColors[flag.severity]}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            {flag.label}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-emerald-900/20 border-emerald-800/30 text-xs text-emerald-400">
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      No risks detected
    </div>
  );
}

// ── Contract Info Accordion ──

export function ContractInfoAccordion({ info }: { info: ContractInfo }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
      >
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Contract Interaction
      </button>
      {expanded && (
        <div className="mt-1.5 pl-4 space-y-0.5 text-xs text-zinc-600">
          <div>
            <span className="text-zinc-500">Contract: </span>
            <span className="font-mono">{shortenAddress(info.address)}</span>
          </div>
          <div>
            <span className="text-zinc-500">Function: </span>
            <span className="font-mono">{info.functionName}</span>
          </div>
          <div>
            <span className="text-zinc-500">Action: </span>
            {info.description}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Success State ──

export function SuccessState({ message, txHash }: { message: string; txHash?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-emerald-400 text-sm">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        {message}
      </div>
      {txHash && (
        <a
          href={`${EXPLORER_URL}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-teal-400 hover:text-teal-300 underline break-all"
        >
          View on Explorer &rarr;
        </a>
      )}
    </div>
  );
}

// ── Error State ──

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-2">
      <div className="text-sm text-red-400 break-words">{message || "Transaction failed"}</div>
      <button
        onClick={onRetry}
        className="w-full py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-medium transition-colors cursor-pointer"
      >
        Retry
      </button>
    </div>
  );
}

// ── Cancelled State ──

export function CancelledState({ label }: { label?: string }) {
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/30 rounded-xl p-4 opacity-60">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
        {label ?? "Transaction Summary"}
      </div>
      <div className="flex items-center gap-2 text-zinc-500 text-sm">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        Transaction cancelled
      </div>
    </div>
  );
}

// ── Detail Row ──

export function DetailRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <>
      <div className="text-zinc-500">{label}</div>
      <div className={`text-zinc-300 font-mono text-right ${className ?? ""}`}>{value}</div>
    </>
  );
}

// ── Action Area ──

export function ActionArea({
  isConnected,
  state,
  isLoading,
  txHash,
  errorMsg,
  onExecute,
  onRetry,
  onCancel,
  walletMessage,
  successMessage,
  buttonLabel,
  loadingLabel,
}: {
  isConnected: boolean;
  state: string;
  isLoading: boolean;
  txHash?: string;
  errorMsg: string;
  onExecute: () => void;
  onRetry: () => void;
  onCancel: () => void;
  walletMessage: string;
  successMessage: string;
  buttonLabel: string;
  loadingLabel: string;
}) {
  return (
    <div className="mt-4">
      {!isConnected ? (
        <div className="text-sm text-zinc-500 text-center py-2">{walletMessage}</div>
      ) : state === "success" ? (
        <SuccessState message={successMessage} txHash={txHash} />
      ) : state === "error" ? (
        <ErrorState message={errorMsg} onRetry={onRetry} />
      ) : (
        <div className="flex gap-2">
          <button
            onClick={onExecute}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-zinc-500 border-t-white animate-spin" />
                {loadingLabel}
              </span>
            ) : (
              buttonLabel
            )}
          </button>
          {!isLoading && (
            <button
              onClick={onCancel}
              className="px-4 py-2.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
