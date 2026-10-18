import { useEffect, useMemo, useState } from "react";
import { addDays, dayLabels, startOfWeek, todayInZone, weekDays, weekRangeIso } from "../calendar";
import { CATEGORIES, CATEGORY_INFO, categoryInfo, type Category } from "../categories";
import { formatDateTime, formatTime, inputZoneLabel, useTimezone, zonedInputToIso } from "../time";
import WeekGrid, { type Anchor, type GridSelection } from "./calendar/WeekGrid";
import Popover from "./calendar/Popover";
import { CategoryLegend, WeekToolbar } from "./calendar/CalendarParts";

type Block = {
  id: string;
  category: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
};

const MAX_WEEKS = 12;
const pad = (n: number) => String(n).padStart(2, "0");
const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function rangeLabel(b: { startsAt: string; endsAt: string }, tz: string) {
  return `${formatTime(b.startsAt, tz)} – ${formatTime(b.endsAt, tz)}`;
}

// Popover body for a new selection: category, exact times, note, weekly repeat
function NewBlockForm({
  days,
  selection,
  defaultCategory,
  tz,
  onCreated,
  onCancel,
}: {
  days: string[];
  selection: GridSelection;
  defaultCategory: Category;
  tz: string;
  onCreated: (category: Category) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<Category>(defaultCategory);
  const [start, setStart] = useState(`${pad(selection.startHour)}:00`);
  // 00:00 as an end time means midnight at the end of the day
  const [end, setEnd] = useState(`${pad(selection.endHour % 24)}:00`);
  const [note, setNote] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [weeks, setWeeks] = useState(4);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedDays = days.slice(selection.startDay, selection.endDay + 1);
  const totalWeeks = repeat ? weeks : 1;
  const first = dayLabels(selectedDays[0]).long;
  const last = dayLabels(selectedDays[selectedDays.length - 1]).long;

  async function create() {
    setError("");
    const endMinutes = end === "00:00" ? 1440 : toMinutes(end);
    if (endMinutes <= toMinutes(start)) {
      setError("End time must be after start time");
      return;
    }
    if (!Number.isInteger(totalWeeks) || totalWeeks < 1 || totalWeeks > MAX_WEEKS) {
      setError(`Repeat for 1 to ${MAX_WEEKS} weeks`);
      return;
    }
    const slots = selectedDays.map((d) => ({
      startsAt: zonedInputToIso(`${d}T${start}`, tz),
      endsAt: end === "00:00" ? zonedInputToIso(`${addDays(d, 1)}T00:00`, tz) : zonedInputToIso(`${d}T${end}`, tz),
    }));
    setSaving(true);
    try {
      const res = await fetch("/api/availability/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, note, slots, weeks: totalWeeks }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Could not save");
        return;
      }
      onCreated(category);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <strong>New availability</strong>
      <div>
        {selectedDays.length === 1 ? first : `${first} – ${last} (${selectedDays.length} days)`}
      </div>
      <label>
        Category{" "}
        <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_INFO[c].label}
            </option>
          ))}
        </select>
      </label>
      <div className="row">
        <label>
          From <input type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          to <input type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <span>{inputZoneLabel(`${selectedDays[0]}T${start}`, tz)}</span>
      </div>
      <label>
        Note <input maxLength={200} placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="row">
        <label>
          <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} /> Repeat weekly
        </label>
        {repeat && (
          <label>
            for{" "}
            <input
              type="number"
              min={2}
              max={MAX_WEEKS}
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
              style={{ width: 56 }}
            />{" "}
            weeks
          </label>
        )}
      </div>
      {selectedDays.length * totalWeeks > 1 && (
        <small>Creates {selectedDays.length * totalWeeks} blocks</small>
      )}
      {error && <p style={{ color: "red", margin: "6px 0" }}>{error}</p>}
      <div className="actions">
        <button onClick={onCancel}>Cancel</button>
        <button onClick={create} disabled={saving}>
          {saving ? "Saving..." : "Add"}
        </button>
      </div>
    </>
  );
}

