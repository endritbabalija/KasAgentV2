"use client";

import { useState } from "react";
import { useAccount, useConfig, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { erc20Abi, infinityPoolZealAbi, infinityPoolNachoAbi, infinityPoolKasperAbi } from "@/config/abis";
import type { PrepareInfinityStakeResult } from "@/lib/ai/tool-types";
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

type InfinityStakeState = "idle" | "approving" | "staking" | "success" | "error" | "cancelled";

export function InfinityStakeCard({ data }: { data: PrepareInfinityStakeResult }) {
  const { isConnected } = useAccount();
  const config = useConfig();
  const [state, setState] = useState<InfinityStakeState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [txHash, setTxHash] = useState<string>();

  const { writeContractAsync: writeApproveAsync, reset: resetApprove } = useWriteContract();
  const { writeContractAsync: writeStakeAsync, reset: resetStake } = useWriteContract();

  async function handleExecute() {
    setErrorMsg("");
    try {
      // Approve token if needed
      if (data.needsApproval) {
        setState("approving");
        const approveHash = await writeApproveAsync({
          address: data.tx.tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [data.tx.pool as `0x${string}`, BigInt(data.tx.rawAmount)],
        });
        await waitForTransactionReceipt(config, { hash: approveHash });
      }

      // Stake
      setState("staking");
      const abi = poolAbis[data.token] ?? infinityPoolZealAbi;
      const hash = await writeStakeAsync({
        address: data.tx.pool as `0x${string}`,
        abi,
        functionName: "stake",
        args: [BigInt(data.tx.rawAmount)],
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
    resetApprove();
    resetStake();
  }

  const isLoading = state === "approving" || state === "staking";

  if (state === "cancelled") {
    return <CancelledState label="InfinityPool Stake" />;
  }

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">InfinityPool Stake</div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <TokenBadge symbol={data.token} />
          <span className="font-mono text-teal-400 text-lg">{formatAmount(data.amount)}</span>
        </div>
        <span className="text-zinc-500 text-lg">&rarr;</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold bg-zinc-700/50 text-zinc-300 px-2 py-0.5 rounded">
            x{data.token}
          </span>
          <span className="font-mono text-teal-400 text-lg">{formatAmount(data.xTokensReceived)}</span>
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
          <div className="text-sm text-zinc-500 text-center py-2">Connect your wallet to stake</div>
        ) : state === "success" ? (
          <SuccessState message={`${data.token} staked! You received x${data.token}.`} txHash={txHash} />
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
                  {state === "approving" ? `Approving ${data.token}...` : "Staking..."}
                </span>
              ) : data.needsApproval ? (
                `Approve & Stake ${data.token}`
              ) : (
                `Stake ${data.token}`
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
