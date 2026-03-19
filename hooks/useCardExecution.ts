"use client";

import { useState, useRef } from "react";
import { useConfig, useWriteContract, useSendTransaction } from "wagmi";
import { useMountEffect } from "@/hooks/useMountEffect";
import { waitForTransactionReceipt } from "@wagmi/core";
import { useExecutionState, type ExecutionRecord } from "@/components/chat/ExecutionStateContext";

/** A single step in the execution pipeline (approval or main action). */
export interface ExecutionStep {
  /** Human-readable label shown during this step, e.g. "Approving ZEAL..." */
  label: string;
  /** Perform the transaction and return the hash. */
  execute: (helpers: {
    writeContractAsync: ReturnType<typeof useWriteContract>["writeContractAsync"];
    sendTransactionAsync: ReturnType<typeof useSendTransaction>["sendTransactionAsync"];
  }) => Promise<`0x${string}`>;
}

export type ExecutionStatus = "idle" | "executing" | "success" | "error" | "cancelled";

export interface UseCardExecutionReturn {
  status: ExecutionStatus;
  currentStepLabel: string;
  isLoading: boolean;
  errorMsg: string;
  txHash: string | undefined;
  handleExecute: () => void;
  handleRetry: () => void;
  handleCancel: () => void;
}

/**
 * Shared execution lifecycle for all transaction cards.
 * Handles sequential approval + action steps, receipt waiting,
 * error recovery, cancellation, and execution state persistence.
 *
 * Pre-allocates 3 useWriteContract + 1 useSendTransaction hooks
 * to cover the most complex case (2 approvals + 1 action).
 *
 * Note: Retry re-runs ALL steps (including already-confirmed approvals).
 * This is by design — re-approving an already-approved token is a no-op
 * on-chain (approval already >= required amount).
 */
export function useCardExecution({
  steps,
  toolCallId,
  executionState,
}: {
  steps: ExecutionStep[];
  toolCallId?: string;
  executionState?: ExecutionRecord;
}): UseCardExecutionReturn {
  const config = useConfig();
  const { markExecuted } = useExecutionState();

  const [status, setStatus] = useState<ExecutionStatus>(
    executionState?.state === "success" ? "success"
    : executionState?.state === "cancelled" ? "cancelled"
    : "idle"
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [txHash, setTxHash] = useState<string | undefined>(executionState?.txHash);

  // Abort flag — prevents state updates after cancel or unmount
  const abortedRef = useRef(false);
  const executingRef = useRef(false);

  // Clean up on unmount to prevent stale state updates
  useMountEffect(() => {
    return () => { abortedRef.current = true; };
  });

  // Pre-allocate wagmi hooks — always called unconditionally (Rules of Hooks)
  const wc0 = useWriteContract();
  const wc1 = useWriteContract();
  const wc2 = useWriteContract();
  const st = useSendTransaction();

  const writers = [wc0, wc1, wc2];

  async function handleExecute() {
    // Guard: prevent concurrent execution
    if (executingRef.current || steps.length === 0) return;
    executingRef.current = true;
    abortedRef.current = false;

    setErrorMsg("");
    let finalHash: string | undefined;
    try {
      for (let i = 0; i < steps.length; i++) {
        if (abortedRef.current) return;

        setCurrentStep(i);
        setStatus("executing");

        const writer = writers[i] ?? writers[writers.length - 1];
        const hash = await steps[i].execute({
          writeContractAsync: writer.writeContractAsync,
          sendTransactionAsync: st.sendTransactionAsync,
        });

        // Show tx hash for the final step (explorer link visible while confirming)
        if (i === steps.length - 1) {
          finalHash = hash;
          if (!abortedRef.current) setTxHash(hash);
        }

        await waitForTransactionReceipt(config, { hash });
      }

      if (!abortedRef.current) {
        setStatus("success");
        if (toolCallId) markExecuted(toolCallId, "success", finalHash);
      }
    } catch (err) {
      if (!abortedRef.current) {
        setStatus("error");
        setErrorMsg((err as Error).message.split("\n")[0]);
      }
    } finally {
      executingRef.current = false;
    }
  }

  function handleRetry() {
    setStatus("idle");
    setCurrentStep(0);
    setErrorMsg("");
    setTxHash(undefined);
    abortedRef.current = false;
    writers.forEach((w) => w.reset());
    st.reset();
  }

  function handleCancel() {
    abortedRef.current = true;
    setStatus("cancelled");
    executingRef.current = false;
    if (toolCallId) markExecuted(toolCallId, "cancelled");
  }

  return {
    status,
    currentStepLabel: status === "executing" ? (steps[currentStep]?.label ?? "Processing...") : "",
    isLoading: status === "executing",
    errorMsg,
    txHash,
    handleExecute,
    handleRetry,
    handleCancel,
  };
}
