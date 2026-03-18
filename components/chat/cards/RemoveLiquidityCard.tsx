"use client";

import { useAccount } from "wagmi";
import { routerAbi, erc20Abi } from "@/config/abis";
import type { ExecutionStep } from "@/hooks/useCardExecution";
import type { PrepareRemoveLiquidityResult } from "@/lib/ai/tool-types";
import { TokenBadge, formatAmount, DetailRow } from "./shared/ExecutionCardParts";
import { ExecutionCardLayout } from "./shared/ExecutionCardLayout";
import type { ExecutionRecord } from "../ExecutionStateContext";

export function RemoveLiquidityCard({ data, toolCallId, executionState }: { data: PrepareRemoveLiquidityResult; toolCallId?: string; executionState?: ExecutionRecord }) {
  const { address } = useAccount();

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

  return (
    <ExecutionCardLayout
      title="Remove Liquidity"
      cancelledLabel="Remove Liquidity"
      riskFlags={data.riskFlags}
      contractInfo={data.contractInfo}
      steps={steps}
      toolCallId={toolCallId}
      executionState={executionState}
      walletMessage="Connect your wallet to remove liquidity"
      successMessage="Liquidity removed!"
      buttonLabel={data.needsApproval ? "Approve & Remove" : "Remove Liquidity"}
      details={<>
        <DetailRow label="Min Received (A)" value={`${formatAmount(data.amountAMin)} ${data.tokenA}`} />
        <DetailRow label="Min Received (B)" value={`${formatAmount(data.amountBMin)} ${data.tokenB}`} />
        <DetailRow label="Gas Fee" value={`~${formatAmount(data.gasEstimate)} KAS`} />
        <DetailRow label="Slippage" value={`${data.slippage}%`} />
      </>}
    >
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
    </ExecutionCardLayout>
  );
}
