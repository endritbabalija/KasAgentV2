"use client";

import type { QuickAction } from "@/lib/ai/quick-actions";

interface QuickActionsProps {
  actions: QuickAction[];
  onSend: (message: string) => void;
}

export function QuickActions({ actions, onSend }: QuickActionsProps) {
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-1">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={() => onSend(action.message)}
          className={`px-4 py-2 min-h-[44px] rounded-xl text-sm transition-colors ${
            action.variant === "secondary"
              ? "bg-zinc-800/50 border border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600"
              : "bg-zinc-800/50 border border-teal-700/40 text-teal-300 hover:bg-teal-900/30 hover:border-teal-600/50"
          }`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
