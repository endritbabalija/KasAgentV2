"use client";

import { useRef, useCallback } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import type { ChatMessage } from "@/lib/types";
import type { ExecutionRecord } from "@/components/chat/ExecutionStateContext";
import { findActiveStrategy, countCompletedStrategySteps } from "@/lib/ui/strategy-helpers";

interface UseStrategyAutoContinueOptions {
  messagesRef: React.RefObject<ChatMessage[]>;
  sendMessageRef: React.RefObject<(opts: { text: string }) => void>;
  statusRef: React.RefObject<string>;
  executionStatesRef: React.RefObject<Record<string, ExecutionRecord>>;
  portfolioRefetch: () => Promise<void>;
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
}: UseStrategyAutoContinueOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear pending timer on unmount to prevent firing on stale refs
  useMountEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  });

  const onExecutionSuccess = useCallback(
    async (toolCallId: string, txHash?: string) => {
      try {
        await portfolioRefetch();
      } catch {
        return;
      }

      // Clear any previous pending timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

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
    },
    [portfolioRefetch, messagesRef, sendMessageRef, statusRef, executionStatesRef]
  );

  return { onExecutionSuccess };
}
