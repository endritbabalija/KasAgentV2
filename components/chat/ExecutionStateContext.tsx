"use client";

import { createContext, useContext } from "react";

export interface ExecutionRecord {
  state: string;
  txHash?: string;
}

interface ExecutionStateContextValue {
  markExecuted: (toolCallId: string, state: string, txHash?: string) => void;
  getExecutionState: (toolCallId: string) => ExecutionRecord | undefined;
}

export const ExecutionStateContext = createContext<ExecutionStateContextValue>({
  markExecuted: () => {},
  getExecutionState: () => undefined,
});

export function useExecutionState() {
  return useContext(ExecutionStateContext);
}
