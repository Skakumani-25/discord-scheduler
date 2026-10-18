import { statusOption, type UserStatus } from "../status";
import { formatDateTime, formatTime, useTimezone } from "../time";

function untilLabel(iso: string, tz: string, now: number) {
  // Times within a day read better without the date
  return new Date(iso).getTime() - now < 24 * 3_600_000 ? formatTime(iso, tz) : formatDateTime(iso, tz);
}

// A member's custom status: icon + label (+ note and expiry unless compact)
export default function StatusBadge({
  status,
  compact = false,
  now,
}: {
  status: UserStatus;
  compact?: boolean;
  // Current time, passed in so rendering stays pure
  now?: number;
}) {
  const tz = useTimezone();
  if (!status) return null;
  const option = statusOption(status.status);
  const Icon = option.icon;
  const description = [option.label, status.note].filter(Boolean).join(": ");

  if (compact) {
    return (
      <span className={`status-label status-${status.status}`} title={description}>
        <Icon size={14} aria-hidden />
        <span className="visually-hidden">{description}</span>
      </span>
    );
  }
  return (
    <span className="status-label">
      <span className={`status-label status-${status.status}`}>
        <Icon size={14} aria-hidden />
        {option.label}
      </span>
      {status.note && <span className="muted truncate">· {status.note}</span>}
      {status.expiresAt && now !== undefined && (
        <span className="subtle">until {untilLabel(status.expiresAt, tz, now)}</span>
      )}
    </span>
  );
}
