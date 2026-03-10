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
  ActionArea,
  CancelledState,
  DetailRow,
} from "./shared/ExecutionCardParts";
import { useExecutionState, type ExecutionRecord } from "../ExecutionStateContext";

type AddLiquidityState =
  | "idle"
  | "approving-a"
  | "approving-b"
  | "adding"
  | "success"
  | "error"
  | "cancelled";

export function AddLiquidityCard({ data, toolCallId, executionState }: { data: PrepareAddLiquidityResult; toolCallId?: string; executionState?: ExecutionRecord }) {
  const { address, isConnected } = useAccount();
  const config = useConfig();
  const { markExecuted } = useExecutionState();
  const [state, setState] = useState<AddLiquidityState>((executionState?.state as AddLiquidityState) ?? "idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [txHash, setTxHash] = useState<string | undefined>(executionState?.txHash);

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

      <ActionArea
        isConnected={isConnected}
        state={state}
        isLoading={isLoading}
        txHash={txHash}
        errorMsg={errorMsg}
        onExecute={handleExecute}
        onRetry={handleRetry}
        onCancel={() => { setState("cancelled"); if (toolCallId) markExecuted(toolCallId, "cancelled"); }}
        walletMessage="Connect your wallet to add liquidity"
        successMessage="Liquidity added!"
        buttonLabel={buttonLabel}
        loadingLabel={loadingText}
      />
    </div>
  );
}
