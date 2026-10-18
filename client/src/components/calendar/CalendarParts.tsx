import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, weekLabel } from "../../calendar";
import { CATEGORIES, CATEGORY_INFO } from "../../categories";
import Button from "../ui/Button";
import "./WeekGrid.css";

export function WeekToolbar({
  weekStart,
  currentWeekStart,
  onChange,
  disablePast = false,
  status,
}: {
  weekStart: string;
  currentWeekStart: string;
  onChange: (weekStart: string) => void;
  disablePast?: boolean;
  // e.g. a loading indicator, shown after the week label
  status?: ReactNode;
}) {
  return (
    <div className="wg-toolbar">
      <Button
        size="sm"
        icon={ChevronLeft}
        iconOnly
        aria-label="Previous week"
        onClick={() => onChange(addDays(weekStart, -7))}
        disabled={disablePast && weekStart <= currentWeekStart}
      />
      <Button size="sm" onClick={() => onChange(currentWeekStart)} disabled={weekStart === currentWeekStart}>
        Today
      </Button>
      <Button
        size="sm"
        icon={ChevronRight}
        iconOnly
        aria-label="Next week"
        onClick={() => onChange(addDays(weekStart, 7))}
      />
      <span className="wg-week" aria-live="polite">
        {weekLabel(weekStart)}
      </span>
      {status}
    </div>
  );
}

export function CategoryLegend({ showOverlap = false }: { showOverlap?: boolean }) {
  return (
    <div className="legend" aria-label="Category legend">
      {CATEGORIES.map((c) => {
        const { color, text, label, icon: Icon } = CATEGORY_INFO[c];
        return (
          <span key={c} className="legend-item">
            <span className="wg-swatch" style={{ background: color, color: text }}>
              <Icon size={12} aria-hidden />
            </span>
            {label}
          </span>
        );
      })}
      {showOverlap && (
        <span className="legend-item">
          <span className="wg-swatch wg-swatch-overlap" />
          Shared free time
        </span>
      )}
    </div>
  );
}
