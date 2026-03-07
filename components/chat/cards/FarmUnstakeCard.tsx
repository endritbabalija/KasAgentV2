"use client";

import { useState } from "react";
import { useAccount, useConfig, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { masterchefAbi } from "@/config/abis";
import type { PrepareFarmUnstakeResult } from "@/lib/ai/tool-types";
import {
  formatAmount,
  RiskFlagList,
  ContractInfoAccordion,
  ActionArea,
  CancelledState,
  DetailRow,
} from "./shared/ExecutionCardParts";

type FarmUnstakeState = "idle" | "withdrawing" | "success" | "error" | "cancelled";

export function FarmUnstakeCard({ data }: { data: PrepareFarmUnstakeResult }) {
  const { isConnected } = useAccount();
  const config = useConfig();
  const [state, setState] = useState<FarmUnstakeState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [txHash, setTxHash] = useState<string>();

  const { writeContractAsync: writeWithdrawAsync, reset: resetWithdraw } = useWriteContract();

  async function handleExecute() {
    setErrorMsg("");
    try {
      setState("withdrawing");
      const hash = await writeWithdrawAsync({
        address: data.tx.masterChef as `0x${string}`,
        abi: masterchefAbi,
        functionName: "withdraw",
        args: [BigInt(data.tx.pid), BigInt(data.tx.rawAmount)],
      });

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
    resetWithdraw();
  }

  const isLoading = state === "withdrawing";

  if (state === "cancelled") {
    return <CancelledState label="Farm Unstake" />;
  }

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Farm Unstake — Pool {data.pid}</div>

      <div className="text-sm text-zinc-300 mb-1">
        Withdrawing <span className="font-mono text-teal-400">{formatAmount(data.amount)}</span>{" "}
        <span className="text-zinc-400">{data.lpTokenSymbol}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <DetailRow label="Pending Rewards" value={`${formatAmount(data.pendingRewards)} ${data.rewardToken}`} />
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
        onCancel={() => setState("cancelled")}
        walletMessage="Connect your wallet to unstake"
        successMessage="LP tokens unstaked! Rewards claimed."
        buttonLabel="Unstake LP"
        loadingLabel="Withdrawing..."
      />
    </div>
  );
}
