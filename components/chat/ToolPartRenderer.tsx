import { ToolCardSkeleton } from "./cards/ToolCardSkeleton";
import { ToolErrorCard } from "./cards/ToolErrorCard";
import { SwapQuoteCard } from "./cards/SwapQuoteCard";
import { PoolReservesCard } from "./cards/PoolReservesCard";
import { FarmsTableCard } from "./cards/FarmsTableCard";
import { InfinityPoolRatesCard } from "./cards/InfinityPoolRatesCard";
import type {
  SwapQuoteResult,
  PoolReservesResult,
  ActiveFarmsResult,
  InfinityPoolRatesResult,
} from "@/lib/ai/tool-types";

interface ToolPart {
  toolName: string;
  state: string;
  output?: unknown;
  errorText?: string;
}

export function ToolPartRenderer({ part }: { part: ToolPart }) {
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

  // Check for error in output
  if (output?.error) {
    return <ToolErrorCard error={output.error as string} toolName={toolName} />;
  }

  switch (toolName) {
    case "getSwapQuote":
      return <SwapQuoteCard data={output as unknown as SwapQuoteResult} />;
    case "getPoolReserves":
      return <PoolReservesCard data={output as unknown as PoolReservesResult} />;
    case "getActiveFarms":
      return <FarmsTableCard data={output as unknown as ActiveFarmsResult} />;
    case "getInfinityPoolRates":
      return <InfinityPoolRatesCard data={output as unknown as InfinityPoolRatesResult} />;
    default:
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
}
