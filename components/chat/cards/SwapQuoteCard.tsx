import type { SwapQuoteResult } from "@/lib/ai/tool-types";
import { TokenBadge, formatAmount } from "./shared/ExecutionCardParts";
import { ProtocolBadge } from "./shared/ProtocolBadge";
import { CardWrapper } from "./shared/CardWrapper";

export function SwapQuoteCard({ data }: { data: SwapQuoteResult }) {
  return (
    <CardWrapper compact>
      <div className="flex items-center gap-2 flex-wrap">
        {data.protocol && <ProtocolBadge protocol={data.protocol} />}
        <TokenBadge symbol={data.tokenIn} />
        <span className="font-mono text-zinc-300 text-sm">{formatAmount(data.amountIn)}</span>
        <span className="text-zinc-600">&rarr;</span>
        <span className="font-mono text-teal-400 text-sm font-semibold">{formatAmount(data.amountOut)}</span>
        <TokenBadge symbol={data.tokenOut} />
      </div>
    </CardWrapper>
  );
}
