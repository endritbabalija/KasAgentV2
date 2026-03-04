"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { erc20Abi, infinityPoolZealAbi, infinityPoolNachoAbi, infinityPoolKasperAbi } from "@/config/abis";
import type { PrepareInfinityUnstakeResult } from "@/lib/ai/tool-types";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const poolAbis: Record<string, any> = {
  ZEAL: infinityPoolZealAbi,
  NACHO: infinityPoolNachoAbi,
  KASPER: infinityPoolKasperAbi,
};

type InfinityUnstakeState = "idle" | "approving" | "unstaking" | "success" | "error" | "cancelled";

export function InfinityUnstakeCard({ data }: { data: PrepareInfinityUnstakeResult }) {
  const { isConnected } = useAccount();
  const [state, setState] = useState<InfinityUnstakeState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const {
    writeContract: writeApprove,
    data: approveTxHash,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();

  const {
    writeContract: writeUnstake,
    data: unstakeTxHash,
    error: unstakeError,
    reset: resetUnstake,
  } = useWriteContract();

  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isSuccess: unstakeConfirmed } = useWaitForTransactionReceipt({ hash: unstakeTxHash });

  useEffect(() => {
    if (approveConfirmed && state === "approving") {
      executeUnstake();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveConfirmed]);

  useEffect(() => {
    if (unstakeConfirmed && state === "unstaking") {
      setState("success");
    }
  }, [unstakeConfirmed, state]);

  useEffect(() => {
    if (approveError) { setState("error"); setErrorMsg(approveError.message.split("\n")[0]); }
  }, [approveError]);
  useEffect(() => {
    if (unstakeError) { setState("error"); setErrorMsg(unstakeError.message.split("\n")[0]); }
  }, [unstakeError]);

  function executeUnstake() {
    setState("unstaking");
    const abi = poolAbis[data.token] ?? infinityPoolZealAbi;
    writeUnstake({
      address: data.tx.pool as `0x${string}`,
      abi,
      functionName: "unstake",
      args: [BigInt(data.tx.rawXAmount)],
    });
  }

  function handleExecute() {
    setErrorMsg("");
    if (data.needsApproval) {
      setState("approving");
      writeApprove({
        address: data.tx.xTokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [data.tx.pool as `0x${string}`, BigInt(data.tx.rawXAmount)],
      });
    } else {
      executeUnstake();
    }
  }

  function handleRetry() {
    setState("idle");
    setErrorMsg("");
    resetApprove();
    resetUnstake();
  }

  const isLoading = state === "approving" || state === "unstaking";

  if (state === "cancelled") {
    return <CancelledState label="InfinityPool Unstake" />;
  }

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">InfinityPool Unstake</div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold bg-zinc-700/50 text-zinc-300 px-2 py-0.5 rounded">
            x{data.token}
          </span>
          <span className="font-mono text-teal-400 text-lg">{formatAmount(data.xAmount)}</span>
        </div>
        <span className="text-zinc-500 text-lg">&rarr;</span>
        <div className="flex items-center gap-2">
          <TokenBadge symbol={data.token} />
          <span className="font-mono text-teal-400 text-lg">{formatAmount(data.tokensReceived)}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <DetailRow label="Exchange Rate" value={`1 x${data.token} = ${formatAmount(data.exchangeRate)} ${data.token}`} />
        <DetailRow label="Total Staked" value={`${formatAmount(data.totalStaked)} ${data.token}`} />
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
          <div className="text-sm text-zinc-500 text-center py-2">Connect your wallet to unstake</div>
        ) : state === "success" ? (
          <SuccessState message={`Unstaked! You received ${data.token}.`} txHash={unstakeTxHash} />
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
                  {state === "approving" ? `Approving x${data.token}...` : "Unstaking..."}
                </span>
              ) : data.needsApproval ? (
                `Approve & Unstake x${data.token}`
              ) : (
                `Unstake x${data.token}`
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
