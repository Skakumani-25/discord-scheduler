import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

const ICONS = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert };

export default function Alert({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: keyof typeof ICONS;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Icon = ICONS[tone];
  return (
    <div className={`alert alert-${tone}`} role={tone === "danger" ? "alert" : undefined}>
      <Icon size={18} aria-hidden />
      <div className="alert-body">
        {title && <div className="alert-title">{title}</div>}
        {children && <div className={title ? "muted" : undefined}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
