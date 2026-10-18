import { PRESENCE_INFO, type Presence } from "../status";

// Small dot for a member's live Discord presence; renders nothing when hidden (null)
export function PresenceDot({ presence }: { presence: Presence | null | undefined }) {
  if (!presence) return null;
  const info = PRESENCE_INFO[presence];
  const title =
    presence === "unknown"
      ? "Discord status unknown (the bot can't see this user)"
      : `Discord: ${info.label}${presence === "offline" ? " (or invisible)" : ""}`;
  return (
    <span
      title={title}
      aria-label={title}
      role="img"
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: info.color,
        border: presence === "unknown" ? "1px dashed #80848e" : "none",
        boxSizing: "border-box",
        marginRight: 6,
        verticalAlign: "middle",
      }}
    />
  );
}

export function PresenceLegend() {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: "0.85em", margin: "4px 0" }}>
      <span>Discord:</span>
      {(Object.keys(PRESENCE_INFO) as Presence[]).map((p) => (
        <span key={p}>
          <PresenceDot presence={p} />
          {PRESENCE_INFO[p].label}
        </span>
      ))}
    </div>
  );
}
