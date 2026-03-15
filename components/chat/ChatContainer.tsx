"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import type { Portfolio } from "@/hooks/usePortfolio";
import type { InfinityPoolInfo } from "@/hooks/useInfinityPoolData";
import type { StrategyPlanResult } from "@/lib/ai/tool-types";
import {
  serializePortfolio,
  serializeInfinityPools,
  type SerializedPortfolio,
  type SerializedInfinityPool,
} from "@/lib/ai/serializers";
import { useTokenRegistry } from "@/hooks/useTokenRegistry";
import { AlertTriangle } from "lucide-react";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { WelcomeScreen } from "./WelcomeScreen";
import {
  ExecutionStateContext,
  type ExecutionRecord,
} from "./ExecutionStateContext";

interface ChatContainerProps {
  portfolio: Portfolio;
  pools: InfinityPoolInfo[];
  initialMessages: UIMessage[];
  initialExecutionStates: Record<string, ExecutionRecord>;
  activeConversationId: string | null;
  onConversationSaved: (messages: UIMessage[]) => void;
  onMessagesChange?: (messages: UIMessage[]) => void;
  saveError: string | null;
}

/**
 * Closure-based mutable store for the transport body.
 * Mutations happen to closure-scoped variables, which avoids both
 * react-hooks/refs (no useRef in render closures) and
 * react-hooks/immutability (no property writes on useState values).
 */
function createBodyStore() {
  let portfolio: SerializedPortfolio | null = null;
  let pools: SerializedInfinityPool[] = [];

  return {
    update(p: SerializedPortfolio | null, pl: SerializedInfinityPool[]) {
      portfolio = p;
      pools = pl;
    },
    getBody() {
      return {
        walletAddress: portfolio?.address,
        portfolio,
        infinityPools: pools,
      };
    },
  };
}

// --- Strategy auto-continue helpers ---

/** Extract tool metadata from a UIMessage part, or null if it's not a tool part. */
function parseToolPart(part: UIMessage["parts"][number]): {
  toolName: string;
  toolCallId: string;
  state: string;
  output: unknown;
} | null {
  if (part.type !== "dynamic-tool" && !part.type.startsWith("tool-"))
    return null;
  const raw = part as unknown as Record<string, unknown>;
  return {
    toolName:
      part.type === "dynamic-tool"
        ? (raw.toolName as string)
        : part.type.split("-").slice(1).join("-"),
    toolCallId: raw.toolCallId as string,
    state: raw.state as string,
    output: raw.output,
  };
}

function findActiveStrategy(
  messages: UIMessage[]
): StrategyPlanResult | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      const tp = parseToolPart(part);
      if (!tp || tp.toolName !== "planStrategy" || tp.state !== "output-available")
        continue;
      const output = tp.output as StrategyPlanResult | undefined;
      if (output && !output.error && output.steps?.length) return output;
    }
  }
  return null;
}

function countCompletedStrategySteps(
  messages: UIMessage[],
  executionStates: Record<string, ExecutionRecord>,
  strategy: StrategyPlanResult
): number {
  const expectedTools = new Set(strategy.steps.map((s) => s.toolToCall));

  // Find the message index containing the planStrategy output
  let planMsgIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      const tp = parseToolPart(part);
      if (tp?.toolName === "planStrategy" && tp.state === "output-available") {
        planMsgIdx = i;
        break;
      }
    }
    if (planMsgIdx >= 0) break;
  }
  if (planMsgIdx < 0) return 0;

  // Count successful tool calls after the plan message that match strategy tools
  let completed = 0;
  for (let i = planMsgIdx + 1; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      const tp = parseToolPart(part);
      if (
        tp &&
        expectedTools.has(tp.toolName) &&
        executionStates[tp.toolCallId]?.state === "success"
      ) {
        completed++;
      }
    }
  }
  return completed;
}

// This component is keyed by chatLoadKey in page.tsx.
// Changing the key remounts it, which resets useChat with fresh initialMessages.
// No manual reset effects needed.

