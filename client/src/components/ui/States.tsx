import type { ReactNode } from "react";
import { CircleAlert, LoaderCircle, RefreshCw, type LucideIcon } from "lucide-react";
import Button from "./Button";

// A list that genuinely has nothing in it, with a next step when there is one
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`state${compact ? " state-compact" : ""}`}>
      <div className="state-icon">
        <Icon size={22} aria-hidden />
      </div>
      <p className="state-title">{title}</p>
      {children && <div className="state-body">{children}</div>}
      {action && <div className="state-action">{action}</div>}
    </div>
  );
}

// Data that failed to load, kept visually distinct from an empty list
export function ErrorState({
  title = "Couldn't load this",
  message,
  onRetry,
  compact = false,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`state${compact ? " state-compact" : ""}`} role="alert">
      <div className="state-icon state-icon-danger">
        <CircleAlert size={22} aria-hidden />
      </div>
      <p className="state-title">{title}</p>
      <div className="state-body">{message}</div>
      {onRetry && (
        <div className="state-action">
          <Button icon={RefreshCw} onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

export function LoadingState({ label = "Loading…", compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div className={`state${compact ? " state-compact" : ""}`} role="status">
      <LoaderCircle size={22} className="spin" aria-hidden />
      <span className="state-body">{label}</span>
    </div>
  );
}

// Placeholder rows that keep the layout stable while a list loads
export function SkeletonRows({ rows = 3, height = 56 }: { rows?: number; height?: number }) {
  return (
    <div className="stack-sm" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}
