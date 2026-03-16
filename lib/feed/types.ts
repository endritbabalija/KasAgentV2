export interface FeedInsight {
  id: string;
  type: "idle-capital" | "harvest-reminder" | "better-yield" | "market-move" | "new-opportunity";
  priority: number; // 0-100
  title: string;
  description: string;
  actionPrompt: string; // sent as chat message on tap
  tokens: string[]; // for badge display
  metrics?: Record<string, string>;
}
