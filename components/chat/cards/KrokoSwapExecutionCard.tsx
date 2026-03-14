"use client";

import { useState } from "react";
import { useAccount, useConfig, useWriteContract, useSendTransaction } from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { maxUint256 } from "viem";
import { erc20Abi, permit2Abi } from "@/config/abis";
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
import { useExecutionState, type ExecutionRecord } from "../ExecutionStateContext";

type KrokoSwapState =
  | "idle"
  | "approving_token"
  | "approving_permit2"
  | "swapping"
  | "success"
  | "error"
  | "cancelled";

const MAX_UINT160 = (1n << 160n) - 1n;
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export function KrokoSwapExecutionCard({
  data,
  toolCallId,
  executionState,
}: {
  data: KrokoPrepareSwapResult;
  toolCallId?: string;
  executionState?: ExecutionRecord;
}) {
  const { isConnected } = useAccount();
  const config = useConfig();
  const { markExecuted } = useExecutionState();
  const [state, setState] = useState<KrokoSwapState>(
    (executionState?.state as KrokoSwapState) ?? "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [txHash, setTxHash] = useState<string | undefined>(executionState?.txHash);

  const { writeContractAsync: writeApproveToken, reset: resetApproveToken } = useWriteContract();
  const { writeContractAsync: writeApprovePermit2, reset: resetApprovePermit2 } = useWriteContract();
  const { sendTransactionAsync, reset: resetSend } = useSendTransaction();

  async function handleExecute() {
    setErrorMsg("");
    try {
      // Step 1: ERC-20 approval to Permit2 (skip for native KAS)
      if (!data.isNativeIn && data.needsTokenApproval) {
        setState("approving_token");
        const hash = await writeApproveToken({
          address: data.tokenInAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [data.permit2Address as `0x${string}`, maxUint256],
        });
        await waitForTransactionReceipt(config, { hash });
      }

      // Step 2: Permit2 approval to Universal Router (skip for native KAS)
      if (!data.isNativeIn && data.needsPermit2Approval) {
        setState("approving_permit2");
        const expiration = Math.floor(Date.now() / 1000) + ONE_YEAR_SECONDS;
        const hash = await writeApprovePermit2({
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
        await waitForTransactionReceipt(config, { hash });
      }

      // Step 3: Execute swap via Universal Router (pre-built calldata from API)
      setState("swapping");
      const hash = await sendTransactionAsync({
        to: data.tx.to as `0x${string}`,
        data: data.tx.data as `0x${string}`,
        value: BigInt(data.tx.value),
      });

      setTxHash(hash);
      await waitForTransactionReceipt(config, { hash });
      setState("success");
      if (toolCallId) markExecuted(toolCallId, "success", hash);
    } catch (err) {
      setState("error");
      setErrorMsg((err as Error).message.split("\n")[0]);
    }
  }

  function handleRetry() {
    setState("idle");
    setErrorMsg("");
    setTxHash(undefined);
    resetApproveToken();
    resetApprovePermit2();
    resetSend();
  }

  const isLoading =
    state === "approving_token" ||
    state === "approving_permit2" ||
    state === "swapping";

  const loadingLabels: Record<string, string> = {
    approving_token: "Approving token...",
    approving_permit2: "Approving Permit2...",
    swapping: "Swapping...",
  };

  if (state === "cancelled") {
    return <CancelledState />;
  }

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
      {/* Header with protocol badge */}
      <div className="flex items-center gap-2 mb-3">
        <div className="text-xs text-zinc-500 uppercase tracking-wide">Transaction Summary</div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-900/50 text-indigo-400 font-medium">
          KrokoSwap
        </span>
      </div>

      {/* Swap amounts */}
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

      {/* Details */}
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

      {/* Risk warnings */}
      <div className="mt-3">
        <RiskFlagList flags={data.riskFlags} />
      </div>

      {/* Contract interaction */}
      {data.contractInfo && (
        <div className="mt-3">
          <ContractInfoAccordion info={data.contractInfo} />
        </div>
      )}

      <ActionArea
        isConnected={isConnected}
        state={state}
        isLoading={isLoading}
        txHash={txHash}
        errorMsg={errorMsg}
        onExecute={handleExecute}
        onRetry={handleRetry}
        onCancel={() => {
          setState("cancelled");
          if (toolCallId) markExecuted(toolCallId, "cancelled");
        }}
        walletMessage="Connect your wallet to execute this swap"
        successMessage="Swap confirmed!"
        buttonLabel={buttonLabel}
        loadingLabel={loadingLabels[state] ?? "Processing..."}
      />
    </div>
  );
}
