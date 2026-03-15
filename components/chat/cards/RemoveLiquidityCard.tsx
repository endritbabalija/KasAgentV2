"use client";

import { useAccount } from "wagmi";
import { routerAbi, erc20Abi } from "@/config/abis";
import { useCardExecution, type ExecutionStep } from "@/hooks/useCardExecution";
import type { PrepareRemoveLiquidityResult } from "@/lib/ai/tool-types";
import {
  TokenBadge,
  formatAmount,
  RiskFlagList,
  ContractInfoAccordion,
  ActionArea,
  CancelledState,
  DetailRow,
} from "./shared/ExecutionCardParts";
import type { ExecutionRecord } from "../ExecutionStateContext";

export function RemoveLiquidityCard({ data, toolCallId, executionState }: { data: PrepareRemoveLiquidityResult; toolCallId?: string; executionState?: ExecutionRecord }) {
  const { address, isConnected } = useAccount();

  const steps: ExecutionStep[] = [];

  if (data.needsApproval) {
    steps.push({
      label: "Approving LP...",
      execute: async ({ writeContractAsync }) =>
        writeContractAsync({
          address: data.tx.pairAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [data.tx.router as `0x${string}`, BigInt(data.tx.rawLpAmount)],
        }),
    });
  }

  steps.push({
    label: "Removing...",
    execute: async ({ writeContractAsync }) => {
      const { tx, liquidityType } = data;
      const deadline = BigInt(tx.deadline);

      if (liquidityType === "KAS_TOKEN") {
        const isANative = data.tokenA.toUpperCase() === "KAS";
        const tokenAddr = isANative ? tx.tokenBAddress : tx.tokenAAddress;
        const amountTokenMin = BigInt(isANative ? tx.rawAmountBMin : tx.rawAmountAMin);
        const amountKASMin = BigInt(isANative ? tx.rawAmountAMin : tx.rawAmountBMin);

        return writeContractAsync({
          address: tx.router as `0x${string}`,
          abi: routerAbi,
          functionName: "removeLiquidityKAS",
          args: [tokenAddr as `0x${string}`, BigInt(tx.rawLpAmount), amountTokenMin, amountKASMin, address!, deadline],
        });
      }

      return writeContractAsync({
        address: tx.router as `0x${string}`,
        abi: routerAbi,
        functionName: "removeLiquidity",
        args: [
          tx.tokenAAddress as `0x${string}`,
          tx.tokenBAddress as `0x${string}`,
          BigInt(tx.rawLpAmount),
          BigInt(tx.rawAmountAMin),
          BigInt(tx.rawAmountBMin),
          address!,
          deadline,
        ],
      });
    },
  });

  const { status, currentStepLabel, isLoading, errorMsg, txHash, handleExecute, handleRetry, handleCancel } =
    useCardExecution({ steps, toolCallId, executionState });

  if (status === "cancelled") return <CancelledState label="Remove Liquidity" />;

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Remove Liquidity</div>

      <div className="text-xs text-zinc-500 mb-2">Removing {data.percentage}% of LP ({formatAmount(data.lpAmount)} LP tokens)</div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <TokenBadge symbol={data.tokenA} />
          <span className="font-mono text-teal-400 text-lg">{formatAmount(data.expectedAmountA)}</span>
        </div>
        <div className="flex items-center gap-2">
          <TokenBadge symbol={data.tokenB} />
          <span className="font-mono text-teal-400 text-lg">{formatAmount(data.expectedAmountB)}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <DetailRow label="Min Received" value={`${formatAmount(data.amountAMin)} ${data.tokenA}`} />
        <DetailRow label="" value={`${formatAmount(data.amountBMin)} ${data.tokenB}`} />
        <DetailRow label="Gas Fee" value={`~${formatAmount(data.gasEstimate)} KAS`} />
        <DetailRow label="Slippage" value={`${data.slippage}%`} />
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
        walletMessage="Connect your wallet to remove liquidity"
        successMessage="Liquidity removed!"
        buttonLabel={data.needsApproval ? "Approve & Remove" : "Remove Liquidity"}
        loadingLabel={currentStepLabel}
      />
    </div>
  );
}
