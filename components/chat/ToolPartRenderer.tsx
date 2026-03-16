import { CardErrorBoundary } from "./CardErrorBoundary";
import { ToolCardSkeleton } from "./cards/ToolCardSkeleton";
import { ToolErrorCard } from "./cards/ToolErrorCard";
import { TOOL_CARD_REGISTRY } from "@/lib/ui/tool-card-registry";
import { useExecutionState } from "./ExecutionStateContext";

interface ToolPart {
  toolName: string;
  state: string;
  output?: unknown;
  errorText?: string;
  toolCallId?: string;
}

export function ToolPartRenderer({ part }: { part: ToolPart }) {
  const { getExecutionState } = useExecutionState();
  const { toolName, state } = part;

  // Loading states
  if (state === "input-streaming" || state === "input-available" || state === "approval-requested") {
    return <ToolCardSkeleton toolName={toolName} />;
  }

  // Error state
  if (state === "output-error") {
    return <ToolErrorCard error={part.errorText ?? "Unknown error"} toolName={toolName} />;
  }

  // Only render output for completed states
  if (state !== "output-available") {
    return null;
  }

  const output = part.output as Record<string, unknown> | undefined;
  const toolCallId = part.toolCallId;
  const execution = toolCallId ? getExecutionState(toolCallId) : undefined;

  // Check for error in output
  if (output?.error) {
    return <ToolErrorCard error={output.error as string} toolName={toolName} />;
  }

  const renderer = TOOL_CARD_REGISTRY[toolName];
  if (renderer && output) {
    return (
      <CardErrorBoundary toolName={toolName}>
        {renderer(output, toolCallId, execution)}
      </CardErrorBoundary>
    );
  }

  // Fallback: render raw JSON for unknown tools
  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">{toolName}</div>
      <pre className="text-xs text-zinc-400 font-mono overflow-x-auto whitespace-pre-wrap">
        {JSON.stringify(output, null, 2)}
      </pre>
    </div>
  );
}
