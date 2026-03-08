"use client";

interface Suggestion {
  title: string;
  subtitle: string;
  prompt: string;
}

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { title: "Explore tokens", subtitle: "on Kasplex L2", prompt: "What can I do with my tokens?" },
  { title: "Find yield", subtitle: "best opportunities", prompt: "Find the best yield opportunities" },
  { title: "Portfolio overview", subtitle: "balances & positions", prompt: "Show me my portfolio summary" },
  { title: "Learn staking", subtitle: "how it works", prompt: "How does staking work on ZealousSwap?" },
  { title: "Swap tokens", subtitle: "find best routes", prompt: "What are the best swap routes?" },
];

const POSITION_SUGGESTIONS: Suggestion[] = [
  { title: "LP positions", subtitle: "check performance", prompt: "How are my LP positions doing?" },
  { title: "Farm rewards", subtitle: "pending earnings", prompt: "Check my pending farm rewards" },
  { title: "Find yield", subtitle: "best opportunities", prompt: "Find the best yield opportunities" },
  { title: "Portfolio overview", subtitle: "balances & positions", prompt: "Show me my portfolio summary" },
  { title: "Swap tokens", subtitle: "find best routes", prompt: "What are the best swap routes?" },
];

const BALANCE_ONLY_SUGGESTIONS: Suggestion[] = [
  { title: "Explore tokens", subtitle: "on Kasplex L2", prompt: "What can I do with my tokens?" },
  { title: "Find yield", subtitle: "best opportunities", prompt: "Find the best yield opportunities" },
  { title: "Portfolio overview", subtitle: "balances & positions", prompt: "Show me my portfolio summary" },
  { title: "Swap tokens", subtitle: "find best routes", prompt: "What are the best swap routes?" },
  { title: "Learn staking", subtitle: "how it works", prompt: "How does staking work on ZealousSwap?" },
];

function getSuggestions(hasBalances: boolean, hasPositions: boolean): Suggestion[] {
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
  if (!isConnected) return null;

  const suggestions = getSuggestions(hasBalances, hasPositions);

  return (
    <div className="overflow-x-auto px-3 sm:px-4 pb-2 scrollbar-none">
      <div className="flex gap-3 max-w-3xl mx-auto">
        {suggestions.map((s) => (
          <button
            key={s.prompt}
            onClick={() => onSuggestionClick(s.prompt)}
            className="shrink-0 w-[calc(50%-6px)] sm:w-auto sm:flex-1 sm:min-w-0 text-left px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-2xl hover:bg-zinc-800 hover:border-zinc-600 transition-colors"
          >
            <span className="block text-sm font-medium text-zinc-200 truncate">{s.title}</span>
            <span className="block text-xs text-zinc-500 truncate">{s.subtitle}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
