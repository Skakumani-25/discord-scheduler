import { useState, type ReactNode } from "react";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

// Discord avatar or server icon, falling back to initials when there's no image or it
// fails to load. `badge` sits on the bottom-right corner (used for presence).
export default function Avatar({
  src,
  name,
  size = 32,
  square = false,
  badge,
}: {
  src?: string | null;
  name: string;
  size?: number;
  square?: boolean;
  badge?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={`avatar${square ? " avatar-square" : ""}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden
    >
      {src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} /> : initials(name)}
      {badge && <span className="avatar-presence">{badge}</span>}
    </span>
  );
}
