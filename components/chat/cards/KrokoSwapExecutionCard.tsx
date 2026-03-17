"use client";

import { useAccount } from "wagmi";
import { maxUint256 } from "viem";
import { erc20Abi, permit2Abi } from "@/config/abis";
import { useCardExecution, type ExecutionStep } from "@/hooks/useCardExecution";
import type { KrokoPrepareSwapResult } from "@/lib/ai/tool-types";
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

const MAX_UINT160 = (1n << 160n) - 1n;
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export function KrokoSwapExecutionCard({ data, toolCallId, executionState }: { data: KrokoPrepareSwapResult; toolCallId?: string; executionState?: ExecutionRecord }) {
  const { isConnected } = useAccount();

  const steps: ExecutionStep[] = [];

  // Step 1: ERC-20 approval to Permit2
  if (!data.isNativeIn && data.needsTokenApproval) {
    steps.push({
      label: "Approving token...",
      execute: async ({ writeContractAsync }) =>
        writeContractAsync({
          address: data.tokenInAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [data.permit2Address as `0x${string}`, maxUint256],
        }),
    });
  }

  // Step 2: Permit2 approval to Universal Router
  if (!data.isNativeIn && data.needsPermit2Approval) {
    steps.push({
      label: "Approving Permit2...",
      execute: async ({ writeContractAsync }) => {
        const expiration = Math.floor(Date.now() / 1000) + ONE_YEAR_SECONDS;
        return writeContractAsync({
          address: data.permit2Address as `0x${string}`,
          abi: permit2Abi,
          functionName: "approve",
          args: [
            data.tokenInAddress as `0x${string}`,
            data.universalRouterAddress as `0x${string}`,
            MAX_UINT160,
            expiration,
          ],
        });
      },
    });
  }

  // Step 3: Execute swap via Universal Router (pre-built calldata)
  steps.push({
    label: "Swapping...",
    execute: async ({ sendTransactionAsync }) =>
      sendTransactionAsync({
        to: data.tx.to as `0x${string}`,
        data: data.tx.data as `0x${string}`,
        value: BigInt(data.tx.value),
      }),
  });

  const { status, currentStepLabel, isLoading, errorMsg, txHash, handleExecute, handleRetry, handleCancel } =
    useCardExecution({ steps, toolCallId, executionState });

  if (status === "cancelled") return <CancelledState label="KrokoSwap" />;

  const approvalCount =
    (data.needsTokenApproval && !data.isNativeIn ? 1 : 0) +
    (data.needsPermit2Approval && !data.isNativeIn ? 1 : 0);
  const buttonLabel =
    approvalCount === 2
      ? "Approve & Swap (2 approvals)"
      : approvalCount === 1
        ? "Approve & Swap"
        : "Execute Swap";

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-xs text-zinc-500 uppercase tracking-wide">Transaction Summary</div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-900/50 text-indigo-400 font-medium">
          KrokoSwap
        </span>
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
        <DetailRow label="Min Received" value={`${formatAmount(data.amountOutMin)} ${data.tokenOut.toUpperCase()}`} />
        <DetailRow label="Slippage" value={`${data.slippage}%`} />
        <DetailRow label="Gas Fee" value={`~${formatAmount(data.gasEstimate)} KAS`} />
        <DetailRow label="Route" value={data.route} />
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
        buttonLabel={buttonLabel}
        loadingLabel={currentStepLabel}
      />
    </div>
  );
}
