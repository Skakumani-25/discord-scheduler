import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { assignLanes, dayLabels, hourLabel, segmentsFor } from "../../calendar";
import "./WeekGrid.css";

export type GridBlock = {
  id: string;
  startsAt: string;
  endsAt: string;
  color: string;
  textColor: string;
  label: string;
  title: string;
  // Shown on every block so categories don't rely on color alone
  icon?: LucideIcon;
  // Fixed lane (e.g. one per group member); omit to stack overlapping blocks automatically
  lane?: number;
};
export type GridHighlight = { key: string; startsAt: string; endsAt: string; title: string };
// Inclusive day indices; hours are [startHour, endHour)
export type GridSelection = { startDay: number; endDay: number; startHour: number; endHour: number };
export type Anchor = { x: number; y: number };

type Cell = { day: number; hour: number };

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const INITIAL_SCROLL_HOUR = 8;

function cellFromElement(el: Element | null): Cell | null {
  const cell = el?.closest<HTMLElement>("[data-hour]");
  if (!cell) return null;
  return { day: Number(cell.dataset.day), hour: Number(cell.dataset.hour) };
}

function toSelection(a: Cell, b: Cell): GridSelection {
  return {
    startDay: Math.min(a.day, b.day),
    endDay: Math.max(a.day, b.day),
    startHour: Math.min(a.hour, b.hour),
    endHour: Math.max(a.hour, b.hour) + 1,
  };
}

/**
 * A 7-day x 24-hour grid. Read-only unless `onSelect` is given, in which case you can
 * drag across cells with a mouse, or on touch tap a start cell then an end cell (so
 * the grid still scrolls normally on phones).
 */
