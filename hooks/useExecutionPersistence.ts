"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { ExecutionRecord } from "@/components/chat/ExecutionStateContext";

interface UseExecutionPersistenceOptions {
  initialStates: Record<string, ExecutionRecord>;
  activeConversationId: string;
  onSuccess?: (toolCallId: string, txHash?: string) => void;
}

export function useExecutionPersistence({
  initialStates,
  activeConversationId,
  onSuccess,
}: UseExecutionPersistenceOptions) {
  const [executionStates, setExecutionStates] = useState(initialStates);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const markExecuted = useCallback(
    (toolCallId: string, state: string, txHash?: string) => {
      const record: ExecutionRecord = { state, ...(txHash ? { txHash } : {}) };
      setExecutionStates((prev) => ({ ...prev, [toolCallId]: record }));

      if (state === "success") {
        onSuccessRef.current?.(toolCallId, txHash);
      }

      // Persist to DB (fire-and-forget) — conversationId is always available
      fetch("/api/execution-states", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId,
          toolCallId,
          state,
          txHash,
        }),
      }).catch((err) =>
        console.error(
          "[markExecuted] Failed to persist execution state:",
          err
        )
      );
    },
    [activeConversationId]
  );

  const getExecutionState = useCallback(
    (toolCallId: string) => executionStates[toolCallId],
    [executionStates]
  );

  const executionCtx = useMemo(
    () => ({ markExecuted, getExecutionState }),
    [markExecuted, getExecutionState]
  );

  return { executionStates, markExecuted, getExecutionState, executionCtx };
}
