"use client";

interface Suggestion {
  title: string;
  subtitle: string;
}

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { title: "How do I get started?", subtitle: "onboarding" },
  { title: "What tokens are available?", subtitle: "discovery" },
  { title: "How does staking work?", subtitle: "education" },
  { title: "What yield opportunities exist?", subtitle: "explore" },
  { title: "How do swaps work?", subtitle: "learn" },
];

const POSITION_SUGGESTIONS: Suggestion[] = [
  { title: "How are my LP positions doing?", subtitle: "track returns" },
  { title: "Check my pending farm rewards", subtitle: "claim earnings" },
  { title: "Optimize my DeFi positions", subtitle: "AI strategy planner" },
  { title: "What are the best swap routes?", subtitle: "trading" },
  { title: "Show my portfolio summary", subtitle: "full overview" },
];

const BALANCE_ONLY_SUGGESTIONS: Suggestion[] = [
  { title: "Show my portfolio summary", subtitle: "see what you have" },
  { title: "Find the best yield opportunities", subtitle: "put tokens to work" },
  { title: "What are the best swap routes?", subtitle: "trading" },
  { title: "Put my tokens to work", subtitle: "AI strategy planner" },
  { title: "What pools can I provide liquidity to?", subtitle: "LP discovery" },
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
    <div className="px-3 sm:px-4 pb-2">
      <div className="flex gap-3 max-w-3xl mx-auto overflow-x-auto scrollbar-none">
        {suggestions.map((s) => (
          <button
            key={s.title}
            onClick={() => onSuggestionClick(s.title)}
            className="shrink-0 text-left px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-2xl hover:bg-zinc-800 hover:border-zinc-600 transition-colors"
          >
            <span className="block text-sm font-medium text-zinc-200 whitespace-nowrap">{s.title}</span>
            <span className="block text-xs text-zinc-500 whitespace-nowrap">{s.subtitle}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