export default function WeekGrid({
  days,
  tz,
  today,
  blocks,
  fixedLanes,
  highlights = [],
  selection = null,
  onSelect,
  onBlockClick,
  onHighlightClick,
}: {
  days: string[];
  tz: string;
  today: string;
  blocks: GridBlock[];
  fixedLanes?: number;
  highlights?: GridHighlight[];
  selection?: GridSelection | null;
  onSelect?: (selection: GridSelection, anchor: Anchor) => void;
  onBlockClick?: (id: string, anchor: Anchor) => void;
  onHighlightClick?: (highlight: GridHighlight, anchor: Anchor) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ from: Cell; to: Cell } | null>(null);
  const [pendingTap, setPendingTap] = useState<Cell | null>(null);
  const touchStart = useRef<{ x: number; y: number; cell: Cell } | null>(null);

  // Start the view at a useful hour instead of midnight
  useEffect(() => {
    const el = scrollRef.current;
    const cell = el?.querySelector<HTMLElement>(".wg-cell");
    if (el && cell) el.scrollTop = cell.offsetHeight * INITIAL_SCROLL_HOUR;
  }, []);

  const editable = !!onSelect;
  const shown = drag
    ? toSelection(drag.from, drag.to)
    : pendingTap
      ? toSelection(pendingTap, pendingTap)
      : selection;

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!editable || (e.target as Element).closest(".wg-block, .wg-highlight")) return;
    const cell = cellFromElement(e.target as Element);
    if (!cell) return;
    if (e.pointerType === "touch") {
      touchStart.current = { x: e.clientX, y: e.clientY, cell };
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setPendingTap(null);
    setDrag({ from: cell, to: cell });
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const cell = cellFromElement(document.elementFromPoint(e.clientX, e.clientY));
    if (cell && (cell.day !== drag.to.day || cell.hour !== drag.to.hour)) setDrag({ ...drag, to: cell });
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const anchor = { x: e.clientX, y: e.clientY };
    if (drag) {
      setDrag(null);
      onSelect?.(toSelection(drag.from, drag.to), anchor);
      return;
    }
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) return;
    // Touch: first tap marks the start, second tap completes the range
    if (!pendingTap) {
      setPendingTap(start.cell);
    } else {
      setPendingTap(null);
      onSelect?.(toSelection(pendingTap, start.cell), anchor);
    }
  }

  function onPointerCancel() {
    // Fired when a touch turns into a scroll
    setDrag(null);
    touchStart.current = null;
  }

  function activate(e: KeyboardEvent, fn: () => void) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  }
  const anchorOf = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.bottom };
  };

  // Lay out blocks per day
  const pieces = blocks.flatMap((b) =>
    segmentsFor(b.startsAt, b.endsAt, days, tz).map((seg) => ({ ...seg, block: b }))
  );
  const lanesByDay = days.map((_, i) => assignLanes(pieces.filter((p) => p.dayIndex === i)));
  const highlightPieces = highlights.flatMap((h) =>
    segmentsFor(h.startsAt, h.endsAt, days, tz).map((seg) => ({ ...seg, highlight: h }))
  );
  const pct = (minutes: number) => `${(minutes / 1440) * 100}%`;

  return (
    <div className={`wg${editable ? " editable" : ""}`}>
      {editable && pendingTap && (
        <p className="wg-hint wg-hint-pending" role="status">
          Now tap the end cell, or the same cell for one hour.
        </p>
      )}
      <div className="wg-scroll" ref={scrollRef}>
        <div className="wg-header">
          <div />
          {days.map((d) => {
            const label = dayLabels(d);
            return (
              <div key={d} className={`wg-dayhead${d === today ? " today" : ""}`}>
                <span className="long">{label.long}</span>
                <span className="short">{label.short}</span>
              </div>
            );
          })}
        </div>
        <div
          className="wg-body"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <div>
            {HOURS.map((h) => (
              <div key={h} className="wg-hour-label">
                {h === 0 ? "" : hourLabel(h)}
              </div>
            ))}
          </div>
          {days.map((d, dayIndex) => (
            <div key={d} className={`wg-day${d === today ? " today" : ""}`}>
              {HOURS.map((h) => {
                const selected =
                  shown &&
                  dayIndex >= shown.startDay &&
                  dayIndex <= shown.endDay &&
                  h >= shown.startHour &&
                  h < shown.endHour;
                const pending = pendingTap && pendingTap.day === dayIndex && pendingTap.hour === h;
                return (
                  <div
                    key={h}
                    className={`wg-cell${selected ? " selected" : ""}${pending ? " pending" : ""}`}
                    data-day={dayIndex}
                    data-hour={h}
                  />
                );
              })}

              {pieces
                .filter((p) => p.dayIndex === dayIndex)
                .map((p) => {
                  const auto = lanesByDay[dayIndex].get(p)!;
                  const lanes = fixedLanes ?? auto.lanes;
                  const lane = p.block.lane ?? auto.lane;
                  const clickable = !!onBlockClick;
                  return (
                    <div
                      key={`${p.block.id}-${dayIndex}`}
                      className="wg-block"
                      title={p.block.title}
                      aria-label={p.block.title}
                      role={clickable ? "button" : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={clickable ? (e) => onBlockClick(p.block.id, { x: e.clientX, y: e.clientY }) : undefined}
                      onKeyDown={
                        clickable
                          ? (e) => activate(e, () => onBlockClick(p.block.id, anchorOf(e.currentTarget)))
                          : undefined
                      }
                      style={{
                        top: pct(p.top),
                        height: pct(p.bottom - p.top),
                        left: `${(lane / lanes) * 100}%`,
                        width: `calc(${100 / lanes}% - 2px)`,
                        background: p.block.color,
                        color: p.block.textColor,
                      }}
                    >
                      {p.block.icon && <p.block.icon size={12} aria-hidden />}
                      <span className="wg-block-label">{p.block.label}</span>
                    </div>
                  );
                })}

              {highlightPieces
                .filter((p) => p.dayIndex === dayIndex)
                .map((p) => {
                  const clickable = !!onHighlightClick;
                  return (
                    <div
                      key={`${p.highlight.key}-${dayIndex}`}
                      className={`wg-highlight${clickable ? " clickable" : ""}`}
                      title={p.highlight.title}
                      aria-label={p.highlight.title}
                      role={clickable ? "button" : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={
                        clickable ? (e) => onHighlightClick(p.highlight, { x: e.clientX, y: e.clientY }) : undefined
                      }
                      onKeyDown={
                        clickable
                          ? (e) => activate(e, () => onHighlightClick(p.highlight, anchorOf(e.currentTarget)))
                          : undefined
                      }
                      style={{ top: pct(p.top), height: pct(p.bottom - p.top) }}
                    />
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
