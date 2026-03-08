import { formatUnits } from "viem";
import { z } from "zod";
import { tool } from "ai";
import { CONTRACTS } from "@/config/contracts";
import { EXPLORER_URL } from "@/config/chains";
import { getAllTokens } from "@/lib/token-registry";
import { serverEnv } from "@/lib/env";
import type { TransactionHistoryItem, TokenTransferInfo } from "../tool-types";

const BLOCKSCOUT_API = serverEnv.EXPLORER_API_URL;

// Method selector -> human-readable action label
const METHOD_SELECTORS: Record<string, string> = {
  // Router
  "0x7ff36ab5": "Swap",
  "0x38ed1739": "Swap",
  "0x8803dbee": "Swap",
  "0xfb3bdb41": "Swap",
  "0x18cbafe5": "Swap",
  "0x4a25d94a": "Swap",
  "0x5c11d795": "Swap",
  "0xb6f9de95": "Swap",
  // Add liquidity
  "0xe8e33700": "Add Liquidity",
  "0xf305d719": "Add Liquidity",
  // Remove liquidity
  "0xbaa2abde": "Remove Liquidity",
  "0x02751cec": "Remove Liquidity",
  "0xaf2979eb": "Remove Liquidity",
  "0xded9382a": "Remove Liquidity",
  // MasterChef
  "0xe2bbb158": "Farm Deposit",
  "0x441a3e70": "Farm Withdraw",
  "0xe7a03679": "Farm Emergency Withdraw",
  // InfinityPool
  "0xa694fc3a": "Stake",
  "0x2e1a7d4d": "Unstake",
  // ERC20
  "0x095ea7b3": "Approve",
  "0xa9059cbb": "Transfer",
  "0x23b872dd": "Transfer",
};

// Contract address -> label
const KNOWN_CONTRACTS: Record<string, string> = {
  [CONTRACTS.ROUTER.toLowerCase()]: "ZealousSwap Router",
  [CONTRACTS.FACTORY.toLowerCase()]: "ZealousSwap Factory",
  [CONTRACTS.MASTER_CHEF.toLowerCase()]: "MasterChef",
  [CONTRACTS.INFINITY_POOL_ZEAL.toLowerCase()]: "ZEAL InfinityPool",
  [CONTRACTS.INFINITY_POOL_NACHO.toLowerCase()]: "NACHO InfinityPool",
  [CONTRACTS.INFINITY_POOL_KASPER.toLowerCase()]: "KASPER InfinityPool",
  [CONTRACTS.WKAS.toLowerCase()]: "WKAS",
};

