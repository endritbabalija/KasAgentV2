"use client";

import { useState, useMemo } from "react";
import { RefreshCw, ChevronDown } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePricedPortfolio, type WalletToken, type Position } from "@/hooks/usePricedPortfolio";
import { formatTokenAmount, formatKasAmount } from "@/lib/format";

const DUST_THRESHOLD_KAS = 0.01;

export function PortfolioPanel() {
  const portfolio = usePricedPortfolio();
  const [showDust, setShowDust] = useState(false);

  const mainTokens = useMemo(
    () => portfolio.walletTokens.filter((t) => t.kasVal >= DUST_THRESHOLD_KAS || t.symbol === "KAS"),
    [portfolio.walletTokens],
  );
  const dustTokens = useMemo(
    () => portfolio.walletTokens.filter((t) => t.kasVal < DUST_THRESHOLD_KAS && t.symbol !== "KAS"),
    [portfolio.walletTokens],
  );

  if (!portfolio.isConnected) {
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-zinc-500 text-sm">Connect wallet to view portfolio</p>
        <ConnectButton />
      </div>
    );
  }

  if (portfolio.isError) {
    return (
      <div className="text-center py-10 space-y-3">
        <p className="text-red-400 text-sm">Failed to load portfolio</p>
        <button
          onClick={() => portfolio.refetch()}
          className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (portfolio.isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-8 w-32 bg-zinc-800 rounded mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="h-3.5 w-14 bg-zinc-800 rounded" />
              <div className="h-3.5 w-20 bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header + refresh */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Portfolio</h3>
        <button
          onClick={() => portfolio.refetch()}
          className="p-1.5 rounded hover:bg-zinc-800 transition-colors"
          aria-label="Refresh portfolio"
        >
          <RefreshCw
            className={`w-3 h-3 text-zinc-500 hover:text-zinc-300${
              portfolio.isFetching ? " animate-spin" : ""
            }`}
          />
        </button>
      </div>

      {/* Total Value */}
      <div className="mb-5">
        <div className="text-2xl font-bold text-zinc-100 tracking-tight">
          ~{formatKasAmount(portfolio.totalValueKas)} <span className="text-base font-normal text-zinc-500">KAS</span>
        </div>
      </div>

      {/* Wallet Section */}
      <Section title="Wallet">
        {mainTokens.length === 0 ? (
          <p className="text-xs text-zinc-600">No tokens found</p>
        ) : (
          <div className="space-y-1">
            {mainTokens.map((t) => (
              <WalletTokenRow key={t.symbol} token={t} />
            ))}
          </div>
        )}
        {dustTokens.length > 0 && (
          <button
            onClick={() => setShowDust(!showDust)}
            className="flex items-center gap-1 mt-2 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${showDust ? "rotate-180" : ""}`} />
            +{dustTokens.length} dust
          </button>
        )}
        {showDust && dustTokens.length > 0 && (
          <div className="space-y-1 mt-1 opacity-60">
            {dustTokens.map((t) => (
              <WalletTokenRow key={t.symbol} token={t} />
            ))}
          </div>
        )}
      </Section>

      {/* Positions Section */}
      {portfolio.positions.length > 0 && (
        <Section title="Positions">
          <div className="space-y-2">
            {portfolio.positions.map((pos) => (
              <PositionCard key={pos.id} position={pos} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function WalletTokenRow({ token }: { token: WalletToken }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-300">{token.symbol}</span>
      <div className="text-right">
        <span className="text-zinc-200 font-mono text-xs">
          {formatTokenAmount(token.balance, token.decimals)}
        </span>
        {token.symbol !== "KAS" && token.kasVal > 0 && (
          <span className="text-zinc-500 text-xs ml-2">
            ~{formatKasAmount(token.kasVal)}
          </span>
        )}
      </div>
    </div>
  );
}

function PositionCard({ position }: { position: Position }) {
  if (position.type === "farm") return <FarmCard position={position} />;
  if (position.type === "staking") return <StakingCard position={position} />;
  return <LpCard position={position} />;
}

function PositionCardShell({ position, borderColor, children }: { position: Position; borderColor: string; children: React.ReactNode }) {
  return (
    <div className={`bg-zinc-900/50 rounded-lg p-2.5 space-y-1 border-l-2 ${borderColor}`}>
      <div className="flex justify-between items-center">
        <span className="text-sm text-zinc-200">{position.name}</span>
        <span className="text-xs text-zinc-400 font-mono">~{formatKasAmount(position.kasVal)} KAS</span>
      </div>
      {children}
    </div>
  );
}

function FarmCard({ position }: { position: Position }) {
  return (
    <PositionCardShell position={position} borderColor="border-emerald-600/50">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span>Farming</span>
        {position.apyPercent !== undefined && position.apyPercent > 0 && (
          <span className="text-emerald-400">{position.apyPercent.toFixed(2)}% APY</span>
        )}
      </div>
      {position.pendingReward !== undefined && position.pendingReward > 0n && (
        <div className="text-xs text-amber-400/80">
          {formatTokenAmount(position.pendingReward, position.rewardDecimals ?? 18)}{" "}
          {position.rewardSymbol} claimable
        </div>
      )}
    </PositionCardShell>
  );
}

function StakingCard({ position }: { position: Position }) {
  return (
    <PositionCardShell position={position} borderColor="border-blue-600/50">
      {position.xTokenBalance !== undefined && position.underlyingAmount !== undefined && (
        <div className="text-xs text-zinc-500">
          {formatTokenAmount(position.xTokenBalance, 18)} x{position.underlyingSymbol}
          {" → "}
          {formatTokenAmount(position.underlyingAmount, 18)} {position.underlyingSymbol}
        </div>
      )}
      {position.apyPercent !== undefined && position.apyPercent > 0 && (
        <div className="text-xs text-emerald-400">{position.apyPercent.toFixed(2)}% APY</div>
      )}
    </PositionCardShell>
  );
}

function LpCard({ position }: { position: Position }) {
  return (
    <PositionCardShell position={position} borderColor="border-violet-600/50">
      <div className="text-xs text-zinc-500">Idle LP (not farming)</div>
    </PositionCardShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}
