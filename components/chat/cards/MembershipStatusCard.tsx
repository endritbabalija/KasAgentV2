import type { MembershipStatusResult } from "@/lib/ai/tool-types";
import { shortenAddress } from "./shared/ExecutionCardParts";

function formatDate(iso: string): string {
  if (iso === "N/A") return "N/A";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function MembershipStatusCard({ data }: { data: MembershipStatusResult }) {
  const { membership, nftStaking, nftStakingGlobals } = data;

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-zinc-500 uppercase tracking-wide">
          Discount & Membership Status
        </div>
        <span className="text-xs font-mono text-zinc-600">
          {shortenAddress(data.walletAddress)}
        </span>
      </div>

      {/* Section A — Discount Banner */}
      {data.discountEligible ? (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-emerald-900/30 border-emerald-800/50">
          <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <span className="text-sm font-medium text-emerald-400">Fee Discount Active</span>
            <span className="text-xs text-emerald-400/70 ml-1.5">
              (via {data.discountSource})
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-zinc-700/30 border-zinc-600/50">
          <svg className="w-4 h-4 text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <span className="text-sm text-zinc-400">No Fee Discount</span>
            <span className="text-xs text-zinc-500 ml-1.5">Standard 0.3% swap fee</span>
          </div>
        </div>
      )}

      {/* Section B — Membership */}
      <div className="text-xs text-zinc-500 font-medium uppercase tracking-wide mt-4 mb-2">
        Membership
      </div>
      <div className="border border-zinc-700/30 bg-zinc-900/30 rounded-lg p-3">
        <div className="grid grid-cols-2 gap-y-1.5 text-xs">
          <div className="text-zinc-500">Status</div>
          <div className="text-right">
            {membership.isActive ? (
              <span className="text-emerald-400 font-medium">Active</span>
            ) : (
              <span className="text-zinc-500">Inactive</span>
            )}
          </div>

          {membership.isActive && membership.isLifetime && (
            <>
              <div className="text-zinc-500">Tier</div>
              <div className="text-right">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-900/40 text-blue-400">
                  Lifetime
                </span>
              </div>
            </>
          )}

          {membership.isActive && !membership.isLifetime && (
            <>
              <div className="text-zinc-500">Expires</div>
              <div className="font-mono text-zinc-300 text-right">
                {formatDate(membership.expiresAt)}
              </div>
              <div className="text-zinc-500">Remaining</div>
              <div className="font-mono text-zinc-300 text-right">
                {membership.daysRemaining != null
                  ? `${membership.daysRemaining} day${membership.daysRemaining !== 1 ? "s" : ""}`
                  : "—"}
              </div>
            </>
          )}
        </div>

        {!membership.isActive && (
          <p className="text-[11px] text-zinc-600 mt-2">
            Purchase a membership with ZEAL tokens to get 33% off swap fees.
          </p>
        )}
      </div>

      {/* Section C — NFT Staking */}
      <div className="text-xs text-zinc-500 font-medium uppercase tracking-wide mt-4 mb-2">
        NFT Staking (NACHO KAT)
      </div>
      <div className="border border-zinc-700/30 bg-zinc-900/30 rounded-lg p-3">
        <div className="grid grid-cols-2 gap-y-1.5 text-xs">
          <div className="text-zinc-500">Staked NFTs</div>
          <div className={`font-mono text-right ${nftStaking.stakedNFTCount > 0 ? "text-zinc-300" : "text-zinc-600"}`}>
            {nftStaking.stakedNFTCount}
          </div>

          <div className="text-zinc-500">Power</div>
          <div className="text-right">
            <span className={`font-mono ${nftStaking.meetsMinPower ? "text-emerald-400" : "text-zinc-300"}`}>
              {nftStaking.totalPower}
            </span>
            <span className="text-zinc-600"> / {nftStaking.minRequiredPower}</span>
          </div>

          <div className="text-zinc-500">Staking Duration</div>
          <div className="text-right">
            {nftStaking.stakedNFTCount === 0 ? (
              <span className="text-zinc-600">—</span>
            ) : nftStaking.hasStakedRequiredDays ? (
              <span className="text-emerald-400">Qualified</span>
            ) : (
              <span className="text-yellow-400">
                Need {nftStaking.requiredStakingDays} day{nftStaking.requiredStakingDays !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="text-zinc-500">Discount Qualified</div>
          <div className="text-right">
            {nftStaking.isQualified ? (
              <span className="text-emerald-400 font-medium">Yes</span>
            ) : (
              <span className="text-zinc-500">No</span>
            )}
          </div>
        </div>

        <div className="text-[10px] text-zinc-600 mt-2.5 pt-2 border-t border-zinc-700/30">
          Network: {nftStakingGlobals.totalStakers} stakers · {nftStakingGlobals.totalNFTsStaked} NFTs staked · {nftStakingGlobals.totalPowerStaked} total power
        </div>
      </div>

      {/* Help note — only if not eligible for anything */}
      {!data.discountEligible && !membership.isActive && nftStaking.stakedNFTCount === 0 && (
        <div className="bg-zinc-700/20 border border-zinc-600/30 rounded-lg p-3 mt-4 text-xs text-zinc-500">
          To qualify for 33% off swap fees (0.2% instead of 0.3%), you can:
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            <li>Purchase a ZealousSwap Membership with ZEAL tokens</li>
            <li>Stake NACHO KAT NFTs with at least {nftStaking.minRequiredPower} power for {nftStaking.requiredStakingDays} day{nftStaking.requiredStakingDays !== 1 ? "s" : ""}</li>
          </ul>
        </div>
      )}
    </div>
  );
}
