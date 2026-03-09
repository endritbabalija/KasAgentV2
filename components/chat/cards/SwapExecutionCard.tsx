"use client";

import { useState } from "react";
import { useAccount, useConfig, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { routerAbi, erc20Abi } from "@/config/abis";
import type { PrepareSwapResult } from "@/lib/ai/tool-types";
import {
  TokenBadge,
  formatAmount,
  DetailRow,
  RiskFlagList,
  ContractInfoAccordion,
  ActionArea,
  CancelledState,
} from "./shared/ExecutionCardParts";

type SwapState = "idle" | "approving" | "swapping" | "success" | "error" | "cancelled";

export function SwapExecutionCard({ data }: { data: PrepareSwapResult }) {
  const { address, isConnected } = useAccount();
  const config = useConfig();
  const [state, setState] = useState<SwapState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [txHash, setTxHash] = useState<string>();

  const { writeContractAsync: writeApproveAsync, reset: resetApprove } = useWriteContract();
  const { writeContractAsync: writeSwapAsync, reset: resetSwap } = useWriteContract();

  async function handleExecute() {
    setErrorMsg("");
    try {
      if (data.needsApproval) {
        setState("approving");
        const approveHash = await writeApproveAsync({
          address: data.tx.tokenInAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [data.tx.router as `0x${string}`, BigInt(data.tx.rawAmountIn)],
        });
        await waitForTransactionReceipt(config, { hash: approveHash });
      }

      const { tx, swapType } = data;
      const path = tx.path as `0x${string}`[];
      const deadline = BigInt(tx.deadline);

      setState("swapping");

      let hash: `0x${string}`;
      if (swapType === "KAS_TO_TOKEN") {
        hash = await writeSwapAsync({
          address: tx.router as `0x${string}`,
          abi: routerAbi,
          functionName: "swapExactKASForTokens",
          args: [BigInt(tx.rawAmountOutMin), path, address!, deadline],
          value: BigInt(tx.value),
        });
      } else if (swapType === "TOKEN_TO_KAS") {
        hash = await writeSwapAsync({
          address: tx.router as `0x${string}`,
          abi: routerAbi,
          functionName: "swapExactTokensForKAS",
          args: [
            BigInt(tx.rawAmountIn),
            BigInt(tx.rawAmountOutMin),
            path,
            address!,
            deadline,
          ],
        });
      } else {
        hash = await writeSwapAsync({
          address: tx.router as `0x${string}`,
          abi: routerAbi,
          functionName: "swapExactTokensForTokens",
          args: [
            BigInt(tx.rawAmountIn),
            BigInt(tx.rawAmountOutMin),
            path,
            address!,
            deadline,
          ],
        });
      }

      setTxHash(hash);
      await waitForTransactionReceipt(config, { hash });
      setState("success");
    } catch (err) {
      setState("error");
      setErrorMsg((err as Error).message.split("\n")[0]);
    }
  }

  function handleRetry() {
    setState("idle");
    setErrorMsg("");
    setTxHash(undefined);
    resetApprove();
    resetSwap();
  }

  const isLoading = state === "approving" || state === "swapping";
  const loadingLabel = state === "approving" ? "Approving..." : "Swapping...";
  if (state === "cancelled") {
    return <CancelledState />;
  }

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      {/* Header */}
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
        Transaction Summary
      </div>

      {/* Swap amounts */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <TokenBadge symbol={data.tokenIn} />
          <span className="font-mono text-teal-400 text-lg">
            {formatAmount(data.amountIn)}
          </span>
        </div>
        <span className="text-zinc-500 text-lg">&rarr;</span>
        <div className="flex items-center gap-2">
          <TokenBadge symbol={data.tokenOut} />
          <span className="font-mono text-teal-400 text-lg">
            {formatAmount(data.amountOut)}
          </span>
        </div>
      </div>

      {/* Fee & Output breakdown */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <DetailRow label="DEX Fee" value={`${data.dexFeeAmount} (${data.feeRate})${data.discountApplied ? " — Discounted" : ""}`} />
        <DetailRow label="Gas Fee" value={`~${formatAmount(data.gasEstimate)} KAS`} />
        <DetailRow label="Min Received" value={`${formatAmount(data.amountOutMin)} ${data.tokenOut.toUpperCase()}`} />
        <DetailRow label="Slippage" value={`${data.slippage}%`} />
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

      {/* Contract interaction (collapsible) */}
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
        onCancel={() => setState("cancelled")}
        walletMessage="Connect your wallet to execute this swap"
        successMessage="Swap confirmed!"
        buttonLabel={data.needsApproval ? "Approve & Swap" : "Execute Swap"}
        loadingLabel={loadingLabel}
      />
    </div>
  );
}
