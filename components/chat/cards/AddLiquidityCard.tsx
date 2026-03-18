"use client";

import { useAccount } from "wagmi";
import { routerAbi, erc20Abi } from "@/config/abis";
import type { ExecutionStep } from "@/hooks/useCardExecution";
import type { PrepareAddLiquidityResult } from "@/lib/ai/tool-types";
import { TokenBadge, formatAmount, DetailRow } from "./shared/ExecutionCardParts";
import { ExecutionCardLayout } from "./shared/ExecutionCardLayout";
import type { ExecutionRecord } from "../ExecutionStateContext";

export function AddLiquidityCard({ data, toolCallId, executionState }: { data: PrepareAddLiquidityResult; toolCallId?: string; executionState?: ExecutionRecord }) {
  const { address } = useAccount();

  const steps: ExecutionStep[] = [];

  if (data.needsApprovalA) {
    steps.push({
      label: `Approving ${data.tokenA}...`,
      execute: async ({ writeContractAsync }) =>
        writeContractAsync({
          address: data.tx.tokenAAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [data.tx.router as `0x${string}`, BigInt(data.tx.rawAmountADesired)],
        }),
    });
  }

  if (data.needsApprovalB) {
    steps.push({
      label: `Approving ${data.tokenB}...`,
      execute: async ({ writeContractAsync }) =>
        writeContractAsync({
          address: data.tx.tokenBAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [data.tx.router as `0x${string}`, BigInt(data.tx.rawAmountBDesired)],
        }),
    });
  }

  steps.push({
    label: "Adding liquidity...",
    execute: async ({ writeContractAsync }) => {
      const { tx, liquidityType } = data;
      const deadline = BigInt(tx.deadline);

      if (liquidityType === "KAS_TOKEN") {
        const isANative = data.tokenA.toUpperCase() === "KAS";
        const tokenAddr = isANative ? tx.tokenBAddress : tx.tokenAAddress;
        const amountTokenDesired = BigInt(isANative ? tx.rawAmountBDesired : tx.rawAmountADesired);
        const amountTokenMin = BigInt(isANative ? tx.rawAmountBMin : tx.rawAmountAMin);
        const amountKASMin = BigInt(isANative ? tx.rawAmountAMin : tx.rawAmountBMin);

        return writeContractAsync({
          address: tx.router as `0x${string}`,
          abi: routerAbi,
          functionName: "addLiquidityKAS",
          args: [tokenAddr as `0x${string}`, amountTokenDesired, amountTokenMin, amountKASMin, address!, deadline],
          value: BigInt(tx.value),
        });
      }

      return writeContractAsync({
        address: tx.router as `0x${string}`,
        abi: routerAbi,
        functionName: "addLiquidity",
        args: [
          tx.tokenAAddress as `0x${string}`,
          tx.tokenBAddress as `0x${string}`,
          BigInt(tx.rawAmountADesired),
          BigInt(tx.rawAmountBDesired),
          BigInt(tx.rawAmountAMin),
          BigInt(tx.rawAmountBMin),
          address!,
          deadline,
        ],
      });
    },
  });

  const needsAnyApproval = data.needsApprovalA || data.needsApprovalB;

  return (
    <ExecutionCardLayout
      title="Add Liquidity"
      cancelledLabel="Add Liquidity"
      riskFlags={data.riskFlags}
      contractInfo={data.contractInfo}
      steps={steps}
      toolCallId={toolCallId}
      executionState={executionState}
      walletMessage="Connect your wallet to add liquidity"
      successMessage="Liquidity added!"
      buttonLabel={needsAnyApproval ? "Approve & Add Liquidity" : "Add Liquidity"}
      details={<>
        <DetailRow label="Est. LP Tokens" value={data.estimatedLpTokens === "first deposit" ? "First deposit" : formatAmount(data.estimatedLpTokens)} />
        <DetailRow label="Pool Share" value={`${data.poolShare}%`} />
        <DetailRow label="Gas Fee" value={`~${formatAmount(data.gasEstimate)} KAS`} />
        <DetailRow label="Slippage" value={`${data.slippage}%`} />
      </>}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <TokenBadge symbol={data.tokenA} />
          <span className="font-mono text-teal-400 text-lg">{formatAmount(data.amountA)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-sm">+</span>
        </div>
        <div className="flex items-center gap-2">
          <TokenBadge symbol={data.tokenB} />
          <span className="font-mono text-teal-400 text-lg">{formatAmount(data.amountB)}</span>
        </div>
      </div>
    </ExecutionCardLayout>
  );
}
