"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ConversationSummary } from "@/hooks/useConversations";

interface ConversationListProps {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
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
}: ConversationListProps) {
  const groups = groupByTime(conversations);

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

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-4">
        {conversations.length === 0 ? (
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
                    <span className="text-sm text-zinc-300 truncate flex-1 mr-2">
                      {c.title}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(c.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          onDelete(c.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-all shrink-0"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </span>
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
