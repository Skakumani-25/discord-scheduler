import { isoToZonedInput, zonedInputToIso } from "./time";

// Calendar dates are "YYYY-MM-DD" strings for a day in the user's timezone. Date math on
// them is done in UTC so it never depends on the browser's own zone.

function parse(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

const utcDate = (date: string) => {
  const { y, m, d } = parse(date);
  return new Date(Date.UTC(y, m - 1, d));
};

export function addDays(date: string, n: number) {
  const { y, m, d } = parse(date);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Weeks start on Monday
export function startOfWeek(date: string) {
  const dow = utcDate(date).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

export function weekDays(start: string) {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function todayInZone(tz: string) {
  return isoToZonedInput(new Date().toISOString(), tz).slice(0, 10);
}

// The instant a calendar day starts in tz
export function dayStartIso(date: string, tz: string) {
  return zonedInputToIso(`${date}T00:00`, tz);
}

export function weekRangeIso(start: string, tz: string) {
  return { from: dayStartIso(start, tz), to: dayStartIso(addDays(start, 7), tz) };
}

export function dayLabels(date: string) {
  const d = utcDate(date);
  return {
    long: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }),
    short: `${d.toLocaleDateString(undefined, { weekday: "narrow", timeZone: "UTC" })} ${d.getUTCDate()}`,
  };
}

export function weekLabel(start: string) {
  const fmt = (date: string, opts: Intl.DateTimeFormatOptions) =>
    utcDate(date).toLocaleDateString(undefined, { ...opts, timeZone: "UTC" });
  return `${fmt(start, { month: "short", day: "numeric" })} – ${fmt(addDays(start, 6), {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export function hourLabel(hour: number) {
  return new Date(Date.UTC(2000, 0, 1, hour)).toLocaleTimeString(undefined, {
    hour: "numeric",
    timeZone: "UTC",
  });
}

// Minutes since local midnight for an instant in tz
function wallMinutes(ms: number, tz: string) {
  const v = isoToZonedInput(new Date(ms).toISOString(), tz);
  return Number(v.slice(11, 13)) * 60 + Number(v.slice(14, 16));
}

export type Segment = { dayIndex: number; top: number; bottom: number }; // minutes 0-1440

// Splits an interval into per-day pieces positioned by local wall-clock time
export function segmentsFor(startsAt: string, endsAt: string, days: string[], tz: string): Segment[] {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  const out: Segment[] = [];
  days.forEach((day, dayIndex) => {
    const dayStart = Date.parse(dayStartIso(day, tz));
    const dayEnd = Date.parse(dayStartIso(addDays(day, 1), tz));
    const s = Math.max(start, dayStart);
    const e = Math.min(end, dayEnd);
    if (s >= e) return;
    const top = s === dayStart ? 0 : wallMinutes(s, tz);
    let bottom = e === dayEnd ? 1440 : wallMinutes(e, tz);
    // DST days are 23 or 25 hours long; use elapsed time if wall time goes backwards
    if (bottom <= top) bottom = Math.min(1440, top + Math.max(15, (e - s) / 60_000));
    out.push({ dayIndex, top, bottom });
  });
  return out;
}

// Greedy side-by-side lanes for overlapping items within one day
export function assignLanes<T extends { top: number; bottom: number }>(items: T[]) {
  const sorted = [...items].sort((a, b) => a.top - b.top || b.bottom - a.bottom);
  const result = new Map<T, { lane: number; lanes: number }>();
  let cluster: T[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const item of cluster) result.get(item)!.lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };
  for (const item of sorted) {
    if (item.top >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= item.top);
    if (lane === -1) lane = laneEnds.push(item.bottom) - 1;
    else laneEnds[lane] = item.bottom;
    result.set(item, { lane, lanes: 0 });
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.bottom);
  }
  flush();
  return result;
}
