"use client";

import { masterchefAbi, erc20Abi } from "@/config/abis";
import type { ExecutionStep } from "@/hooks/useCardExecution";
import type { PrepareFarmStakeResult } from "@/lib/ai/tool-types";
import { formatAmount, DetailRow } from "./shared/ExecutionCardParts";
import { ExecutionCardLayout } from "./shared/ExecutionCardLayout";
import type { ExecutionRecord } from "../ExecutionStateContext";

export function FarmStakeCard({ data, toolCallId, executionState }: { data: PrepareFarmStakeResult; toolCallId?: string; executionState?: ExecutionRecord }) {
  const steps: ExecutionStep[] = [];

  if (data.needsApproval) {
    steps.push({
      label: "Approving LP...",
      execute: async ({ writeContractAsync }) =>
        writeContractAsync({
          address: data.tx.lpToken as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [data.tx.masterChef as `0x${string}`, BigInt(data.tx.rawAmount)],
        }),
    });
  }

  steps.push({
    label: "Depositing...",
    execute: async ({ writeContractAsync }) =>
      writeContractAsync({
        address: data.tx.masterChef as `0x${string}`,
        abi: masterchefAbi,
        functionName: "deposit",
        args: [BigInt(data.tx.pid), BigInt(data.tx.rawAmount)],
      }),
  });

  return (
    <ExecutionCardLayout
      title={`Farm Stake — Pool ${data.pid}`}
      cancelledLabel="Farm Stake"
      riskFlags={data.riskFlags}
      contractInfo={data.contractInfo}
      steps={steps}
      toolCallId={toolCallId}
      executionState={executionState}
      walletMessage="Connect your wallet to stake"
      successMessage="LP tokens staked!"
      buttonLabel={data.needsApproval ? "Approve & Stake" : "Stake LP"}
      details={<>
        <DetailRow label="Existing Stake" value={`${formatAmount(data.existingStake)} LP`} />
        <DetailRow label="Pending Rewards" value={`${formatAmount(data.pendingRewards)} ${data.rewardToken}`} />
        <DetailRow label="Locking Period" value={data.lockingPeriod} />
        <DetailRow label="Gas Fee" value={`~${formatAmount(data.gasEstimate)} KAS`} />
      </>}
    >
      <div className="text-sm text-zinc-300 mb-1">
        Staking <span className="font-mono text-teal-400">{formatAmount(data.amount)}</span>{" "}
        <span className="text-zinc-400">{data.lpTokenSymbol}</span>
      </div>
    </ExecutionCardLayout>
  );
}