export function ChatContainer({
  portfolio,
  pools,
  initialMessages,
  initialExecutionStates,
  activeConversationId,
  onConversationSaved,
  onMessagesChange,
  saveError,
}: ChatContainerProps) {
  const { getTokenSymbol, tokenMap } = useTokenRegistry();
  const getTokenDecimals = useCallback(
    (address: string): number =>
      tokenMap.get(address.toLowerCase())?.decimals ?? 18,
    [tokenMap]
  );

  const [bodyStore] = useState(createBodyStore);

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: bodyStore.getBody,
      })
  );

  // Refs to avoid stale closures in onError, beforeunload, and markExecuted
  const messagesRef = useRef<UIMessage[]>(initialMessages);
  const onSavedRef = useRef(onConversationSaved);
  const conversationIdRef = useRef(activeConversationId);
  const portfolioRef = useRef(portfolio.address);
  const portfolioRefetchRef = useRef(portfolio.refetch);
  // Strategy auto-continue refs
  const sendMessageRef = useRef<(opts: { text: string }) => void>(null!);
  const statusRef = useRef<string>("ready");
  const executionStatesRef = useRef<Record<string, ExecutionRecord>>(initialExecutionStates);
  const strategyContinueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    onSavedRef.current = onConversationSaved;
    conversationIdRef.current = activeConversationId;
    portfolioRef.current = portfolio.address;
    portfolioRefetchRef.current = portfolio.refetch;
  });

  // Execution state persistence — backed by Supabase execution_states table.
  // initialExecutionStates is loaded alongside messages from the conversation API.
  const [executionStates, setExecutionStates] = useState(initialExecutionStates);
  const pendingExecutionsRef = useRef<Array<{ toolCallId: string; state: string; txHash?: string }>>([]);

  const markExecuted = useCallback(
    (toolCallId: string, state: string, txHash?: string) => {
      const record: ExecutionRecord = { state, ...(txHash ? { txHash } : {}) };
      setExecutionStates((prev) => ({ ...prev, [toolCallId]: record }));

      // Refetch portfolio data so balances/positions update immediately after tx
      if (state === "success") {
        portfolioRefetchRef.current();

        // Strategy auto-continue: after a successful step, send continuation message
        if (strategyContinueTimerRef.current) {
          clearTimeout(strategyContinueTimerRef.current);
        }
        strategyContinueTimerRef.current = setTimeout(() => {
          strategyContinueTimerRef.current = null;

          if (statusRef.current !== "ready") return; // chat is busy

          const strategy = findActiveStrategy(messagesRef.current);
          if (!strategy) return;

          const completed = countCompletedStrategySteps(
            messagesRef.current,
            { ...executionStatesRef.current, [toolCallId]: record },
            strategy
          );
          if (completed >= strategy.steps.length) {
            // All steps done — notify AI to wrap up
            sendMessageRef.current({
              text: `All ${strategy.steps.length} strategy steps completed successfully! Last tx: ${txHash ?? "confirmed"}. Summarize what was accomplished.`,
            });
            return;
          }

          const nextStep = strategy.steps[completed];
          sendMessageRef.current({
            text: `Step ${completed} completed${txHash ? ` (tx: ${txHash})` : ""}. Continue with step ${completed + 1}: ${nextStep.action}. Use my updated wallet balances.`,
          });
        }, 2500);
      }

      // Persist to DB (fire-and-forget — the local state is already updated)
      const convoId = conversationIdRef.current;
      const wallet = portfolioRef.current;
      if (convoId && wallet) {
        fetch("/api/execution-states", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: wallet,
            conversationId: convoId,
            toolCallId,
            state,
            txHash,
          }),
        }).catch((err) =>
          console.error("[markExecuted] Failed to persist execution state:", err),
        );
      } else {
        // Conversation not saved yet — queue for when the ID arrives
        pendingExecutionsRef.current.push({ toolCallId, state, txHash });
      }
    },
    [],
  );

  // Flush pending execution states once conversationId becomes available
  useEffect(() => {
    if (activeConversationId && portfolio.address && pendingExecutionsRef.current.length > 0) {
      const pending = pendingExecutionsRef.current.splice(0);
      for (const { toolCallId, state, txHash } of pending) {
        fetch("/api/execution-states", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: portfolio.address,
            conversationId: activeConversationId,
            toolCallId,
            state,
            txHash,
          }),
        }).catch((err) =>
          console.error("[markExecuted] Failed to flush pending execution state:", err),
        );
      }
    }
  }, [activeConversationId, portfolio.address]);

  const getExecutionState = useCallback(
    (toolCallId: string) => executionStates[toolCallId],
    [executionStates],
  );

  const executionCtx = useMemo(
    () => ({ markExecuted, getExecutionState }),
    [markExecuted, getExecutionState],
  );

  const { messages, status, error, stop, sendMessage, regenerate } = useChat({
    transport,
    messages: initialMessages,
    onFinish: ({ messages: allMessages }) => {
      onConversationSaved(allMessages);
    },
    onError: () => {
      // Save whatever messages we have when the stream errors
      if (messagesRef.current.length > 0) {
        onSavedRef.current(messagesRef.current);
      }
    },
  });

  // Keep refs and parent in sync with latest messages
  useEffect(() => {
    messagesRef.current = messages;
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  // Sync strategy auto-continue refs
  useEffect(() => {
    sendMessageRef.current = sendMessage;
    statusRef.current = status;
    executionStatesRef.current = executionStates;
  });

  // Cleanup strategy continue timer on unmount
  useEffect(() => {
    return () => {
      if (strategyContinueTimerRef.current) {
        clearTimeout(strategyContinueTimerRef.current);
      }
    };
  }, []);

  // Save on tab close / navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (messagesRef.current.length > 0 && portfolio.address) {
        const payload = JSON.stringify({
          walletAddress: portfolio.address,
          conversationId: conversationIdRef.current,
          messages: messagesRef.current,
        });
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/conversations/save", blob);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [portfolio.address]);

  // Sync latest data after each render for the transport body closure
  useEffect(() => {
    bodyStore.update(
      portfolio.isConnected && portfolio.address
        ? serializePortfolio(
            portfolio.address,
            portfolio.balances,
            portfolio.lpPositions,
            portfolio.farmPositions,
            portfolio.farmGlobals,
            portfolio.stakingPositions,
            getTokenSymbol,
            getTokenDecimals
          )
        : null,
      serializeInfinityPools(pools)
    );
  });

  const isLoading = status === "submitted" || status === "streaming";
  const isWaiting = status === "submitted";
  const hasMessages = messages.length > 0;

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage({ text: suggestion });
  };

  const handleSubmit = (text: string) => {
    if (text.trim()) {
      sendMessage({ text: text.trim() });
    }
  };

  const handleRetrySave = () => {
    if (messages.length > 0) {
      onConversationSaved(messages);
    }
  };

  return (
    <ExecutionStateContext.Provider value={executionCtx}>
      <div className="flex flex-col h-full">
        {hasMessages ? (
          <>
            <MessageList
              messages={messages}
              isWaiting={isWaiting}
              isStreaming={status === "streaming"}
              error={error}
              onSendMessage={handleSuggestionClick}
              onRetry={regenerate}
            />
            {saveError && (
              <div className="mx-3 sm:mx-4 mb-1 max-w-3xl self-center w-full py-2 px-3 bg-amber-950/50 border border-amber-700/50 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <p className="text-sm text-amber-400 flex-1">
                  {saveError}
                </p>
                <button
                  onClick={handleRetrySave}
                  className="text-sm text-amber-400 hover:text-amber-300 underline underline-offset-2 font-medium shrink-0"
                >
                  Retry
                </button>
              </div>
            )}
            <ChatInput
              onSubmit={handleSubmit}
              onStop={stop}
              isLoading={isLoading}
              isConnected={portfolio.isConnected}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="flex-1" />
            <WelcomeScreen
              isConnected={portfolio.isConnected}
              onSuggestionClick={handleSuggestionClick}
              hasBalances={portfolio.balances.length > 0}
              hasPositions={
                portfolio.lpPositions.length > 0 ||
                portfolio.farmPositions.length > 0 ||
                portfolio.stakingPositions.some((s) => s.xTokenBalance > 0n)
              }
            />
            <ChatInput
              onSubmit={handleSubmit}
              onStop={stop}
              isLoading={isLoading}
              isConnected={portfolio.isConnected}
            />
          </div>
        )}
      </div>
    </ExecutionStateContext.Provider>
  );
}
