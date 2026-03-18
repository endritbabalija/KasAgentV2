"use client";

import type { RiskFlag, ContractInfo } from "@/lib/ai/tool-types";
import type { ExecutionRecord } from "@/components/chat/ExecutionStateContext";
import type { ExecutionStep } from "@/hooks/useCardExecution";
import { useAccount } from "wagmi";
import { useCardExecution } from "@/hooks/useCardExecution";
import { RiskFlagList, ContractInfoAccordion, ActionArea, CancelledState } from "./ExecutionCardParts";
import { CardWrapper } from "./CardWrapper";

export interface ExecutionCardLayoutProps {
  title: string;
  titleExtra?: React.ReactNode;
  cancelledLabel: string;
  riskFlags: RiskFlag[];
  contractInfo?: ContractInfo;
  steps: ExecutionStep[];
  toolCallId?: string;
  executionState?: ExecutionRecord;
  walletMessage: string;
  successMessage: string;
  buttonLabel: string;
  children: React.ReactNode;
  details: React.ReactNode;
}

export function ExecutionCardLayout({
  title, titleExtra, cancelledLabel,
  riskFlags, contractInfo,
  steps, toolCallId, executionState,
  walletMessage, successMessage, buttonLabel,
  children, details,
}: ExecutionCardLayoutProps) {
  const { isConnected } = useAccount();
  const { status, currentStepLabel, isLoading, errorMsg, txHash, handleExecute, handleRetry, handleCancel } =
    useCardExecution({ steps, toolCallId, executionState });

  if (status === "cancelled") return <CancelledState label={cancelledLabel} />;

  return (
    <CardWrapper>
      {titleExtra ? (
        <div className="flex items-center gap-2 mb-3">
          <div className="text-xs text-zinc-500 uppercase tracking-wide">{title}</div>
          {titleExtra}
        </div>
      ) : (
        <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">{title}</div>
      )}

      {children}

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {details}
      </div>

      <div className="mt-3">
        <RiskFlagList flags={riskFlags} />
      </div>

      {contractInfo && (
        <div className="mt-3">
          <ContractInfoAccordion info={contractInfo} />
        </div>
      )}

      <ActionArea
        isConnected={isConnected}
        state={status}
        isLoading={isLoading}
        txHash={txHash}
        errorMsg={errorMsg}
        onExecute={handleExecute}
        onRetry={handleRetry}
        onCancel={handleCancel}
        walletMessage={walletMessage}
        successMessage={successMessage}
        buttonLabel={buttonLabel}
        loadingLabel={currentStepLabel}
      />
    </CardWrapper>
  );
}
