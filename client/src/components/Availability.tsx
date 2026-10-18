import { useMemo, useState } from "react";
import { CalendarPlus, LoaderCircle, MousePointerClick, Plus, Repeat, Trash2 } from "lucide-react";
import { api, errorMessage, useResource } from "../api";
import { addDays, dayLabels, startOfWeek, todayInZone, weekDays, weekRangeIso } from "../calendar";
import { CATEGORIES, CATEGORY_INFO, categoryInfo, type Category } from "../categories";
import { formatDateTime, formatTime, inputZoneLabel, useTimezone, zonedInputToIso } from "../time";
import WeekGrid, { type Anchor, type GridSelection } from "./calendar/WeekGrid";
import Popover from "./calendar/Popover";
import { CategoryLegend, WeekToolbar } from "./calendar/CalendarParts";
import Alert from "./ui/Alert";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Field from "./ui/Field";
import { useToast } from "./ui/toast-context";

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
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function CategorySelect({ value, onChange }: { value: Category; onChange: (c: Category) => void }) {
  return (
    <Field label="Category">
      {(props) => (
        <select {...props} className="select" value={value} onChange={(e) => onChange(e.target.value as Category)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_INFO[c].label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
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
  onCreated: (category: Category, count: number) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<Category>(defaultCategory);
  const [start, setStart] = useState(`${pad(selection.startHour)}:00`);
  // 00:00 as an end time means midnight at the end of the day
  const [end, setEnd] = useState(`${pad(selection.endHour % 24)}:00`);
  const [note, setNote] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [weeks, setWeeks] = useState("4");
  const [timeError, setTimeError] = useState("");
  const [weeksError, setWeeksError] = useState("");
  const [error, setError] = useState("");

  const selectedDays = days.slice(selection.startDay, selection.endDay + 1);
  const totalWeeks = repeat ? Number(weeks) : 1;
  const first = dayLabels(selectedDays[0]).long;
  const last = dayLabels(selectedDays[selectedDays.length - 1]).long;
  const count = selectedDays.length * (Number.isInteger(totalWeeks) ? totalWeeks : 1);

  async function create() {
    setError("");
    const endMinutes = end === "00:00" ? 1440 : toMinutes(end);
    const badTime = !start || !end || endMinutes <= toMinutes(start);
    const badWeeks = repeat && (!Number.isInteger(totalWeeks) || totalWeeks < 2 || totalWeeks > MAX_WEEKS);
    setTimeError(badTime ? "End time must be after the start time." : "");
    setWeeksError(badWeeks ? `Enter a whole number from 2 to ${MAX_WEEKS}.` : "");
    if (badTime || badWeeks) return;

    const slots = selectedDays.map((d) => ({
      startsAt: zonedInputToIso(`${d}T${start}`, tz),
      endsAt: end === "00:00" ? zonedInputToIso(`${addDays(d, 1)}T00:00`, tz) : zonedInputToIso(`${d}T${end}`, tz),
    }));
    try {
      const created = await api<Block[]>("/api/availability/bulk", {
        method: "POST",
        body: { category, note, slots, weeks: totalWeeks },
      });
      onCreated(category, created.length);
    } catch (err) {
      // Keep everything entered so the user can fix it and retry
      setError(errorMessage(err));
    }
  }

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <div>
        <h2 className="popover-title">Add availability</h2>
        <p className="subtle">
          {selectedDays.length === 1 ? first : `${first} – ${last} · ${plural(selectedDays.length, "day")}`}
        </p>
      </div>
      <CategorySelect value={category} onChange={setCategory} />
      <div className="form-row">
        <Field label="From" error={timeError || undefined}>
          {(props) => (
            <input {...props} className="input" type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} />
          )}
        </Field>
        <Field label="To" hint={`Times in ${inputZoneLabel(`${selectedDays[0]}T${start}`, tz)}`}>
          {(props) => (
            <input {...props} className="input" type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} />
          )}
        </Field>
      </div>
      <Field label="Note" optional>
        {(props) => (
          <input
            {...props}
            className="input"
            maxLength={200}
            placeholder="e.g. ranked only"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
      </Field>
      <div className="stack-sm">
        <label className="checkbox">
          <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
          <Repeat size={15} aria-hidden />
          Repeat weekly
        </label>
        {repeat && (
          <Field label="Number of weeks" hint="Including this week" error={weeksError || undefined}>
            {(props) => (
              <input
                {...props}
                className="input"
                type="number"
                inputMode="numeric"
                min={2}
                max={MAX_WEEKS}
                value={weeks}
                onChange={(e) => setWeeks(e.target.value)}
              />
            )}
          </Field>
        )}
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" icon={Plus} onClick={create}>
          {count > 1 ? `Add ${plural(count, "block")}` : "Add availability"}
        </Button>
      </div>
    </form>
  );
}

// The original exact date/time form, for blocks the hourly grid can't express
// (e.g. spanning midnight) and for keyboard-only use
function ExactTimeForm({ tz, onCreated }: { tz: string; onCreated: () => void }) {
  const toast = useToast();
  const [category, setCategory] = useState<Category>("GAMING");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function add() {
    setError("");
    if (!start || !end) {
      setError("Choose a start and end date and time.");
      return;
    }
    try {
      await api("/api/availability", {
        method: "POST",
        body: { category, startsAt: zonedInputToIso(start, tz), endsAt: zonedInputToIso(end, tz), note },
      });
      setNote("");
      toast.success("Availability added");
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <details className="disclosure">
      <summary>Add with exact dates and times</summary>
      <form className="stack disclosure-body" onSubmit={(e) => e.preventDefault()}>
        <div className="form-row">
          <CategorySelect value={category} onChange={setCategory} />
          <Field label="Starts">
            {(props) => (
              <input {...props} className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            )}
          </Field>
          <Field label="Ends" hint={`Times in ${inputZoneLabel(start || end, tz)}`}>
            {(props) => (
              <input {...props} className="input" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            )}
          </Field>
          <Field label="Note" optional>
            {(props) => <input {...props} className="input" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="form-actions">
          <Button type="submit" variant="secondary" icon={CalendarPlus} onClick={add}>
            Add availability
          </Button>
        </div>
      </form>
    </details>
  );
}

type PopoverState =
  | { kind: "create"; selection: GridSelection; anchor: Anchor }
  | { kind: "delete"; block: Block; anchor: Anchor }
  | null;

export default function Availability() {
  const tz = useTimezone();
  const toast = useToast();
  const today = useMemo(() => todayInZone(tz), [tz]);
  const currentWeek = startOfWeek(today);
  const [weekStart, setWeekStart] = useState(currentWeek);
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const [popover, setPopover] = useState<PopoverState>(null);
  const [lastCategory, setLastCategory] = useState<Category>("GAMING");

  const path = useMemo(() => {
    const { from, to } = weekRangeIso(weekStart, tz);
    return `/api/availability?${new URLSearchParams({ from, to })}`;
  }, [weekStart, tz]);
  const { data, error, loading, reload } = useResource<Block[]>(path);
  const blocks = data ?? [];
  const close = () => setPopover(null);

  async function remove(block: Block) {
    try {
      await api(`/api/availability/${block.id}`, { method: "DELETE" });
      toast.success("Availability deleted");
      close();
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const gridBlocks = blocks.map((b) => {
    const info = categoryInfo(b.category);
    const range = `${formatTime(b.startsAt, tz)} – ${formatTime(b.endsAt, tz)}`;
    return {
      id: b.id,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      color: info.color,
      textColor: info.text,
      icon: info.icon,
      label: b.note ? `${info.label}: ${b.note}` : info.label,
      title: `${info.label}, ${range}${b.note ? `, ${b.note}` : ""}. Select to delete.`,
    };
  });

  return (
    <Card
      title="Weekly availability"
      description="Drag across the calendar to add time. On a touch screen, tap a start cell, then an end cell. Select a block to delete it."
    >
      <div className="stack">
        <div className="cluster-between">
          <WeekToolbar
            weekStart={weekStart}
            currentWeekStart={currentWeek}
            onChange={setWeekStart}
            status={
              loading && (
                <span className="wg-hint">
                  <LoaderCircle size={14} className="spin" aria-hidden />
                  Loading
                </span>
              )
            }
          />
          <CategoryLegend />
        </div>

        {error && (
          <Alert
            tone="danger"
            title="Couldn't load this week's availability"
            action={
              <Button size="sm" onClick={reload}>
                Try again
              </Button>
            }
          >
            {error.message}
          </Alert>
        )}

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

        {!loading && !error && blocks.length === 0 && (
          <p className="wg-hint">
            <MousePointerClick size={15} aria-hidden />
            Nothing this week yet. Drag across the hours you're free to add them.
          </p>
        )}

        <ExactTimeForm tz={tz} onCreated={reload} />
      </div>

      {popover?.kind === "create" && (
        <Popover anchor={popover.anchor} label="Add availability" onClose={close}>
          <NewBlockForm
            days={days}
            selection={popover.selection}
            defaultCategory={lastCategory}
            tz={tz}
            onCancel={close}
            onCreated={(category, count) => {
              setLastCategory(category);
              toast.success(count > 1 ? `Added ${plural(count, "block")}` : "Availability added");
              close();
              reload();
            }}
          />
        </Popover>
      )}
      {popover?.kind === "delete" && (
        <Popover anchor={popover.anchor} label="Delete availability" onClose={close}>
          <div className="stack">
            <div>
              <h2 className="popover-title">Delete this block?</h2>
              <p className="muted">
                {categoryInfo(popover.block.category).label} · {formatDateTime(popover.block.startsAt, tz)} –{" "}
                {formatTime(popover.block.endsAt, tz)}
              </p>
              {popover.block.note && <p className="subtle break-words">{popover.block.note}</p>}
            </div>
            <div className="form-actions">
              <Button variant="ghost" onClick={close}>
                Keep it
              </Button>
              <Button variant="danger" icon={Trash2} onClick={() => remove(popover.block)}>
                Delete
              </Button>
            </div>
          </div>
        </Popover>
      )}
    </Card>
  );
}
