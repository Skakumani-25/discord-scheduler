import { useMemo, useState } from "react";
import { startOfWeek, todayInZone, weekDays } from "../../calendar";
import { CATEGORIES, CATEGORY_INFO, categoryInfo } from "../../categories";
import { formatTime, useTimezone } from "../../time";
import WeekGrid, { type GridHighlight } from "../calendar/WeekGrid";
import { CategoryLegend, WeekToolbar } from "../calendar/CalendarParts";
import Card from "../ui/Card";
import Field from "../ui/Field";
import type { Block, Member, OverlapWindow } from "./types";

// Read-only week view of every member's blocks, one lane per member, with shared free
// windows outlined on top. Selecting a window starts a session.
export default function GroupCalendar({
  members,
  blocks,
  windows,
  onWindowClick,
}: {
  members: Member[];
  blocks: Block[];
  windows: OverlapWindow[];
  onWindowClick: (w: OverlapWindow) => void;
}) {
  const tz = useTimezone();
  const today = useMemo(() => todayInZone(tz), [tz]);
  const currentWeek = startOfWeek(today);
  const [weekStart, setWeekStart] = useState(currentWeek);
  const [filter, setFilter] = useState("ALL");
  const days = useMemo(() => weekDays(weekStart), [weekStart]);

  const laneOf = new Map(members.map((m, i) => [m.userId, i]));
  const nameOf = new Map(members.map((m) => [m.userId, m.user.username]));
  const range = (x: OverlapWindow) => `${formatTime(x.startsAt, tz)} – ${formatTime(x.endsAt, tz)}`;

  const gridBlocks = blocks
    .filter((b) => laneOf.has(b.userId) && (filter === "ALL" || b.category === filter))
    .map((b) => {
      const info = categoryInfo(b.category);
      const name = nameOf.get(b.userId)!;
      return {
        id: b.id,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        color: info.color,
        textColor: info.text,
        icon: info.icon,
        label: name,
        title: `${name}: ${info.label}, ${range(b)}${b.note ? `, ${b.note}` : ""}`,
        lane: laneOf.get(b.userId),
      };
    });
  const highlights: GridHighlight[] = windows.map((w) => ({
    key: w.startsAt,
    startsAt: w.startsAt,
    endsAt: w.endsAt,
    title: `Shared free time, ${range(w)}. Select to create a session.`,
  }));

  return (
    <Card
      title="Group calendar"
      description="Each member has their own column within a day. Outlined areas are shared free time; select one to create a session."
      actions={
        <Field label={<span className="visually-hidden">Show category</span>}>
          {(props) => (
            <select {...props} className="select select-compact" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="ALL">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_INFO[c].label}
                </option>
              ))}
            </select>
          )}
        </Field>
      }
    >
      <div className="stack">
        <div className="cluster-between">
          {/* Only upcoming blocks are loaded for groups, so earlier weeks would be empty */}
          <WeekToolbar weekStart={weekStart} currentWeekStart={currentWeek} onChange={setWeekStart} disablePast />
          <CategoryLegend showOverlap />
        </div>
        <ol className="lane-legend" aria-label="Columns within each day, left to right">
          {members.map((m, i) => (
            <li key={m.userId}>
              <span className="lane-index" aria-hidden>
                {i + 1}
              </span>
              <span className="truncate">{m.user.username}</span>
            </li>
          ))}
        </ol>
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
    </Card>
  );
}
