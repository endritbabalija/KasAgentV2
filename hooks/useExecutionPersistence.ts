"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { ExecutionRecord } from "@/components/chat/ExecutionStateContext";

interface UseExecutionPersistenceOptions {
  initialStates: Record<string, ExecutionRecord>;
  activeConversationId: string | null;
  onSuccess?: (toolCallId: string, txHash?: string) => void;
}

export function useExecutionPersistence({
  initialStates,
  activeConversationId,
  onSuccess,
}: UseExecutionPersistenceOptions) {
  const [executionStates, setExecutionStates] = useState(initialStates);
  const pendingExecutionsRef = useRef<Array<{ toolCallId: string; state: string; txHash?: string }>>([]);
  const conversationIdRef = useRef(activeConversationId);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    conversationIdRef.current = activeConversationId;
    onSuccessRef.current = onSuccess;
  });

  const markExecuted = useCallback(
    (toolCallId: string, state: string, txHash?: string) => {
      const record: ExecutionRecord = { state, ...(txHash ? { txHash } : {}) };
      setExecutionStates((prev) => ({ ...prev, [toolCallId]: record }));

      if (state === "success") {
        onSuccessRef.current?.(toolCallId, txHash);
      }

      // Persist to DB (fire-and-forget) — auth from httpOnly cookie
      const convoId = conversationIdRef.current;
      if (convoId) {
        fetch("/api/execution-states", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: convoId,
            toolCallId,
            state,
            txHash,
          }),
        }).catch((err) =>
          console.error("[markExecuted] Failed to persist execution state:", err)
        );
      } else {
        pendingExecutionsRef.current.push({ toolCallId, state, txHash });
      }
    },
    []
  );

  // Flush pending execution states once conversationId becomes available
  useEffect(() => {
    if (activeConversationId && pendingExecutionsRef.current.length > 0) {
      const pending = pendingExecutionsRef.current.splice(0);
      for (const { toolCallId, state, txHash } of pending) {
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
          console.error("[markExecuted] Failed to flush pending execution state:", err)
        );
      }
    }
  }, [activeConversationId]);

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
