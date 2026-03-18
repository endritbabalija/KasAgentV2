"use client";

import { masterchefAbi } from "@/config/abis";
import type { ExecutionStep } from "@/hooks/useCardExecution";
import type { PrepareFarmUnstakeResult } from "@/lib/ai/tool-types";
import { formatAmount, DetailRow } from "./shared/ExecutionCardParts";
import { ExecutionCardLayout } from "./shared/ExecutionCardLayout";
import type { ExecutionRecord } from "../ExecutionStateContext";

export function FarmUnstakeCard({ data, toolCallId, executionState }: { data: PrepareFarmUnstakeResult; toolCallId?: string; executionState?: ExecutionRecord }) {
  const steps: ExecutionStep[] = [
    {
      label: "Withdrawing...",
      execute: async ({ writeContractAsync }) =>
        writeContractAsync({
          address: data.tx.masterChef as `0x${string}`,
          abi: masterchefAbi,
          functionName: "withdraw",
          args: [BigInt(data.tx.pid), BigInt(data.tx.rawAmount)],
        }),
    },
  ];

  return (
    <ExecutionCardLayout
      title={`Farm Unstake — Pool ${data.pid}`}
      cancelledLabel="Farm Unstake"
      riskFlags={data.riskFlags}
      contractInfo={data.contractInfo}
      steps={steps}
      toolCallId={toolCallId}
      executionState={executionState}
      walletMessage="Connect your wallet to unstake"
      successMessage="LP tokens unstaked! Rewards claimed."
      buttonLabel="Unstake LP"
      details={<>
        <DetailRow label="Pending Rewards" value={`${formatAmount(data.pendingRewards)} ${data.rewardToken}`} />
        <DetailRow label="Gas Fee" value={`~${formatAmount(data.gasEstimate)} KAS`} />
      </>}
    >
      <div className="text-sm text-zinc-300 mb-1">
        Withdrawing <span className="font-mono text-teal-400">{formatAmount(data.amount)}</span>{" "}
        <span className="text-zinc-400">{data.lpTokenSymbol}</span>
      </div>
    </ExecutionCardLayout>
  );
}
