import { getProtocolBadge } from "./card-colors";

export function ProtocolBadge({
  protocol,
  variant = "full",
}: {
  protocol: string;
  variant?: "full" | "short";
}) {
  const badge = getProtocolBadge(protocol);
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.className}`}>
      {variant === "short" ? badge.shortLabel : badge.label}
    </span>
  );
}
