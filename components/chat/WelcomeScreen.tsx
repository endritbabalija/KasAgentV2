"use client";

const DEFAULT_SUGGESTIONS = [
  "What can I do with my tokens?",
  "Find the best yield opportunities",
  "Show me my portfolio summary",
  "How does staking work on ZealousSwap?",
];

const POSITION_SUGGESTIONS = [
  "How are my LP positions doing?",
  "Check my pending farm rewards",
  "Find the best yield opportunities",
  "Show me my portfolio summary",
];

const BALANCE_ONLY_SUGGESTIONS = [
  "What can I do with my tokens?",
  "Find the best yield opportunities",
  "Show me my portfolio summary",
  "What are the best swap routes?",
];

function getSuggestions(hasBalances: boolean, hasPositions: boolean): string[] {
  if (hasPositions) return POSITION_SUGGESTIONS;
  if (hasBalances) return BALANCE_ONLY_SUGGESTIONS;
  return DEFAULT_SUGGESTIONS;
}

interface WelcomeScreenProps {
  isConnected: boolean;
  onSuggestionClick: (suggestion: string) => void;
  hasBalances?: boolean;
  hasPositions?: boolean;
}

export function WelcomeScreen({
  isConnected,
  onSuggestionClick,
  hasBalances = false,
  hasPositions = false,
}: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-zinc-100">KasAgent</h2>
        <p className="text-zinc-400">
          AI-powered DeFi copilot for Kasplex L2
        </p>
      </div>

      {isConnected ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full px-2 sm:px-0">
          {getSuggestions(hasBalances, hasPositions).map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => onSuggestionClick(suggestion)}
              className="text-left px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-sm text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-zinc-500 text-sm">
          Connect your wallet to start chatting
        </p>
      )}
    </div>
  );
}
