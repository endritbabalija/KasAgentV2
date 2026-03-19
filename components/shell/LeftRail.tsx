"use client";

import { useSyncExternalStore } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Plus, X } from "lucide-react";
import { useConversations } from "@/hooks/useConversations";
import { useLeftRail } from "@/stores/ui";
import { ConversationList } from "@/components/sidebar/ConversationList";

// Stable subscribe function for useSyncExternalStore (module-scope = same reference every render)
function subscribeToPushState(callback: () => void) {
  window.addEventListener("pushstate", callback);
  return () => window.removeEventListener("pushstate", callback);
}

export function LeftRail() {
  const router = useRouter();
  usePathname(); // subscribe to Next.js router changes (triggers re-render on real navigations)
  const { conversations, isConversationsLoading, deleteConversation } = useConversations();
  const leftRail = useLeftRail();

  // Reads browser URL directly. Re-renders on:
  // 1. Next.js navigations (usePathname above triggers re-render)
  // 2. pushState events from Chat.tsx (subscribe callback triggers re-render)
  const pathname = useSyncExternalStore(
    subscribeToPushState,
    () => window.location.pathname,
    () => "/"
  );

  // Extract active conversation ID from URL
  const activeConversationId = pathname.match(/^\/c\/([^/]+)/)?.[1] ?? null;

  const handleSelectConversation = (id: string) => {
    router.push(`/c/${id}`);
    if (window.innerWidth < 768) {
      leftRail.close();
    }
  };

  const handleNewChat = () => {
    router.push("/");
    router.refresh();
    if (window.innerWidth < 768) {
      leftRail.close();
    }
  };

  const handleDelete = (id: string) => {
    deleteConversation(id);
    // If deleting the active conversation, go home
    if (activeConversationId === id) {
      router.push("/");
      router.refresh();
    }
  };

  const railContent = (
    <div className="w-64 h-full flex flex-col bg-zinc-950/50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-800">
        <button
          onClick={handleNewChat}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
        <button
          onClick={leftRail.close}
          className="md:hidden p-1 rounded hover:bg-zinc-800 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      {/* Conversation list */}
      <ConversationList
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelect={handleSelectConversation}
        onDelete={handleDelete}
        isListLoading={isConversationsLoading}
      />
    </div>
  );

  return (
    <>
      {/* Desktop: always-visible rail */}
      <aside className="hidden md:block shrink-0 w-64 border-r border-zinc-800 overflow-hidden">
        {railContent}
      </aside>

      {/* Mobile: overlay drawer */}
      <div
        className={`md:hidden fixed inset-0 z-40 transition-opacity duration-300 ${
          leftRail.isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className="absolute inset-0 bg-black/60"
          onClick={leftRail.close}
          aria-label="Close menu"
        />
        <aside
          className={`absolute top-0 left-0 h-full w-64 bg-zinc-950 border-r border-zinc-800 transition-transform duration-300 ${
            leftRail.isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {railContent}
        </aside>
      </div>
    </>
  );
}
