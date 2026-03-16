import type { UIMessage } from "ai";

export interface ParsedToolPart {
  toolName: string;
  toolCallId: string;
  state: string;
  output: unknown;
  errorText?: string;
}

/** Returns true if the message part is a tool invocation (dynamic-tool or tool-*). */
export function isToolPart(part: UIMessage["parts"][number]): boolean {
  return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

/** Extract tool metadata from a UIMessage part, or null if it's not a tool part. */
export function parseToolPart(
  part: UIMessage["parts"][number]
): ParsedToolPart | null {
  if (!isToolPart(part)) return null;
  const raw = part as unknown as Record<string, unknown>;
  return {
    toolName:
      part.type === "dynamic-tool"
        ? (raw.toolName as string)
        : part.type.split("-").slice(1).join("-"),
    toolCallId: raw.toolCallId as string,
    state: raw.state as string,
    output: raw.output,
    errorText: raw.errorText as string | undefined,
  };
}
