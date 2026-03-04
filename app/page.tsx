"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ChatContainer } from "@/components/chat/ChatContainer";

export default function Home() {
  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-zinc-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
        <h1 className="text-xl font-bold tracking-tight">KasAgent</h1>
        <ConnectButton />
      </header>

      <main className="flex-1 overflow-hidden max-w-3xl w-full mx-auto">
        <ChatContainer />
      </main>
    </div>
  );
}
