"use client";

import { useAccount } from "wagmi";
import { v2SwapAbi, erc20Abi } from "@/config/abis";
import type { ExecutionStep } from "@/hooks/useCardExecution";
import type { PrepareSwapResult } from "@/lib/ai/tool-types";
import { TokenBadge, formatAmount, DetailRow } from "./shared/ExecutionCardParts";
import { ExecutionCardLayout } from "./shared/ExecutionCardLayout";
import type { ExecutionRecord } from "../ExecutionStateContext";

export function SwapExecutionCard({ data, toolCallId, executionState }: { data: PrepareSwapResult; toolCallId?: string; executionState?: ExecutionRecord }) {
  const { address } = useAccount();

  const steps: ExecutionStep[] = [];

  if (data.needsApproval) {
    steps.push({
      label: "Approving...",
      execute: async ({ writeContractAsync }) =>
        writeContractAsync({
          address: data.tx.tokenInAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [data.tx.router as `0x${string}`, BigInt(data.tx.rawAmountIn)],
        }),
    });
  }

  steps.push({
    label: "Swapping...",
    execute: async ({ writeContractAsync }) => {
      const { tx, swapType } = data;
      const path = tx.path as `0x${string}`[];
      const deadline = BigInt(tx.deadline);
      const fnName = data.contractInfo.functionName;

      if (swapType === "KAS_TO_TOKEN") {
        return writeContractAsync({
          address: tx.router as `0x${string}`,
          abi: v2SwapAbi,
          functionName: fnName as "swapExactKASForTokens" | "swapExactETHForTokens",
          args: [BigInt(tx.rawAmountOutMin), path, address!, deadline],
          value: BigInt(tx.value),
        });
      } else if (swapType === "TOKEN_TO_KAS") {
        return writeContractAsync({
          address: tx.router as `0x${string}`,
          abi: v2SwapAbi,
          functionName: fnName as "swapExactTokensForKAS" | "swapExactTokensForETH",
          args: [BigInt(tx.rawAmountIn), BigInt(tx.rawAmountOutMin), path, address!, deadline],
        });
      } else {
        return writeContractAsync({
          address: tx.router as `0x${string}`,
          abi: v2SwapAbi,
          functionName: "swapExactTokensForTokens",
          args: [BigInt(tx.rawAmountIn), BigInt(tx.rawAmountOutMin), path, address!, deadline],
        });
      }
    },
  });

  return (
    <ExecutionCardLayout
      title="Transaction Summary"
      cancelledLabel="Swap"
      riskFlags={data.riskFlags}
      contractInfo={data.contractInfo}
      steps={steps}
      toolCallId={toolCallId}
      executionState={executionState}
      walletMessage="Connect your wallet to execute this swap"
      successMessage="Swap confirmed!"
      buttonLabel={data.needsApproval ? "Approve & Swap" : "Execute Swap"}
      details={<>
        <DetailRow label="DEX Fee" value={`${data.dexFeeAmount} (${data.feeRate})${data.discountApplied ? " — Discounted" : ""}`} />
        <DetailRow label="Gas Fee" value={`~${formatAmount(data.gasEstimate)} KAS`} />
        <DetailRow label="Min Received" value={`${formatAmount(data.amountOutMin)} ${data.tokenOut.toUpperCase()}`} />
        <DetailRow label="Slippage" value={`${data.slippage}%`} />
        <div className="text-zinc-500">Price Impact</div>
        <div
          className={`font-mono text-right ${
            parseFloat(data.priceImpact) > 3
              ? "text-red-400"
              : parseFloat(data.priceImpact) > 1
                ? "text-yellow-400"
                : "text-zinc-300"
          }`}
        >
          {data.priceImpact}%
        </div>
      </>}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <TokenBadge symbol={data.tokenIn} />
          <span className="font-mono text-teal-400 text-lg">{formatAmount(data.amountIn)}</span>
        </div>
        <span className="text-zinc-500 text-lg">&rarr;</span>
        <div className="flex items-center gap-2">
          <TokenBadge symbol={data.tokenOut} />
          <span className="font-mono text-teal-400 text-lg">{formatAmount(data.amountOut)}</span>
        </div>
      </div>
    </ExecutionCardLayout>
  );
}
