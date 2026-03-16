"use client";

import { createContext, useContext } from "react";
import type { Portfolio } from "@/hooks/usePortfolio";
import type { InfinityPoolInfo } from "@/hooks/useInfinityPoolData";
import type { ConversationSummary } from "@/hooks/useConversations";
import type { UIMessage } from "ai";
import type { AuthStatus } from "@/hooks/useWalletAuth";

export interface AppContextValue {
  portfolio: Portfolio;
  pools: InfinityPoolInfo[];
  conversations: ConversationSummary[];
  isConversationsLoading: boolean;
  refreshConversations: () => void;
  saveConversation: (msgs: UIMessage[]) => Promise<string | null>;
  deleteConversation: (id: string) => void;
  portfolioPanel: { isOpen: boolean; toggle: () => void; close: () => void };
  leftRail: { isOpen: boolean; toggle: () => void; close: () => void };
  auth: { status: AuthStatus; isAuthenticated: boolean; isSigning: boolean; error: string | null; signIn: () => void };
}

export const AppContext = createContext<AppContextValue>(null!);

export function useAppContext() {
  return useContext(AppContext);
}
