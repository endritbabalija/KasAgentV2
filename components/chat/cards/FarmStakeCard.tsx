"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { masterchefAbi, erc20Abi } from "@/config/abis";
import type { PrepareFarmStakeResult } from "@/lib/ai/tool-types";
import {
  formatAmount,
  RiskFlagList,
  ContractInfoAccordion,
  SuccessState,
  ErrorState,
  CancelledState,
  DetailRow,
} from "./shared/ExecutionCardParts";

type FarmStakeState = "idle" | "approving" | "depositing" | "success" | "error" | "cancelled";

export function FarmStakeCard({ data }: { data: PrepareFarmStakeResult }) {
  const { isConnected } = useAccount();
  const [state, setState] = useState<FarmStakeState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const {
    writeContract: writeApprove,
    data: approveTxHash,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();

  const {
    writeContract: writeDeposit,
    data: depositTxHash,
    error: depositError,
    reset: resetDeposit,
  } = useWriteContract();

  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isSuccess: depositConfirmed } = useWaitForTransactionReceipt({ hash: depositTxHash });

  useEffect(() => {
    if (approveConfirmed && state === "approving") {
      executeDeposit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveConfirmed]);

  useEffect(() => {
    if (depositConfirmed && state === "depositing") {
      setState("success");
    }
  }, [depositConfirmed, state]);

  useEffect(() => {
    if (approveError) { setState("error"); setErrorMsg(approveError.message.split("\n")[0]); }
  }, [approveError]);
  useEffect(() => {
    if (depositError) { setState("error"); setErrorMsg(depositError.message.split("\n")[0]); }
  }, [depositError]);

  function executeDeposit() {
    setState("depositing");
    writeDeposit({
      address: data.tx.masterChef as `0x${string}`,
      abi: masterchefAbi,
      functionName: "deposit",
      args: [BigInt(data.tx.pid), BigInt(data.tx.rawAmount)],
    });
  }

  function handleExecute() {
    setErrorMsg("");
    if (data.needsApproval) {
      setState("approving");
      writeApprove({
        address: data.tx.lpToken as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [data.tx.masterChef as `0x${string}`, BigInt(data.tx.rawAmount)],
      });
    } else {
      executeDeposit();
    }
  }

  function handleRetry() {
    setState("idle");
    setErrorMsg("");
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

      <div className="mt-4">
        {!isConnected ? (
          <div className="text-sm text-zinc-500 text-center py-2">Connect your wallet to stake</div>
        ) : state === "success" ? (
          <SuccessState message="LP tokens staked!" txHash={depositTxHash} />
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
                  {state === "approving" ? "Approving LP..." : "Depositing..."}
                </span>
              ) : data.needsApproval ? (
                "Approve & Stake"
              ) : (
                "Stake LP"
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
