"use client";

import { useAccount } from "wagmi";
import { erc20Abi, infinityPoolZealAbi } from "@/config/abis";
import { INFINITY_POOL_ABIS } from "@/config/pools";
import { useCardExecution, type ExecutionStep } from "@/hooks/useCardExecution";
import type { PrepareInfinityUnstakeResult } from "@/lib/ai/tool-types";
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

export function InfinityUnstakeCard({ data, toolCallId, executionState }: { data: PrepareInfinityUnstakeResult; toolCallId?: string; executionState?: ExecutionRecord }) {
  const { isConnected } = useAccount();

  const steps: ExecutionStep[] = [];

  if (data.needsApproval) {
    steps.push({
      label: `Approving x${data.token}...`,
      execute: async ({ writeContractAsync }) =>
        writeContractAsync({
          address: data.tx.xTokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [data.tx.pool as `0x${string}`, BigInt(data.tx.rawXAmount)],
        }),
    });
  }

  const abi = INFINITY_POOL_ABIS[data.token] ?? infinityPoolZealAbi;
  steps.push({
    label: "Unstaking...",
    execute: async ({ writeContractAsync }) =>
      writeContractAsync({
        address: data.tx.pool as `0x${string}`,
        abi,
        functionName: "unstake",
        args: [BigInt(data.tx.rawXAmount)],
      }),
  });

  const { status, currentStepLabel, isLoading, errorMsg, txHash, handleExecute, handleRetry, handleCancel } =
    useCardExecution({ steps, toolCallId, executionState });

  if (status === "cancelled") return <CancelledState label="InfinityPool Unstake" />;

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">InfinityPool Unstake</div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold bg-zinc-700/50 text-zinc-300 px-2 py-0.5 rounded">
            x{data.token}
          </span>
          <span className="font-mono text-teal-400 text-lg">{formatAmount(data.xAmount)}</span>
        </div>
        <span className="text-zinc-500 text-lg">&rarr;</span>
        <div className="flex items-center gap-2">
          <TokenBadge symbol={data.token} />
          <span className="font-mono text-teal-400 text-lg">{formatAmount(data.tokensReceived)}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <DetailRow label="Exchange Rate" value={`1 x${data.token} = ${formatAmount(data.exchangeRate)} ${data.token}`} />
        <DetailRow label="Total Staked" value={`${formatAmount(data.totalStaked)} ${data.token}`} />
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
        successMessage={`Unstaked! You received ${data.token}.`}
        buttonLabel={data.needsApproval ? `Approve & Unstake x${data.token}` : `Unstake x${data.token}`}
        loadingLabel={currentStepLabel}
      />
    </div>
  );
}
