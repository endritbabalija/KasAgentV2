export function ToolErrorCard({ error, toolName }: { error: string; toolName: string }) {
  return (
    <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4">
      <div className="flex items-center gap-2 text-red-400 text-sm font-medium mb-1">
        <span>&#x26A0;</span>
        <span>{toolName} error</span>
      </div>
      <p className="text-red-300/80 text-sm">{error}</p>
    </div>
  );
}
