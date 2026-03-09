"use client";

import { useState } from "react";
import type { SpyPortfolioResult } from "@/lib/ai/tool-types";
import { shortenAddress, formatAmount } from "./shared/ExecutionCardParts";
import { EXPLORER_URL } from "@/config/chains";

function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full text-left text-xs text-zinc-500 font-medium uppercase tracking-wide mb-2 cursor-pointer hover:text-zinc-400 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        {title}
        <span className="ml-auto inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-zinc-700/50 text-zinc-400">
          {count}
        </span>
      </button>
      {open && children}
    </div>
  );
}

export function SpyPortfolioCard({ data }: { data: SpyPortfolioResult }) {
  const {
    balances,
    lpPositions,
    farmPositions,
    stakingPositions,
    discountStatus,
  } = data;

  const hasAnyPosition =
    balances.length > 0 ||
    lpPositions.length > 0 ||
    farmPositions.length > 0 ||
    stakingPositions.length > 0;

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-500 uppercase tracking-wide">
          Wallet Snapshot
        </div>
        <span className="text-xs font-mono text-zinc-600">
          {shortenAddress(data.address)}
        </span>
      </div>

      {/* Discount Status Banner */}
      {discountStatus.isEligible ? (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-emerald-900/30 border-emerald-800/50">
          <svg
            className="w-4 h-4 text-emerald-400 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <span className="text-sm font-medium text-emerald-400">
              Fee Discount Active
            </span>
            <span className="text-xs text-emerald-400/70 ml-1.5">
              (via {discountStatus.source})
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-zinc-700/30 border-zinc-600/50">
          <svg
            className="w-4 h-4 text-zinc-500 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <span className="text-sm text-zinc-400">No Fee Discount</span>
            <span className="text-xs text-zinc-500 ml-1.5">
              Standard 0.3% swap fee
            </span>
          </div>
        </div>
      )}

      {!hasAnyPosition && (
        <div className="text-center text-sm text-zinc-500 py-4">
          No token balances or DeFi positions found for this wallet.
        </div>
      )}

      {/* Token Balances */}
      {balances.length > 0 && (
        <CollapsibleSection
          title="Token Balances"
          count={balances.length}
          defaultOpen
        >
          <div className="border border-zinc-700/30 bg-zinc-900/30 rounded-lg p-3">
            <div className="grid grid-cols-2 gap-y-1.5 text-xs">
              {balances.map((b) => (
                <div key={b.address ?? "native"} className="contents">
                  <div className="text-zinc-400 font-medium">{b.symbol}</div>
                  <div className="text-zinc-300 font-mono text-right">
                    {formatAmount(b.balance)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* LP Positions */}
      {lpPositions.length > 0 && (
        <CollapsibleSection
          title="LP Positions"
          count={lpPositions.length}
          defaultOpen
        >
          <div className="space-y-2">
            {lpPositions.map((lp) => (
              <div
                key={lp.pairAddress}
                className="border border-zinc-700/30 bg-zinc-900/30 rounded-lg p-3"
              >
                <div className="text-xs font-medium text-zinc-300 mb-1.5">
                  {lp.pair}
                </div>
                <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                  <div className="text-zinc-500">LP Balance</div>
                  <div className="text-zinc-300 font-mono text-right">
                    {formatAmount(lp.lpBalance)}
                  </div>
                  <div className="text-zinc-500">{lp.token0Symbol}</div>
                  <div className="text-zinc-300 font-mono text-right">
                    {formatAmount(lp.token0Amount)}
                  </div>
                  <div className="text-zinc-500">{lp.token1Symbol}</div>
                  <div className="text-zinc-300 font-mono text-right">
                    {formatAmount(lp.token1Amount)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Farm Positions */}
      {farmPositions.length > 0 && (
        <CollapsibleSection
          title="Farm Positions"
          count={farmPositions.length}
        >
          <div className="space-y-2">
            {farmPositions.map((fp) => (
              <div
                key={fp.pid}
                className="border border-zinc-700/30 bg-zinc-900/30 rounded-lg p-3"
              >
                <div className="text-xs font-medium text-zinc-300 mb-1.5">
                  Pool #{fp.pid} — {fp.lpTokenSymbol}
                </div>
                <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                  <div className="text-zinc-500">Staked</div>
                  <div className="text-zinc-300 font-mono text-right">
                    {formatAmount(fp.stakedAmount)}
                  </div>
                  <div className="text-zinc-500">Pending {fp.rewardToken}</div>
                  <div className="text-zinc-300 font-mono text-right">
                    {formatAmount(fp.pendingReward)}
                  </div>
                  <div className="text-zinc-500">Can Withdraw</div>
                  <div className="text-right">
                    {fp.canWithdraw ? (
                      <span className="text-emerald-400">Yes</span>
                    ) : (
                      <span className="text-yellow-400">Locked</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Staking Positions */}
      {stakingPositions.length > 0 && (
        <CollapsibleSection
          title="Staking Positions"
          count={stakingPositions.length}
        >
          <div className="space-y-2">
            {stakingPositions.map((sp) => (
              <div
                key={sp.pool}
                className="border border-zinc-700/30 bg-zinc-900/30 rounded-lg p-3"
              >
                <div className="text-xs font-medium text-zinc-300 mb-1.5">
                  {sp.pool} InfinityPool
                </div>
                <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                  <div className="text-zinc-500">x{sp.pool} Balance</div>
                  <div className="text-zinc-300 font-mono text-right">
                    {formatAmount(sp.xTokenBalance)}
                  </div>
                  <div className="text-zinc-500">Underlying</div>
                  <div className="text-zinc-300 font-mono text-right">
                    {formatAmount(sp.underlyingAmount)} {sp.pool}
                  </div>
                  <div className="text-zinc-500">Exchange Rate</div>
                  <div className="text-zinc-300 font-mono text-right">
                    {formatAmount(sp.exchangeRate)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-700/30">
        <a
          href={`${EXPLORER_URL}/address/${data.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-teal-400 hover:text-teal-300 transition-colors"
        >
          View on Explorer &rarr;
        </a>
        <span className="text-[10px] text-zinc-600">
          {new Date(data.fetchedAt).toLocaleString()}
        </span>
      </div>
    </div>
  );
}
