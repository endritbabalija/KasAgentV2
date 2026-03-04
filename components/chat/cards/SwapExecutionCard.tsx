"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { routerAbi } from "@/config/abis";
import { erc20Abi } from "@/config/abis";
import type { PrepareSwapResult } from "@/lib/ai/tool-types";

function TokenBadge({ symbol }: { symbol: string }) {
  const colors: Record<string, string> = {
    KAS: "bg-emerald-900/50 text-emerald-400",
    WKAS: "bg-emerald-900/50 text-emerald-400",
    ZEAL: "bg-blue-900/50 text-blue-400",
    NACHO: "bg-orange-900/50 text-orange-400",
    KASPER: "bg-purple-900/50 text-purple-400",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
        colors[symbol.toUpperCase()] ?? "bg-zinc-700/50 text-zinc-300"
      }`}
    >
      {symbol.toUpperCase()}
    </span>
  );
}

function formatAmount(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  if (n >= 1_000_000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

type SwapState = "idle" | "approving" | "approved" | "swapping" | "success" | "error";

export function SwapExecutionCard({ data }: { data: PrepareSwapResult }) {
  const { address, isConnected } = useAccount();
  const [state, setState] = useState<SwapState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Approve contract write
  const {
    writeContract: writeApprove,
    data: approveTxHash,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();

  // Swap contract write
  const {
    writeContract: writeSwap,
    data: swapTxHash,
    error: swapError,
    reset: resetSwap,
  } = useWriteContract();

  // Wait for approve receipt
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });

  // Wait for swap receipt
  const { isSuccess: swapConfirmed } = useWaitForTransactionReceipt({
    hash: swapTxHash,
  });

  // Handle approve confirmation → trigger swap
  useEffect(() => {
    if (approveConfirmed && state === "approving") {
      setState("approved");
      executeSwap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveConfirmed]);

  // Handle swap confirmation
  useEffect(() => {
    if (swapConfirmed && state === "swapping") {
      setState("success");
    }
  }, [swapConfirmed, state]);

  // Handle errors
  useEffect(() => {
    if (approveError) {
      setState("error");
      setErrorMsg(approveError.message.split("\n")[0]);
    }
  }, [approveError]);

  useEffect(() => {
    if (swapError) {
      setState("error");
      setErrorMsg(swapError.message.split("\n")[0]);
    }
  }, [swapError]);

  function executeSwap() {
    const { tx, swapType } = data;
    const path = tx.path as `0x${string}`[];
    const deadline = BigInt(tx.deadline);

    setState("swapping");

    if (swapType === "KAS_TO_TOKEN") {
      writeSwap({
        address: tx.router as `0x${string}`,
        abi: routerAbi,
        functionName: "swapExactKASForTokens",
        args: [BigInt(tx.rawAmountOutMin), path, address!, deadline],
        value: BigInt(tx.value),
      });
    } else if (swapType === "TOKEN_TO_KAS") {
      writeSwap({
        address: tx.router as `0x${string}`,
        abi: routerAbi,
        functionName: "swapTokensForExactKAS",
        args: [
          BigInt(tx.rawAmountOutMin),
          BigInt(tx.rawAmountIn),
          path,
          address!,
          deadline,
        ],
      });
    } else {
      writeSwap({
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
  }

  function handleExecute() {
    setErrorMsg("");

    if (data.needsApproval) {
      setState("approving");
      writeApprove({
        address: data.tx.tokenInAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [data.tx.router as `0x${string}`, BigInt(data.tx.rawAmountIn)],
      });
    } else {
      executeSwap();
    }
  }

  function handleRetry() {
    setState("idle");
    setErrorMsg("");
    resetApprove();
    resetSwap();
  }

  const isLoading = state === "approving" || state === "swapping";

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
        Swap Transaction
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

      {/* Details */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="text-zinc-500">Min received</div>
        <div className="text-zinc-300 font-mono text-right">
          {formatAmount(data.amountOutMin)} {data.tokenOut.toUpperCase()}
        </div>
        <div className="text-zinc-500">Slippage</div>
        <div className="text-zinc-300 font-mono text-right">{data.slippage}%</div>
        <div className="text-zinc-500">Price impact</div>
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
        <div className="text-zinc-500">DEX fee</div>
        <div className="text-zinc-300 font-mono text-right">{data.dexFee}%</div>
      </div>

      {/* Action area */}
      <div className="mt-4">
        {!isConnected ? (
          <div className="text-sm text-zinc-500 text-center py-2">
            Connect your wallet to execute this swap
          </div>
        ) : state === "success" ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Swap confirmed!
            </div>
            {swapTxHash && (
              <a
                href={`https://explorer.kasplex.org/tx/${swapTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-teal-400 hover:text-teal-300 underline break-all"
              >
                View on Explorer &rarr;
              </a>
            )}
          </div>
        ) : state === "error" ? (
          <div className="space-y-2">
            <div className="text-sm text-red-400 break-words">{errorMsg || "Transaction failed"}</div>
            <button
              onClick={handleRetry}
              className="w-full py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-medium transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <button
            onClick={handleExecute}
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-zinc-500 border-t-white animate-spin" />
                {state === "approving"
                  ? "Approving..."
                  : "Swapping..."}
              </span>
            ) : data.needsApproval ? (
              "Approve & Swap"
            ) : (
              "Execute Swap"
            )}
          </button>
        )}
      </div>
    </div>
  );
}
