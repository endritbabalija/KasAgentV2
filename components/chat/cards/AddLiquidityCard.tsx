"use client";

import { useAccount } from "wagmi";
import { routerAbi, erc20Abi } from "@/config/abis";
import { useCardExecution, type ExecutionStep } from "@/hooks/useCardExecution";
import type { PrepareAddLiquidityResult } from "@/lib/ai/tool-types";
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

export function AddLiquidityCard({ data, toolCallId, executionState }: { data: PrepareAddLiquidityResult; toolCallId?: string; executionState?: ExecutionRecord }) {
  const { address, isConnected } = useAccount();

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

  const { status, currentStepLabel, isLoading, errorMsg, txHash, handleExecute, handleRetry, handleCancel } =
    useCardExecution({ steps, toolCallId, executionState });

  if (status === "cancelled") return <CancelledState label="Add Liquidity" />;

  const needsAnyApproval = data.needsApprovalA || data.needsApprovalB;

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Add Liquidity</div>

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

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <DetailRow label="Est. LP Tokens" value={data.estimatedLpTokens === "first deposit" ? "First deposit" : formatAmount(data.estimatedLpTokens)} />
        <DetailRow label="Pool Share" value={`${data.poolShare}%`} />
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
        walletMessage="Connect your wallet to add liquidity"
        successMessage="Liquidity added!"
        buttonLabel={needsAnyApproval ? "Approve & Add Liquidity" : "Add Liquidity"}
        loadingLabel={currentStepLabel}
      />
    </div>
  );
}
