import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import type { Anchor } from "./WeekGrid";
import "./WeekGrid.css";

const MARGIN = 12;
// Ignore backdrop clicks right after opening: on touch, the tap that opened the popover
// can also deliver a click to the backdrop that just appeared under the finger
const CLOSE_GRACE_MS = 350;

// Floats next to the anchor point on wide screens; a bottom sheet on phones (see CSS)
export default function Popover({
  anchor,
  label,
  onClose,
  children,
}: {
  anchor: Anchor;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const openedAt = useRef(0);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Keep it on screen
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const left = Math.min(Math.max(MARGIN, anchor.x - width / 2), window.innerWidth - width - MARGIN);
    const below = anchor.y + 8;
    const top = below + height > window.innerHeight - MARGIN ? Math.max(MARGIN, anchor.y - height - 8) : below;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [anchor]);

  // Focus the first control once, and close on Escape
  useEffect(() => {
    openedAt.current = performance.now();
    ref.current?.querySelector<HTMLElement>("select, input, button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div
        className="popover-backdrop"
        onClick={() => performance.now() - openedAt.current > CLOSE_GRACE_MS && onClose()}
      />
      <div ref={ref} className="popover" role="dialog" aria-label={label} style={{ left: anchor.x, top: anchor.y }}>
        {children}
      </div>
    </>
  );
}