export const historyTools = {
  getTransactionHistory: tool({
    description:
      "Fetch the user's recent transaction history from the Kasplex L2 block explorer. Returns labeled, enriched transactions with token transfers. Use when the user asks about their recent transactions, activity, or history.",
    inputSchema: z.object({
      walletAddress: z
        .string()
        .describe("The user's wallet address (0x...)"),
    }),
    execute: async ({ walletAddress }) => {
      try {
        // Build token address map dynamically from discovered tokens
        const allTokens = await getAllTokens();
        const tokenAddresses: Record<string, string> = {};
        for (const t of allTokens) {
          if (t.address) tokenAddresses[t.address.toLowerCase()] = t.symbol;
        }

        const addr = walletAddress.toLowerCase();

        // Fetch transactions and token transfers in parallel
        const [txResponse, transfersResponse] = await Promise.allSettled([
          fetch(`${BLOCKSCOUT_API}/addresses/${addr}/transactions`),
          fetch(`${BLOCKSCOUT_API}/addresses/${addr}/token-transfers`),
        ]);

        if (txResponse.status === "rejected" || !txResponse.value.ok) {
          return {
            transactions: [],
            address: walletAddress,
            explorerUrl: `${EXPLORER_URL}/address/${walletAddress}`,
            fetchedAt: new Date().toISOString(),
            hasMore: false,
            error: "Failed to fetch transactions from explorer",
          };
        }

        const txData = await txResponse.value.json();
        const txItems = txData.items ?? [];

        // Token transfers (non-critical)
        let tokenTransferItems: unknown[] = [];
        if (transfersResponse.status === "fulfilled" && transfersResponse.value.ok) {
          const transferData = await transfersResponse.value.json();
          tokenTransferItems = transferData.items ?? [];
        }

        // Group token transfers by transaction hash
        const transfersByHash = new Map<string, TokenTransferInfo[]>();
        for (const tr of tokenTransferItems as Record<string, unknown>[]) {
          const txHash = (tr.transaction_hash as string) ?? "";
          if (!txHash) continue;

          const token = tr.token as Record<string, unknown> | undefined;
          const tokenSymbol =
            tokenAddresses[(token?.address as string)?.toLowerCase() ?? ""] ??
            (token?.symbol as string) ??
            "???";
          const decimals = Number(token?.decimals ?? 18);
          const rawAmount = ((tr.total as Record<string, unknown>)?.value as string) ?? "0";

          const info: TokenTransferInfo = {
            token: tokenSymbol,
            from: ((tr.from as Record<string, unknown>)?.hash as string) ?? "",
            to: ((tr.to as Record<string, unknown>)?.hash as string) ?? "",
            amount: formatUnits(BigInt(rawAmount), decimals),
            decimals,
          };

          const existing = transfersByHash.get(txHash);
          if (existing) {
            existing.push(info);
          } else {
            transfersByHash.set(txHash, [info]);
          }
        }

        // Build enriched transaction list
        const transactions: TransactionHistoryItem[] = txItems.map(
          (tx: Record<string, unknown>) => {
            const hash = tx.hash as string;
            const method = (tx.method as string) ?? "";
            const toObj = tx.to as Record<string, unknown> | null;
            const toAddr = (toObj?.hash as string) ?? "";

            // Resolve action label
            let action = "Contract Call";
            if (method && METHOD_SELECTORS[method]) {
              action = METHOD_SELECTORS[method];
            } else if (!toObj || !toAddr) {
              action = "Contract Create";
            } else if (
              (tx.value as string) !== "0" &&
              (!method || method === "0x")
            ) {
              action = "Transfer";
            }

            // Resolve contract label
            const toLabel = KNOWN_CONTRACTS[toAddr.toLowerCase()] ?? null;

            // Format KAS value and fee
            const rawValue = (tx.value as string) ?? "0";
            const value = formatUnits(BigInt(rawValue), 18);
            const rawFee = ((tx.fee as Record<string, unknown>)?.value as string) ?? (tx.gas_used as string) ?? "0";
            let fee: string;
            try {
              fee = formatUnits(BigInt(rawFee), 18);
            } catch {
              fee = "0";
            }

            // Status
            let status = "confirmed";
            if (tx.status === "error" || tx.result === "error" || tx.revert_reason) {
              status = "failed";
            } else if (tx.status === "pending") {
              status = "pending";
            }

            return {
              hash,
              action,
              status,
              from: ((tx.from as Record<string, unknown>)?.hash as string) ?? "",
              to: toAddr,
              toLabel,
              value,
              fee,
              timestamp: (tx.timestamp as string) ?? "",
              blockNumber: Number(tx.block_number ?? 0),
              tokenTransfers: transfersByHash.get(hash) ?? [],
            };
          }
        );

        const hasMore = !!txData.next_page_params;

        return {
          transactions,
          address: walletAddress,
          explorerUrl: `${EXPLORER_URL}/address/${walletAddress}`,
          fetchedAt: new Date().toISOString(),
          hasMore,
        };
      } catch (e) {
        return {
          transactions: [],
          address: walletAddress,
          explorerUrl: `${EXPLORER_URL}/address/${walletAddress}`,
          fetchedAt: new Date().toISOString(),
          hasMore: false,
          error: `Failed to fetch transaction history: ${e instanceof Error ? e.message : "Unknown error"}`,
        };
      }
    },
  }),
};
