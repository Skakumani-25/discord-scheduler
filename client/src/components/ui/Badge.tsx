import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

export default function Badge({
  tone = "neutral",
  icon: Icon,
  children,
  title,
}: {
  tone?: BadgeTone;
  icon?: LucideIcon;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={`badge${tone === "neutral" ? "" : ` badge-${tone}`}`} title={title}>
      {Icon && <Icon size={12} aria-hidden />}
      {children}
    </span>
  );
}
