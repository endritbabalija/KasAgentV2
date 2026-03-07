"use client";

import { useState } from "react";
import { useAccount, useConfig, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { erc20Abi, infinityPoolZealAbi, infinityPoolNachoAbi, infinityPoolKasperAbi } from "@/config/abis";
import type { PrepareInfinityUnstakeResult } from "@/lib/ai/tool-types";
import {
  TokenBadge,
  formatAmount,
  RiskFlagList,
  ContractInfoAccordion,
  ActionArea,
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
  const config = useConfig();
  const [state, setState] = useState<InfinityUnstakeState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [txHash, setTxHash] = useState<string>();

  const { writeContractAsync: writeApproveAsync, reset: resetApprove } = useWriteContract();
  const { writeContractAsync: writeUnstakeAsync, reset: resetUnstake } = useWriteContract();

  async function handleExecute() {
    setErrorMsg("");
    try {
      // Approve x-token if needed
      if (data.needsApproval) {
        setState("approving");
        const approveHash = await writeApproveAsync({
          address: data.tx.xTokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [data.tx.pool as `0x${string}`, BigInt(data.tx.rawXAmount)],
        });
        await waitForTransactionReceipt(config, { hash: approveHash });
      }

      // Unstake
      setState("unstaking");
      const abi = poolAbis[data.token] ?? infinityPoolZealAbi;
      const hash = await writeUnstakeAsync({
        address: data.tx.pool as `0x${string}`,
        abi,
        functionName: "unstake",
        args: [BigInt(data.tx.rawXAmount)],
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
        successMessage={`Unstaked! You received ${data.token}.`}
        buttonLabel={data.needsApproval ? `Approve & Unstake x${data.token}` : `Unstake x${data.token}`}
        loadingLabel={state === "approving" ? `Approving x${data.token}...` : "Unstaking..."}
      />
    </div>
  );
}
