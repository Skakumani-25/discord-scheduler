import { useMemo, useState } from "react";
import { startOfWeek, todayInZone, weekDays } from "../calendar";
import { categoryInfo } from "../categories";
import { formatTime, useTimezone } from "../time";
import WeekGrid, { type GridHighlight } from "./calendar/WeekGrid";
import { CategoryLegend, WeekToolbar } from "./calendar/CalendarParts";

type Member = { userId: string; user: { username: string } };
type Block = { id: string; userId: string; category: string; startsAt: string; endsAt: string; note: string | null };
type Window = { startsAt: string; endsAt: string };

// Read-only week view of every member's blocks, one lane per member, with shared free
// windows from the overlap finder outlined on top. Clicking a window starts an event.
export default function GroupCalendar({
  members,
  blocks,
  windows,
  onWindowClick,
}: {
  members: Member[];
  blocks: Block[];
  windows: Window[];
  onWindowClick: (w: Window) => void;
}) {
  const tz = useTimezone();
  const today = useMemo(() => todayInZone(tz), [tz]);
  const currentWeek = startOfWeek(today);
  const [weekStart, setWeekStart] = useState(currentWeek);
  const days = useMemo(() => weekDays(weekStart), [weekStart]);

  const laneOf = new Map(members.map((m, i) => [m.userId, i]));
  const nameOf = new Map(members.map((m) => [m.userId, m.user.username]));
  const range = (x: Window) => `${formatTime(x.startsAt, tz)} – ${formatTime(x.endsAt, tz)}`;

  const gridBlocks = blocks
    .filter((b) => laneOf.has(b.userId))
    .map((b) => {
      const info = categoryInfo(b.category);
      const name = nameOf.get(b.userId)!;
      return {
        id: b.id,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        color: info.color,
        textColor: info.text,
        label: name,
        title: `${name} · ${info.label} · ${range(b)}${b.note ? ` · ${b.note}` : ""}`,
        lane: laneOf.get(b.userId),
      };
    });
  const highlights: GridHighlight[] = windows.map((w) => ({
    key: w.startsAt,
    startsAt: w.startsAt,
    endsAt: w.endsAt,
    title: `Shared free time ${range(w)}. Click to create an event`,
  }));

  return (
    <div style={{ margin: "8px 0 16px" }}>
      {/* Only upcoming blocks are loaded for groups, so earlier weeks would be empty */}
      <WeekToolbar weekStart={weekStart} currentWeekStart={currentWeek} onChange={setWeekStart} disablePast />
      <CategoryLegend showOverlap />
      <div className="wg-legend">
        <span>Columns in each day, left to right:</span>
        {members.map((m) => (
          <span key={m.userId}>{m.user.username}</span>
        ))}
      </div>
      <WeekGrid
        days={days}
        tz={tz}
        today={today}
        blocks={gridBlocks}
        fixedLanes={Math.max(1, members.length)}
        highlights={highlights}
        onHighlightClick={(h) => onWindowClick({ startsAt: h.startsAt, endsAt: h.endsAt })}
      />
    </div>
  );
}