// The original exact date/time form, for blocks the hourly grid can't express
// (e.g. spanning midnight)
function ExactTimeForm({ tz, onCreated }: { tz: string; onCreated: () => void }) {
  const [category, setCategory] = useState<Category>("GAMING");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function add() {
    setError("");
    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        startsAt: zonedInputToIso(start, tz),
        endsAt: zonedInputToIso(end, tz),
        note,
      }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Something went wrong");
      return;
    }
    setNote("");
    onCreated();
  }

  return (
    <details style={{ marginTop: 8, textAlign: "left" }}>
      <summary>Add with exact dates and times</summary>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_INFO[c].label}
            </option>
          ))}
        </select>
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        <span>{inputZoneLabel(start || end, tz)}</span>
        <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button onClick={add}>Add</button>
      </div>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </details>
  );
}

type PopoverState =
  | { kind: "create"; selection: GridSelection; anchor: Anchor }
  | { kind: "delete"; block: Block; anchor: Anchor }
  | null;

export default function Availability() {
  const tz = useTimezone();
  const today = useMemo(() => todayInZone(tz), [tz]);
  const currentWeek = startOfWeek(today);
  const [weekStart, setWeekStart] = useState(currentWeek);
  const days = useMemo(() => weekDays(weekStart), [weekStart]);

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [popover, setPopover] = useState<PopoverState>(null);
  const [lastCategory, setLastCategory] = useState<Category>("GAMING");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const { from, to } = weekRangeIso(weekStart, tz);
    fetch(`/api/availability?${new URLSearchParams({ from, to })}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => !cancelled && setBlocks(data));
    return () => {
      cancelled = true;
    };
  }, [weekStart, tz, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);
  const close = () => setPopover(null);

  async function remove(id: string) {
    setError("");
    const res = await fetch(`/api/availability/${id}`, { method: "DELETE" });
    if (!res.ok) setError("Could not delete that block");
    close();
    reload();
  }

  const gridBlocks = blocks.map((b) => {
    const info = categoryInfo(b.category);
    const range = rangeLabel(b, tz);
    return {
      id: b.id,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      color: info.color,
      textColor: info.text,
      label: b.note ? `${info.label}: ${b.note}` : info.label,
      title: `${info.label} · ${range}${b.note ? ` · ${b.note}` : ""} (click to delete)`,
    };
  });

  return (
    <div style={{ marginTop: 24 }}>
      <h2>My availability</h2>
      <WeekToolbar weekStart={weekStart} currentWeekStart={currentWeek} onChange={setWeekStart} />
      <CategoryLegend />
      <p className="wg-hint">
        Drag across the grid to add time (on a phone, tap a start cell then an end cell). Click a block to
        delete it.
      </p>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <WeekGrid
        days={days}
        tz={tz}
        today={today}
        blocks={gridBlocks}
        selection={popover?.kind === "create" ? popover.selection : null}
        onSelect={(selection, anchor) => setPopover({ kind: "create", selection, anchor })}
        onBlockClick={(id, anchor) => {
          const block = blocks.find((b) => b.id === id);
          if (block) setPopover({ kind: "delete", block, anchor });
        }}
      />

      {popover?.kind === "create" && (
        <Popover anchor={popover.anchor} label="New availability" onClose={close}>
          <NewBlockForm
            days={days}
            selection={popover.selection}
            defaultCategory={lastCategory}
            tz={tz}
            onCancel={close}
            onCreated={(category) => {
              setLastCategory(category);
              close();
              reload();
            }}
          />
        </Popover>
      )}
      {popover?.kind === "delete" && (
        <Popover anchor={popover.anchor} label="Delete availability" onClose={close}>
          <strong>{categoryInfo(popover.block.category).label}</strong>
          <div>
            {formatDateTime(popover.block.startsAt, tz)} – {formatTime(popover.block.endsAt, tz)}
          </div>
          {popover.block.note && <div>{popover.block.note}</div>}
          <div className="actions">
            <button onClick={close}>Cancel</button>
            <button onClick={() => remove(popover.block.id)} style={{ color: "#f23f43" }}>
              Delete
            </button>
          </div>
        </Popover>
      )}

      <ExactTimeForm tz={tz} onCreated={reload} />
    </div>
  );
}
