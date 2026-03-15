"use client";

import { useAccount } from "wagmi";
import { masterchefAbi } from "@/config/abis";
import { useCardExecution, type ExecutionStep } from "@/hooks/useCardExecution";
import type { PrepareFarmUnstakeResult } from "@/lib/ai/tool-types";
import {
  formatAmount,
  RiskFlagList,
  ContractInfoAccordion,
  ActionArea,
  CancelledState,
  DetailRow,
} from "./shared/ExecutionCardParts";
import type { ExecutionRecord } from "../ExecutionStateContext";

export function FarmUnstakeCard({ data, toolCallId, executionState }: { data: PrepareFarmUnstakeResult; toolCallId?: string; executionState?: ExecutionRecord }) {
  const { isConnected } = useAccount();

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

  const { status, currentStepLabel, isLoading, errorMsg, txHash, handleExecute, handleRetry, handleCancel } =
    useCardExecution({ steps, toolCallId, executionState });

  if (status === "cancelled") return <CancelledState label="Farm Unstake" />;

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Farm Unstake — Pool {data.pid}</div>

      <div className="text-sm text-zinc-300 mb-1">
        Withdrawing <span className="font-mono text-teal-400">{formatAmount(data.amount)}</span>{" "}
        <span className="text-zinc-400">{data.lpTokenSymbol}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <DetailRow label="Pending Rewards" value={`${formatAmount(data.pendingRewards)} ${data.rewardToken}`} />
        <DetailRow label="Gas Fee" value={`~${formatAmount(data.gasEstimate)} KAS`} />
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
        walletMessage="Connect your wallet to unstake"
        successMessage="LP tokens unstaked! Rewards claimed."
        buttonLabel="Unstake LP"
        loadingLabel={currentStepLabel}
      />
    </div>
  );
}
