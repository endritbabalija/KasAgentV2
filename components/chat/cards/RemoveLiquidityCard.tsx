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
  SuccessState,
  ErrorState,
  CancelledState,
  DetailRow,
} from "./shared/ExecutionCardParts";

type RemoveLiquidityState = "idle" | "approving" | "removing" | "success" | "error" | "cancelled";

export function RemoveLiquidityCard({ data }: { data: PrepareRemoveLiquidityResult }) {
  const { address, isConnected } = useAccount();
  const config = useConfig();
  const [state, setState] = useState<RemoveLiquidityState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [txHash, setTxHash] = useState<string>();

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

      <div className="mt-4">
        {!isConnected ? (
          <div className="text-sm text-zinc-500 text-center py-2">Connect your wallet to remove liquidity</div>
        ) : state === "success" ? (
          <SuccessState message="Liquidity removed!" txHash={txHash} />
        ) : state === "error" ? (
          <ErrorState message={errorMsg} onRetry={handleRetry} />
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleExecute}
              disabled={isLoading}
              className="flex-1 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-zinc-500 border-t-white animate-spin" />
                  {state === "approving" ? "Approving LP..." : "Removing..."}
                </span>
              ) : data.needsApproval ? (
                "Approve & Remove"
              ) : (
                "Remove Liquidity"
              )}
            </button>
            {!isLoading && (
              <button
                onClick={() => setState("cancelled")}
                className="px-4 py-2.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
