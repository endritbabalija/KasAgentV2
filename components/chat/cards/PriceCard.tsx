import type { TokenPriceResult } from "@/lib/ai/tool-types";
import { formatPrice } from "@/lib/format";
import { CardWrapper } from "./shared/CardWrapper";

export function PriceCard({ data }: { data: TokenPriceResult }) {
  return (
    <CardWrapper compact>
      <div className="flex items-baseline gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-900/40 text-blue-400">
          {data.token}
        </span>
        <span className="text-2xl font-semibold text-zinc-100 font-mono">
          {formatPrice(data.priceInKAS)}
        </span>
        <span className="text-sm text-zinc-500">KAS</span>
      </div>
    </CardWrapper>
  );
}
