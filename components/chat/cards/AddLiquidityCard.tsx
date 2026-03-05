"use client";

import { useState } from "react";
import { useAccount, useConfig, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { routerAbi, erc20Abi } from "@/config/abis";
import type { PrepareAddLiquidityResult } from "@/lib/ai/tool-types";
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

type AddLiquidityState =
  | "idle"
  | "approving-a"
  | "approving-b"
  | "adding"
  | "success"
  | "error"
  | "cancelled";

export function AddLiquidityCard({ data }: { data: PrepareAddLiquidityResult }) {
  const { address, isConnected } = useAccount();
  const config = useConfig();
  const [state, setState] = useState<AddLiquidityState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [txHash, setTxHash] = useState<string>();

  const { writeContractAsync: writeApproveAAsync, reset: resetApproveA } = useWriteContract();
  const { writeContractAsync: writeApproveBAsync, reset: resetApproveB } = useWriteContract();
  const { writeContractAsync: writeAddAsync, reset: resetAdd } = useWriteContract();

  async function handleExecute() {
    setErrorMsg("");
    try {
      // Approve token A if needed
      if (data.needsApprovalA) {
        setState("approving-a");
        const hashA = await writeApproveAAsync({
          address: data.tx.tokenAAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [data.tx.router as `0x${string}`, BigInt(data.tx.rawAmountADesired)],
        });
        await waitForTransactionReceipt(config, { hash: hashA });
      }

      // Approve token B if needed
      if (data.needsApprovalB) {
        setState("approving-b");
        const hashB = await writeApproveBAsync({
          address: data.tx.tokenBAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [data.tx.router as `0x${string}`, BigInt(data.tx.rawAmountBDesired)],
        });
        await waitForTransactionReceipt(config, { hash: hashB });
      }

      // Add liquidity
      const { tx, liquidityType } = data;
      const deadline = BigInt(tx.deadline);
      setState("adding");

      let hash: `0x${string}`;
      if (liquidityType === "KAS_TOKEN") {
        const isANative = data.tokenA.toUpperCase() === "KAS";
        const tokenAddr = isANative ? tx.tokenBAddress : tx.tokenAAddress;
        const amountTokenDesired = BigInt(isANative ? tx.rawAmountBDesired : tx.rawAmountADesired);
        const amountTokenMin = BigInt(isANative ? tx.rawAmountBMin : tx.rawAmountAMin);
        const amountKASMin = BigInt(isANative ? tx.rawAmountAMin : tx.rawAmountBMin);

        hash = await writeAddAsync({
          address: tx.router as `0x${string}`,
          abi: routerAbi,
          functionName: "addLiquidityKAS",
          args: [tokenAddr as `0x${string}`, amountTokenDesired, amountTokenMin, amountKASMin, address!, deadline],
          value: BigInt(tx.value),
        });
      } else {
        hash = await writeAddAsync({
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
    resetApproveA();
    resetApproveB();
    resetAdd();
  }

  const isLoading = state === "approving-a" || state === "approving-b" || state === "adding";
  const loadingText =
    state === "approving-a"
      ? `Approving ${data.tokenA}...`
      : state === "approving-b"
        ? `Approving ${data.tokenB}...`
        : "Adding liquidity...";

  if (state === "cancelled") {
    return <CancelledState label="Add Liquidity" />;
  }

  const needsAnyApproval = data.needsApprovalA || data.needsApprovalB;
  const buttonLabel = needsAnyApproval ? "Approve & Add Liquidity" : "Add Liquidity";

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Add Liquidity</div>

      {/* Token amounts */}
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

      {/* Details grid */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <DetailRow label="Est. LP Tokens" value={data.estimatedLpTokens === "first deposit" ? "First deposit" : formatAmount(data.estimatedLpTokens)} />
        <DetailRow label="Pool Share" value={`${data.poolShare}%`} />
        <DetailRow label="Gas Fee" value={`~${formatAmount(data.gasEstimate)} KAS`} />
        <DetailRow label="Slippage" value={`${data.slippage}%`} />
      </div>

      {/* Risk flags */}
      <div className="mt-3">
        <RiskFlagList flags={data.riskFlags} />
      </div>

      {/* Contract info */}
      {data.contractInfo && (
        <div className="mt-3">
          <ContractInfoAccordion info={data.contractInfo} />
        </div>
      )}

      {/* Action area */}
      <div className="mt-4">
        {!isConnected ? (
          <div className="text-sm text-zinc-500 text-center py-2">Connect your wallet to add liquidity</div>
        ) : state === "success" ? (
          <SuccessState message="Liquidity added!" txHash={txHash} />
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
                  {loadingText}
                </span>
              ) : (
                buttonLabel
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
