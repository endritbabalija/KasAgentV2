"use client";

import { useAccount } from "wagmi";
import { v2SwapAbi, erc20Abi } from "@/config/abis";
import { useCardExecution, type ExecutionStep } from "@/hooks/useCardExecution";
import type { PrepareSwapResult } from "@/lib/ai/tool-types";
import {
  TokenBadge,
  formatAmount,
  DetailRow,
  RiskFlagList,
  ContractInfoAccordion,
  ActionArea,
  CancelledState,
} from "./shared/ExecutionCardParts";
import type { ExecutionRecord } from "../ExecutionStateContext";

export function SwapExecutionCard({ data, toolCallId, executionState }: { data: PrepareSwapResult; toolCallId?: string; executionState?: ExecutionRecord }) {
  const { address, isConnected } = useAccount();

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

  const { status, currentStepLabel, isLoading, errorMsg, txHash, handleExecute, handleRetry, handleCancel } =
    useCardExecution({ steps, toolCallId, executionState });

  if (status === "cancelled") return <CancelledState label="Swap" />;

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
        Transaction Summary
      </div>

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

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
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
      </div>

      <div className="mt-3">
        <RiskFlagList flags={data.riskFlags} />
      </div>

      {data.contractInfo && (
        <div className="mt-3">
          <ContractInfoAccordion info={data.contractInfo} />
        </div>
      )}

      <ActionArea
        isConnected={isConnected}
        state={status}
        isLoading={isLoading}
        txHash={txHash}
        errorMsg={errorMsg}
        onExecute={handleExecute}
        onRetry={handleRetry}
        onCancel={handleCancel}
        walletMessage="Connect your wallet to execute this swap"
        successMessage="Swap confirmed!"
        buttonLabel={data.needsApproval ? "Approve & Swap" : "Execute Swap"}
        loadingLabel={currentStepLabel}
      />
    </div>
  );
}
