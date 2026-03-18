"use client";

import type { StrategyPlanResult } from "@/lib/ai/tool-types";
import { TokenBadge } from "./shared/ExecutionCardParts";
import { STRATEGY_TYPE_BADGES } from "./shared/card-colors";
import { CardWrapper } from "./shared/CardWrapper";

function StepRow({
  step,
  isLast,
}: {
  step: StrategyPlanResult["steps"][number];
  isLast: boolean;
}) {
  const badge = STRATEGY_TYPE_BADGES[step.type] ?? { label: step.type, color: "bg-zinc-700/50 text-zinc-300" };

  return (
    <div className="flex gap-3">
      {/* Step number + connector line */}
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded-full bg-zinc-700/80 border border-zinc-600/50 flex items-center justify-center text-xs font-semibold text-zinc-300 shrink-0">
          {step.stepNumber}
        </div>
        {!isLast && <div className="w-px flex-1 bg-zinc-700/50 my-1" />}
      </div>

      {/* Step content */}
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.color}`}>
            {badge.label}
          </span>
          <span className="text-[10px] text-zinc-600">{step.protocol}</span>
        </div>

        <div className="mt-1 text-sm text-zinc-200">{step.action}</div>

        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
          <span className="font-mono">{step.estimatedInput}</span>
          <span>&rarr;</span>
          <span className="font-mono">{step.estimatedOutput}</span>
        </div>

        {step.tokens.length > 0 && (
          <div className="mt-1.5 flex gap-1 flex-wrap">
            {step.tokens.map((t) => (
              <TokenBadge key={t} symbol={t} />
            ))}
          </div>
        )}

        {step.note && (
          <div className="mt-1 text-[11px] text-zinc-600 italic">{step.note}</div>
        )}
      </div>
    </div>
  );
}

export function StrategyPlanCard({ data }: { data: StrategyPlanResult }) {
  return (
    <CardWrapper>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-zinc-500 uppercase tracking-wide">Strategy Plan</div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400 font-medium">
          {data.steps.length} steps
        </span>
      </div>

      {/* Title + Summary */}
      <div className="mb-4">
        <h3 className="text-base font-semibold text-zinc-100">{data.title}</h3>
        <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{data.summary}</p>
      </div>

      {/* Steps */}
      <div className="space-y-0">
        {data.steps.map((step, i) => (
          <StepRow key={step.stepNumber} step={step} isLast={i === data.steps.length - 1} />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-zinc-700/30 flex items-center justify-between">
        <span className="text-[11px] text-zinc-600">
          Est. total gas: <span className="font-mono text-zinc-500">{data.estimatedTotalGas}</span>
        </span>
      </div>

      {/* Disclaimer */}
      <div className="mt-2 text-[10px] text-zinc-600 leading-relaxed">{data.disclaimer}</div>
    </CardWrapper>
  );
}
