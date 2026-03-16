"use client";

import { useEffect, useRef, useCallback } from "react";
import type { UIMessage } from "ai";
import type { ExecutionRecord } from "@/components/chat/ExecutionStateContext";
import { findActiveStrategy, countCompletedStrategySteps } from "@/lib/ui/strategy-helpers";

interface UseStrategyAutoContinueOptions {
  messagesRef: React.RefObject<UIMessage[]>;
  sendMessageRef: React.RefObject<(opts: { text: string }) => void>;
  statusRef: React.RefObject<string>;
  executionStatesRef: React.RefObject<Record<string, ExecutionRecord>>;
  portfolioRefetch: () => void;
  portfolioIsFetching: boolean;
}

/**
 * After a successful execution step, waits for portfolio to refresh,
 * then sends a continuation message to the AI for the next strategy step.
 */
export function useStrategyAutoContinue({
  messagesRef,
  sendMessageRef,
  statusRef,
  executionStatesRef,
  portfolioRefetch,
  portfolioIsFetching,
}: UseStrategyAutoContinueOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContinueRef = useRef<{ toolCallId: string; txHash?: string } | null>(null);
  // Track whether we've seen isFetching go true since onExecutionSuccess was called.
  // This prevents premature firing if the effect runs before refetch starts.
  const sawFetchingRef = useRef(false);

  // When portfolio finishes refetching after a successful step, send continuation
  useEffect(() => {
    if (!pendingContinueRef.current) return;

    if (portfolioIsFetching) {
      // Refetch started — mark that we've seen it
      sawFetchingRef.current = true;
      return;
    }

    // Portfolio is not fetching. Only proceed if we saw it fetching first
    // (prevents premature fire before React state transitions to isFetching=true)
    if (!sawFetchingRef.current) return;

    // Portfolio finished refetching — fire continuation
    const { toolCallId, txHash } = pendingContinueRef.current;
    pendingContinueRef.current = null;
    sawFetchingRef.current = false;

    timerRef.current = setTimeout(() => {
      timerRef.current = null;

      if (statusRef.current !== "ready") return;

      const strategy = findActiveStrategy(messagesRef.current);
      if (!strategy) return;

      const record: ExecutionRecord = { state: "success", ...(txHash ? { txHash } : {}) };
      const completed = countCompletedStrategySteps(
        messagesRef.current,
        { ...executionStatesRef.current, [toolCallId]: record },
        strategy
      );

      if (completed >= strategy.steps.length) {
        sendMessageRef.current({
          text: `All ${strategy.steps.length} strategy steps completed successfully! Last tx: ${txHash ?? "confirmed"}. Summarize what was accomplished.`,
        });
        return;
      }

      const nextStep = strategy.steps[completed];
      sendMessageRef.current({
        text: `Step ${completed} completed${txHash ? ` (tx: ${txHash})` : ""}. Continue with step ${completed + 1}: ${nextStep.action}. Use my updated wallet balances.`,
      });
    }, 1500);
  }, [portfolioIsFetching, messagesRef, sendMessageRef, statusRef, executionStatesRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onExecutionSuccess = useCallback(
    (toolCallId: string, txHash?: string) => {
      portfolioRefetch();
      pendingContinueRef.current = { toolCallId, txHash };
      sawFetchingRef.current = false;
    },
    [portfolioRefetch]
  );

  return { onExecutionSuccess };
}
