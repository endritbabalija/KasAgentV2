"use client";

import { useEffect } from "react";
import { ChevronRight, ChevronLeft, X, MessageSquare, Wallet, RefreshCw } from "lucide-react";
import type { Portfolio } from "@/hooks/usePortfolio";
import type { InfinityPoolInfo } from "@/hooks/useInfinityPoolData";
import type { ConversationSummary, SidebarTab } from "@/hooks/useConversations";
import { formatTokenAmount } from "@/lib/format";
import { useTokenRegistry } from "@/hooks/useTokenRegistry";
import { ConversationList } from "./ConversationList";

interface PortfolioSidebarProps {
  portfolio: Portfolio;
  pools: InfinityPoolInfo[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  // Conversation props
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  isLoading?: boolean;
  isListLoading?: boolean;
  conversationError?: string | null;
  onClearError?: () => void;
}

export function PortfolioSidebar({
  portfolio,
  pools,
  isOpen,
  onToggle,
  onClose,
  activeTab,
  onTabChange,
  conversations,
  activeConversationId,
  onSelectConversation,
  onDeleteConversation,
  isLoading,
  isListLoading,
  conversationError,
  onClearError,
}: PortfolioSidebarProps) {
  const { getTokenSymbol } = useTokenRegistry();

  const handleSelectConversation = (id: string) => {
    onSelectConversation(id);
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isOpen && isMobile) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  const sidebarContent = (
    <div className="w-72 h-full flex flex-col">
      {/* Header with tabs */}
      <div className="border-b border-zinc-800">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex gap-1">
            <button
              onClick={() => onTabChange("chats")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "chats"
                  ? "text-white border-teal-400"
                  : "text-zinc-500 border-transparent hover:text-zinc-300"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chats
            </button>
            <button
              onClick={() => onTabChange("portfolio")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "portfolio"
                  ? "text-white border-teal-400"
                  : "text-zinc-500 border-transparent hover:text-zinc-300"
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              Portfolio
            </button>
            {activeTab === "portfolio" && portfolio.isConnected && (
              <button
                onClick={() => portfolio.refetch()}
                className="p-1.5 rounded hover:bg-zinc-800 transition-colors ml-1"
                aria-label="Refresh portfolio"
              >
                <RefreshCw
                  className={`w-3 h-3 text-zinc-500 hover:text-zinc-300${
                    portfolio.isFetching ? " animate-spin" : ""
                  }`}
                />
              </button>
            )}
          </div>
          {/* Desktop: chevron close, Mobile: X close */}
          <button
            onClick={onClose}
            className="hidden md:block p-1 rounded hover:bg-zinc-800 transition-colors"
            aria-label="Close sidebar"
          >
            <ChevronLeft className="w-4 h-4 text-zinc-500" />
          </button>
          <button
            onClick={onClose}
            className="md:hidden p-1 rounded hover:bg-zinc-800 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "chats" ? (
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelect={handleSelectConversation}
          onDelete={onDeleteConversation}
          isLoading={isLoading}
          isListLoading={isListLoading}
          error={conversationError}
          onClearError={onClearError}
        />
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
          {!portfolio.isConnected ? (
            <div className="text-center py-10">
              <p className="text-zinc-500 text-sm">
                Connect wallet to view portfolio
              </p>
            </div>
          ) : portfolio.isError ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-red-400 text-sm">
                Failed to load portfolio
              </p>
              <button
                onClick={() => portfolio.refetch()}
                className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : portfolio.isLoading ? (
            <div className="space-y-5 animate-pulse">
              <div>
                <div className="h-3 w-16 bg-zinc-800 rounded mb-3" />
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <div className="h-3.5 w-12 bg-zinc-800 rounded" />
                    <div className="h-3.5 w-20 bg-zinc-800 rounded" />
                  </div>
                  <div className="flex justify-between">
                    <div className="h-3.5 w-14 bg-zinc-800 rounded" />
                    <div className="h-3.5 w-16 bg-zinc-800 rounded" />
                  </div>
                  <div className="flex justify-between">
                    <div className="h-3.5 w-10 bg-zinc-800 rounded" />
                    <div className="h-3.5 w-24 bg-zinc-800 rounded" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Portfolio Summary */}
              {(() => {
                const stats = [
                  { label: "Tokens", count: portfolio.balances.length },
                  { label: "LPs", count: portfolio.lpPositions.length },
                  { label: "Farms", count: portfolio.farmPositions.length },
                  { label: "Staked", count: portfolio.stakingPositions.filter((s) => s.xTokenBalance > 0n).length },
                ];
                return (
                  <div className="grid grid-cols-4 gap-2 bg-zinc-800/30 rounded-lg p-3">
                    {stats.map((s) => (
                      <div key={s.label} className="text-center">
                        <div className="text-sm text-zinc-200 font-medium">{s.count}</div>
                        <div className="text-xs text-zinc-500">{s.label}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Token Balances */}
              <Section title="Balances">
                {portfolio.balances.length === 0 ? (
                  <p className="text-xs text-zinc-600">No tokens found</p>
                ) : (
                  <div className="space-y-1">
                    {portfolio.balances.map((tb) => (
                      <div
                        key={tb.symbol}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-zinc-300">{tb.symbol}</span>
                        <span className="text-zinc-400 font-mono text-xs">
                          {formatTokenAmount(tb.balance, tb.decimals)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* LP Positions */}
              {portfolio.lpPositions.length > 0 && (
                <Section title="LP Positions">
                  <div className="space-y-2">
                    {portfolio.lpPositions.map((lp) => (
                      <div
                        key={lp.pairAddress}
                        className="bg-zinc-900/50 rounded-lg p-2 space-y-1"
                      >
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-300">
                            {getTokenSymbol(lp.token0)}/
                            {getTokenSymbol(lp.token1)}
                          </span>
                          <span className="text-zinc-500 font-mono text-xs">
                            {formatTokenAmount(lp.lpBalance, 18)}
                          </span>
                        </div>
                        <div className="flex gap-3 text-xs text-zinc-500">
                          <span>
                            {getTokenSymbol(lp.token0)}:{" "}
                            {formatTokenAmount(lp.token0Amount, 18)}
                          </span>
                          <span>
                            {getTokenSymbol(lp.token1)}:{" "}
                            {formatTokenAmount(lp.token1Amount, 18)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Farm Positions */}
              {portfolio.farmPositions.length > 0 && (
                <Section title="Farms">
                  <div className="space-y-2">
                    {portfolio.farmPositions.map((fp) => (
                      <div
                        key={fp.pid}
                        className="bg-zinc-900/50 rounded-lg p-2 space-y-1"
                      >
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-300">
                            Pool #{fp.pid}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {fp.canWithdraw ? "Unlocked" : "Locked"}
                          </span>
                        </div>
                        <div className="flex gap-3 text-xs text-zinc-500">
                          <span>
                            Staked: {formatTokenAmount(fp.stakedAmount, 18)}
                          </span>
                          <span>
                            Rewards:{" "}
                            {formatTokenAmount(fp.pendingReward, 18)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Staking Positions */}
              {portfolio.stakingPositions.some(
                (s) => s.xTokenBalance > 0n
              ) && (
                <Section title="Staking">
                  <div className="space-y-2">
                    {portfolio.stakingPositions
                      .filter((sp) => sp.xTokenBalance > 0n)
                      .map((sp) => (
                        <div
                          key={sp.poolName}
                          className="bg-zinc-900/50 rounded-lg p-2 space-y-1"
                        >
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-300">
                              x{sp.poolName}
                            </span>
                            <span className="text-zinc-500 font-mono text-xs">
                              {formatTokenAmount(sp.xTokenBalance, 18)}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-500">
                            ={" "}
                            {formatTokenAmount(sp.underlyingAmount, 18)}{" "}
                            {sp.poolName} (
                            {formatTokenAmount(sp.exchangeRate, 18, 6)}x)
                          </div>
                        </div>
                      ))}
                  </div>
                </Section>
              )}

              {/* Infinity Pools */}
              {pools.length > 0 && (
                <Section title="InfinityPool Rates">
                  <div className="space-y-1">
                    {pools.map((pool) => (
                      <div
                        key={pool.name}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-zinc-300">{pool.name}</span>
                        <span className="font-mono text-xs text-zinc-500">
                          {formatTokenAmount(pool.exchangeRate, 18, 6)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop: collapsed toggle strip */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="hidden md:flex items-center justify-center w-8 shrink-0 border-r border-zinc-800 hover:bg-zinc-800/50 transition-colors group"
          aria-label="Open sidebar"
        >
          <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />
        </button>
      )}

      {/* Desktop: inline sidebar panel */}
      <aside
        className={`shrink-0 border-r border-zinc-800 bg-zinc-950/50 transition-all duration-300 overflow-hidden hidden md:block ${
          isOpen ? "w-72" : "w-0"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile: overlay drawer */}
      <div
        className={`md:hidden fixed inset-0 z-40 transition-opacity duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60"
          onClick={onClose}
          aria-label="Close sidebar"
        />
        {/* Drawer */}
        <aside
          className={`absolute top-0 left-0 h-full w-72 bg-zinc-950 border-r border-zinc-800 transition-transform duration-300 ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebarContent}
        </aside>
      </div>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}
