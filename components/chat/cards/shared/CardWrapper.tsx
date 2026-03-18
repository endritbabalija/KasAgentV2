export function CardWrapper({
  children,
  compact = false,
  className,
}: {
  children: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`bg-zinc-800/80 border border-zinc-700/50 rounded-xl ${compact ? "px-4 py-3" : "p-4"} ${className ?? ""}`}>
      {children}
    </div>
  );
}
