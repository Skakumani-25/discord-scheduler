export type OverlapBlock = {
  category: string;
  startsAt: Date | string;
  endsAt: Date | string;
};

export type OverlapOptions = {
  // A Category value, or "ALL" to accept any category
  category?: string;
  minMinutes?: number;
  // Injected for testability; windows ending at or before this are dropped
  now?: Date;
};

export type OverlapWindow = { startsAt: string; endsAt: string };

type Interval = { start: number; end: number };

// Combine one user's overlapping or touching blocks into disjoint, sorted intervals
function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const iv of sorted) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) {
      last.end = Math.max(last.end, iv.end);
    } else {
      merged.push({ ...iv });
    }
  }
  return merged;
}

// Intersect two disjoint, sorted interval lists
function intersect(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const start = Math.max(a[i].start, b[j].start);
    const end = Math.min(a[i].end, b[j].end);
    if (start < end) out.push({ start, end });
    if (a[i].end < b[j].end) i++;
    else j++;
  }
  return out;
}

/**
 * Time windows during which every listed member has an availability block of
 * the chosen category. Windows already in progress are clipped to start at `now`.
 */
export function findOverlaps(
  blocksByUser: Record<string, OverlapBlock[]>,
  memberIds: string[],
  options: OverlapOptions = {}
): OverlapWindow[] {
  const { category = "ALL", minMinutes = 30, now = new Date() } = options;
  const ids = [...new Set(memberIds)];
  if (ids.length === 0) return [];

  const nowMs = now.getTime();
  let common: Interval[] | null = null;

  for (const id of ids) {
    const intervals = (blocksByUser[id] ?? [])
      .filter((b) => category === "ALL" || b.category === category)
      .map((b) => ({
        start: Math.max(new Date(b.startsAt).getTime(), nowMs),
        end: new Date(b.endsAt).getTime(),
      }))
      .filter((iv) => iv.start < iv.end);

    const merged = mergeIntervals(intervals);
    common = common === null ? merged : intersect(common, merged);
    if (common.length === 0) return [];
  }

  const minMs = minMinutes * 60_000;
  return (common ?? [])
    .filter((iv) => iv.end - iv.start >= minMs)
    .map((iv) => ({
      startsAt: new Date(iv.start).toISOString(),
      endsAt: new Date(iv.end).toISOString(),
    }));
}
