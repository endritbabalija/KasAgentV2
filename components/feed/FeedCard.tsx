"use client";

import type { FeedInsight } from "@/lib/feed/types";
import {
  Coins,
  Gift,
  TrendingUp,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

const typeConfig: Record<
  FeedInsight["type"],
  { icon: typeof Coins; borderColor: string; iconColor: string }
> = {
  "idle-capital": {
    icon: Coins,
    borderColor: "border-l-teal-500",
    iconColor: "text-teal-400",
  },
  "harvest-reminder": {
    icon: Gift,
    borderColor: "border-l-amber-500",
    iconColor: "text-amber-400",
  },
  "better-yield": {
    icon: TrendingUp,
    borderColor: "border-l-emerald-500",
    iconColor: "text-emerald-400",
  },
  "market-move": {
    icon: AlertTriangle,
    borderColor: "border-l-red-500",
    iconColor: "text-red-400",
  },
  "new-opportunity": {
    icon: Sparkles,
    borderColor: "border-l-blue-500",
    iconColor: "text-blue-400",
  },
};

interface FeedCardProps {
  insight: FeedInsight;
  onAction: (prompt: string) => void;
}

export function FeedCard({ insight, onAction }: FeedCardProps) {
  const config = typeConfig[insight.type];
  const Icon = config.icon;

  return (
    <div
      className={`bg-zinc-800/80 border border-zinc-700/50 border-l-2 ${config.borderColor} rounded-xl p-4 hover:bg-zinc-800 transition-colors`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${config.iconColor} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-zinc-200 mb-0.5">
            {insight.title}
          </h3>
          <p className="text-xs text-zinc-400 mb-3">{insight.description}</p>

          {/* Token badges */}
          {insight.tokens.length > 0 && (
            <div className="flex gap-1.5 mb-3">
              {insight.tokens.map((token) => (
                <span
                  key={token}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-700/50 text-zinc-300"
                >
                  {token}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={() => onAction(insight.actionPrompt)}
            className="text-xs font-medium text-teal-400 hover:text-teal-300 transition-colors"
          >
            {insight.actionPrompt}
          </button>
        </div>
      </div>
    </div>
  );
}
