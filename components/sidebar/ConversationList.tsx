"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { ConversationSummary } from "@/hooks/useConversations";

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(dateStr));
}

interface ConversationListProps {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
  isLoading?: boolean;
  isListLoading?: boolean;
  error?: string | null;
  onClearError?: () => void;
}

function groupByTime(conversations: ConversationSummary[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: ConversationSummary[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const c of conversations) {
    const d = new Date(c.updated_at);
    if (d >= today) groups[0].items.push(c);
    else if (d >= yesterday) groups[1].items.push(c);
    else if (d >= weekAgo) groups[2].items.push(c);
    else groups[3].items.push(c);
  }

  return groups.filter((g) => g.items.length > 0);
}

export function ConversationList({
  conversations,
  activeConversationId,
  onSelect,
  onDelete,
  onNewChat,
  isLoading,
  isListLoading,
  error,
  onClearError,
}: ConversationListProps) {
  const groups = groupByTime(conversations);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Auto-dismiss delete confirmation after 3s
  useEffect(() => {
    if (confirmDeleteId) {
      const timer = setTimeout(() => setConfirmDeleteId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmDeleteId]);

  return (
    <div className="flex flex-col h-full">
      {/* New Chat button */}
      <div className="px-4 py-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-3 mb-2 px-3 py-2 bg-red-950/50 border border-red-800/50 rounded-lg flex items-center justify-between">
          <p className="text-xs text-red-400">{error}</p>
          <button onClick={onClearError} className="text-red-400 hover:text-red-300 ml-2 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Conversation list */}
      <div className={`flex-1 overflow-y-auto px-3 pb-3 space-y-4 transition-opacity ${isLoading ? "opacity-60 pointer-events-none" : ""}`}>
        {isListLoading && conversations.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-2">
            <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
            <p className="text-xs text-zinc-500">Loading...</p>
          </div>
        ) : conversations.length === 0 ? (
          <p className="text-center text-xs text-zinc-600 py-8">
            No conversations yet
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <h4 className="text-xs text-zinc-500 uppercase tracking-wide px-1 mb-1.5">
                {group.label}
              </h4>
              <div className="space-y-0.5">
                {group.items.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelect(c.id)}
                    className={`group w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors ${
                      activeConversationId === c.id
                        ? "bg-zinc-700/50"
                        : "hover:bg-zinc-800"
                    }`}
                  >
                    <div className="flex flex-col flex-1 mr-2 min-w-0">
                      <span className="text-sm text-zinc-300 truncate">
                        {c.title}
                      </span>
                      <span className="text-xs text-zinc-600">
                        {formatRelativeTime(c.updated_at)}
                      </span>
                    </div>
                    {confirmDeleteId === c.id ? (
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { onDelete(c.id); setConfirmDeleteId(null); }}
                          className="text-xs text-red-400 hover:text-red-300 px-1.5 py-0.5 bg-red-950/50 rounded transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs text-zinc-500 hover:text-zinc-300 px-1.5 py-0.5 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(c.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation();
                            setConfirmDeleteId(c.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-all shrink-0"
                        aria-label="Delete conversation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
