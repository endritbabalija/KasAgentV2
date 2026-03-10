"use client";

import { useState } from "react";
import { useAccount, useConfig, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { masterchefAbi, erc20Abi } from "@/config/abis";
import type { PrepareFarmStakeResult } from "@/lib/ai/tool-types";
import {
  formatAmount,
  RiskFlagList,
  ContractInfoAccordion,
  ActionArea,
  CancelledState,
  DetailRow,
} from "./shared/ExecutionCardParts";
import { useExecutionState, type ExecutionRecord } from "../ExecutionStateContext";

type FarmStakeState = "idle" | "approving" | "depositing" | "success" | "error" | "cancelled";

export function FarmStakeCard({ data, toolCallId, executionState }: { data: PrepareFarmStakeResult; toolCallId?: string; executionState?: ExecutionRecord }) {
  const { isConnected } = useAccount();
  const config = useConfig();
  const { markExecuted } = useExecutionState();
  const [state, setState] = useState<FarmStakeState>((executionState?.state as FarmStakeState) ?? "idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [txHash, setTxHash] = useState<string | undefined>(executionState?.txHash);

  const { writeContractAsync: writeApproveAsync, reset: resetApprove } = useWriteContract();
  const { writeContractAsync: writeDepositAsync, reset: resetDeposit } = useWriteContract();

  async function handleExecute() {
    setErrorMsg("");
    try {
      // Approve LP token if needed
      if (data.needsApproval) {
        setState("approving");
        const approveHash = await writeApproveAsync({
          address: data.tx.lpToken as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [data.tx.masterChef as `0x${string}`, BigInt(data.tx.rawAmount)],
        });
        await waitForTransactionReceipt(config, { hash: approveHash });
      }

      // Deposit
      setState("depositing");
      const hash = await writeDepositAsync({
        address: data.tx.masterChef as `0x${string}`,
        abi: masterchefAbi,
        functionName: "deposit",
        args: [BigInt(data.tx.pid), BigInt(data.tx.rawAmount)],
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
    resetApprove();
    resetDeposit();
  }

  const isLoading = state === "approving" || state === "depositing";

  if (state === "cancelled") {
    return <CancelledState label="Farm Stake" />;
  }

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Farm Stake — Pool {data.pid}</div>

      <div className="text-sm text-zinc-300 mb-1">
        Staking <span className="font-mono text-teal-400">{formatAmount(data.amount)}</span>{" "}
        <span className="text-zinc-400">{data.lpTokenSymbol}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <DetailRow label="Existing Stake" value={`${formatAmount(data.existingStake)} LP`} />
        <DetailRow label="Pending Rewards" value={`${formatAmount(data.pendingRewards)} ${data.rewardToken}`} />
        <DetailRow label="Locking Period" value={data.lockingPeriod} />
        <DetailRow label="Gas Fee" value={`~${formatAmount(data.gasEstimate)} KAS`} />
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
        walletMessage="Connect your wallet to stake"
        successMessage="LP tokens staked!"
        buttonLabel={data.needsApproval ? "Approve & Stake" : "Stake LP"}
        loadingLabel={state === "approving" ? "Approving LP..." : "Depositing..."}
      />
    </div>
  );
}
