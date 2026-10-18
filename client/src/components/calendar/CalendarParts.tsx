import { addDays, weekLabel } from "../../calendar";
import { CATEGORIES, CATEGORY_INFO } from "../../categories";
import "./WeekGrid.css";

export function WeekToolbar({
  weekStart,
  currentWeekStart,
  onChange,
  disablePast = false,
}: {
  weekStart: string;
  currentWeekStart: string;
  onChange: (weekStart: string) => void;
  disablePast?: boolean;
}) {
  return (
    <div className="wg-toolbar">
      <button
        onClick={() => onChange(addDays(weekStart, -7))}
        disabled={disablePast && weekStart <= currentWeekStart}
        aria-label="Previous week"
      >
        ‹ Prev
      </button>
      <button onClick={() => onChange(currentWeekStart)} disabled={weekStart === currentWeekStart}>
        Today
      </button>
      <button onClick={() => onChange(addDays(weekStart, 7))} aria-label="Next week">
        Next ›
      </button>
      <span className="wg-week">{weekLabel(weekStart)}</span>
    </div>
  );
}

export function CategoryLegend({ showOverlap = false }: { showOverlap?: boolean }) {
  return (
    <div className="wg-legend">
      {CATEGORIES.map((c) => (
        <span key={c}>
          <span className="wg-swatch" style={{ background: CATEGORY_INFO[c].color }} />
          {CATEGORY_INFO[c].label}
        </span>
      ))}
      {showOverlap && (
        <span>
          <span
            className="wg-swatch"
            style={{ background: "rgba(0, 168, 252, 0.18)", border: "2px dashed #00a8fc" }}
          />
          Shared free time
        </span>
      )}
    </div>
  );
}
