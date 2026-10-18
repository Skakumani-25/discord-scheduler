import { useId } from "react";
import { PRESENCE_LABEL, type Presence } from "../status";

const COLOR: Record<Presence, string> = {
  online: "var(--color-success)",
  idle: "var(--color-warning)",
  dnd: "var(--color-danger)",
  offline: "var(--color-text-subtle)",
  unknown: "var(--color-text-subtle)",
};

// Live Discord presence. Each state has its own shape (filled, crescent, bar, ring,
// dashed ring) so it never depends on color alone. Renders nothing when hidden (null).
export function PresenceDot({ presence, size = 10 }: { presence: Presence | null | undefined; size?: number }) {
  // useId output contains characters that break url(#...) references
  const maskId = `idle-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (!presence) return null;
  const label =
    presence === "unknown"
      ? "Discord status unknown"
      : `Discord: ${PRESENCE_LABEL[presence]}${presence === "offline" ? " or invisible" : ""}`;
  const color = COLOR[presence];
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" role="img" aria-label={label} style={{ flexShrink: 0 }}>
      <title>{label}</title>
      {presence === "online" && <circle cx="5" cy="5" r="5" fill={color} />}
      {presence === "idle" && (
        <>
          <mask id={maskId}>
            <rect width="10" height="10" fill="white" />
            <circle cx="2.6" cy="2.6" r="3.4" fill="black" />
          </mask>
          <circle cx="5" cy="5" r="5" fill={color} mask={`url(#${maskId})`} />
        </>
      )}
      {presence === "dnd" && (
        <>
          <circle cx="5" cy="5" r="5" fill={color} />
          <rect x="2.2" y="4" width="5.6" height="2" rx="1" fill="var(--color-surface)" />
        </>
      )}
      {presence === "offline" && <circle cx="5" cy="5" r="3.6" fill="none" stroke={color} strokeWidth="2.4" />}
      {presence === "unknown" && (
        <circle cx="5" cy="5" r="4" fill="none" stroke={color} strokeWidth="1.4" strokeDasharray="2 1.6" />
      )}
    </svg>
  );
}

export function PresenceLegend() {
  return (
    <div className="legend" aria-label="Discord status legend">
      <span>Discord status:</span>
      {(Object.keys(PRESENCE_LABEL) as Presence[]).map((p) => (
        <span key={p} className="legend-item">
          <PresenceDot presence={p} />
          {PRESENCE_LABEL[p]}
        </span>
      ))}
    </div>
  );
}
