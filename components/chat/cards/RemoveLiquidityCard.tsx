"use client";

import { useState } from "react";
import { useAccount, useConfig, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { routerAbi, erc20Abi } from "@/config/abis";
import type { PrepareRemoveLiquidityResult } from "@/lib/ai/tool-types";
import {
  TokenBadge,
  formatAmount,
  RiskFlagList,
  ContractInfoAccordion,
  ActionArea,
  CancelledState,
  DetailRow,
} from "./shared/ExecutionCardParts";
import { useExecutionState, type ExecutionRecord } from "../ExecutionStateContext";

type RemoveLiquidityState = "idle" | "approving" | "removing" | "success" | "error" | "cancelled";

export function RemoveLiquidityCard({ data, toolCallId, executionState }: { data: PrepareRemoveLiquidityResult; toolCallId?: string; executionState?: ExecutionRecord }) {
  const { address, isConnected } = useAccount();
  const config = useConfig();
  const { markExecuted } = useExecutionState();
  const [state, setState] = useState<RemoveLiquidityState>((executionState?.state as RemoveLiquidityState) ?? "idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [txHash, setTxHash] = useState<string | undefined>(executionState?.txHash);

  const { writeContractAsync: writeApproveAsync, reset: resetApprove } = useWriteContract();
  const { writeContractAsync: writeRemoveAsync, reset: resetRemove } = useWriteContract();

  async function handleExecute() {
    setErrorMsg("");
    try {
      // Approve LP token if needed
      if (data.needsApproval) {
        setState("approving");
        const approveHash = await writeApproveAsync({
          address: data.tx.pairAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [data.tx.router as `0x${string}`, BigInt(data.tx.rawLpAmount)],
        });
        await waitForTransactionReceipt(config, { hash: approveHash });
      }

      // Remove liquidity
      const { tx, liquidityType } = data;
      const deadline = BigInt(tx.deadline);
      setState("removing");

      let hash: `0x${string}`;
      if (liquidityType === "KAS_TOKEN") {
        const isANative = data.tokenA.toUpperCase() === "KAS";
        const tokenAddr = isANative ? tx.tokenBAddress : tx.tokenAAddress;
        const amountTokenMin = BigInt(isANative ? tx.rawAmountBMin : tx.rawAmountAMin);
        const amountKASMin = BigInt(isANative ? tx.rawAmountAMin : tx.rawAmountBMin);

        hash = await writeRemoveAsync({
          address: tx.router as `0x${string}`,
          abi: routerAbi,
          functionName: "removeLiquidityKAS",
          args: [tokenAddr as `0x${string}`, BigInt(tx.rawLpAmount), amountTokenMin, amountKASMin, address!, deadline],
        });
      } else {
        hash = await writeRemoveAsync({
          address: tx.router as `0x${string}`,
          abi: routerAbi,
          functionName: "removeLiquidity",
          args: [
            tx.tokenAAddress as `0x${string}`,
            tx.tokenBAddress as `0x${string}`,
            BigInt(tx.rawLpAmount),
            BigInt(tx.rawAmountAMin),
            BigInt(tx.rawAmountBMin),
            address!,
            deadline,
          ],
        });
      }

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
    resetApprove();
    resetRemove();
  }

  const isLoading = state === "approving" || state === "removing";

  if (state === "cancelled") {
    return <CancelledState label="Remove Liquidity" />;
  }

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Remove Liquidity</div>

      {/* What you'll receive */}
      <div className="text-xs text-zinc-500 mb-2">Removing {data.percentage}% of LP ({formatAmount(data.lpAmount)} LP tokens)</div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <TokenBadge symbol={data.tokenA} />
          <span className="font-mono text-teal-400 text-lg">{formatAmount(data.expectedAmountA)}</span>
        </div>
        <div className="flex items-center gap-2">
          <TokenBadge symbol={data.tokenB} />
          <span className="font-mono text-teal-400 text-lg">{formatAmount(data.expectedAmountB)}</span>
        </div>
      </div>

      {/* Details */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <DetailRow label="Min Received" value={`${formatAmount(data.amountAMin)} ${data.tokenA}`} />
        <DetailRow label="" value={`${formatAmount(data.amountBMin)} ${data.tokenB}`} />
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
        state={state}
        isLoading={isLoading}
        txHash={txHash}
        errorMsg={errorMsg}
        onExecute={handleExecute}
        onRetry={handleRetry}
        onCancel={() => { setState("cancelled"); if (toolCallId) markExecuted(toolCallId, "cancelled"); }}
        walletMessage="Connect your wallet to remove liquidity"
        successMessage="Liquidity removed!"
        buttonLabel={data.needsApproval ? "Approve & Remove" : "Remove Liquidity"}
        loadingLabel={state === "approving" ? "Approving LP..." : "Removing..."}
      />
    </div>
  );
}
