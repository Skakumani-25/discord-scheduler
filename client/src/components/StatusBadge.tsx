import { formatDateTime, formatTime, useTimezone } from "../time";
import { STATUS_OPTIONS, type UserStatus } from "../status";

function untilLabel(iso: string, tz: string) {
  // Times within a day read better without the date
  const sameDay = new Date(iso).getTime() - Date.now() < 24 * 3_600_000;
  return sameDay ? formatTime(iso, tz) : formatDateTime(iso, tz);
}

export default function StatusBadge({ status, compact = false }: { status: UserStatus; compact?: boolean }) {
  const tz = useTimezone();
  if (!status) return null;
  const option = STATUS_OPTIONS.find((o) => o.value === status.status)!;
  const dot = (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: option.color,
        marginRight: 4,
        verticalAlign: "middle",
      }}
    />
  );
  if (compact) {
    return (
      <span title={[option.label, status.note].filter(Boolean).join(": ")} style={{ marginLeft: 4 }}>
        {dot}
      </span>
    );
  }
  return (
    <span style={{ marginLeft: 8, fontWeight: "normal" }}>
      {dot}
      {option.label}
      {status.note && <> · {status.note}</>}
      {status.expiresAt && <small> (until {untilLabel(status.expiresAt, tz)})</small>}
    </span>
  );
}
