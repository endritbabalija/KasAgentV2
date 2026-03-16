import type { UIMessage } from "ai";
import type { StrategyPlanResult } from "@/lib/ai/tool-types";
import type { ExecutionRecord } from "@/components/chat/ExecutionStateContext";
import { parseToolPart } from "./parse-tool-part";

/** Walk messages backwards to find the most recent successful planStrategy output. */
export function findActiveStrategy(
  messages: UIMessage[]
): StrategyPlanResult | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      const tp = parseToolPart(part);
      if (
        !tp ||
        tp.toolName !== "planStrategy" ||
        tp.state !== "output-available"
      )
        continue;
      const output = tp.output as StrategyPlanResult | undefined;
      if (output && !output.error && output.steps?.length) return output;
    }
  }
  return null;
}

/**
 * Count how many strategy steps have been successfully executed
 * (i.e. tool calls after the plan message that match expected tools
 * and have `state === "success"` in executionStates).
 */
export function countCompletedStrategySteps(
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
      if (
        tp?.toolName === "planStrategy" &&
        tp.state === "output-available"
      ) {
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
