"use client";

import type { FeedInsight } from "@/lib/feed/types";
import { FeedCard } from "./FeedCard";

interface FeedContainerProps {
  insights: FeedInsight[];
  isLoading: boolean;
  onAction: (prompt: string) => void;
}

export function FeedContainer({ insights, isLoading, onAction }: FeedContainerProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 px-3 sm:px-4 max-w-3xl mx-auto w-full">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="bg-zinc-800/50 border border-zinc-700/30 rounded-xl p-4 animate-pulse"
          >
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-zinc-700 rounded shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-zinc-700 rounded" />
                <div className="h-3 w-64 bg-zinc-700/60 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (insights.length === 0) return null;

  return (
    <div className="space-y-3 px-3 sm:px-4 max-w-3xl mx-auto w-full mb-4">
      <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
        Insights
      </h2>
      {insights.map((insight) => (
        <FeedCard key={insight.id} insight={insight} onAction={onAction} />
      ))}
    </div>
  );
}
