"use client";

import { erc20Abi, infinityPoolZealAbi } from "@/config/abis";
import { INFINITY_POOL_ABIS } from "@/config/pools";
import type { ExecutionStep } from "@/hooks/useCardExecution";
import type { PrepareInfinityStakeResult } from "@/lib/ai/tool-types";
import { TokenBadge, formatAmount, DetailRow } from "./shared/ExecutionCardParts";
import { ExecutionCardLayout } from "./shared/ExecutionCardLayout";
import type { ExecutionRecord } from "../ExecutionStateContext";

export function InfinityStakeCard({ data, toolCallId, executionState }: { data: PrepareInfinityStakeResult; toolCallId?: string; executionState?: ExecutionRecord }) {
  const steps: ExecutionStep[] = [];

  if (data.needsApproval) {
    steps.push({
      label: `Approving ${data.token}...`,
      execute: async ({ writeContractAsync }) =>
        writeContractAsync({
          address: data.tx.tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [data.tx.pool as `0x${string}`, BigInt(data.tx.rawAmount)],
        }),
    });
  }

  const abi = INFINITY_POOL_ABIS[data.token] ?? infinityPoolZealAbi;
  steps.push({
    label: "Staking...",
    execute: async ({ writeContractAsync }) =>
      writeContractAsync({
        address: data.tx.pool as `0x${string}`,
        abi,
        functionName: "stake",
        args: [BigInt(data.tx.rawAmount)],
      }),
  });

  return (
    <ExecutionCardLayout
      title="InfinityPool Stake"
      cancelledLabel="InfinityPool Stake"
      riskFlags={data.riskFlags}
      contractInfo={data.contractInfo}
      steps={steps}
      toolCallId={toolCallId}
      executionState={executionState}
      walletMessage="Connect your wallet to stake"
      successMessage={`${data.token} staked! You received x${data.token}.`}
      buttonLabel={data.needsApproval ? `Approve & Stake ${data.token}` : `Stake ${data.token}`}
      details={<>
        <DetailRow label="Exchange Rate" value={`1 x${data.token} = ${formatAmount(data.exchangeRate)} ${data.token}`} />
        <DetailRow label="Total Staked" value={`${formatAmount(data.totalStaked)} ${data.token}`} />
        <DetailRow label="Gas Fee" value={`~${formatAmount(data.gasEstimate)} KAS`} />
      </>}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <TokenBadge symbol={data.token} />
          <span className="font-mono text-teal-400 text-lg">{formatAmount(data.amount)}</span>
        </div>
        <span className="text-zinc-500 text-lg">&rarr;</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold bg-zinc-700/50 text-zinc-300 px-2 py-0.5 rounded">
            x{data.token}
          </span>
          <span className="font-mono text-teal-400 text-lg">{formatAmount(data.xTokensReceived)}</span>
        </div>
      </div>
    </ExecutionCardLayout>
  );
}
