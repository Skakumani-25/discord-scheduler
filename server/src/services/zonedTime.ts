// Wall-clock arithmetic in an IANA zone, so "same time next week" stays at the same
// local time across DST changes instead of drifting by an hour.

function zonedParts(ms: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

// Zone's offset from UTC at an instant, in ms
function offsetMs(ms: number, tz: string) {
  const p = zonedParts(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

// The instant whose wall-clock time in tz is `wall` (wall fields encoded as a UTC timestamp)
function wallToInstant(wall: number, tz: string) {
  // Two passes settle the offset around DST transitions
  let ms = wall - offsetMs(wall, tz);
  ms = wall - offsetMs(ms, tz);
  return ms;
}

export function addWeeksInZone(date: Date, weeks: number, tz: string): Date {
  const ms = date.getTime();
  const p = zonedParts(ms, tz);
  const subSecond = ms - Math.floor(ms / 1000) * 1000;
  const wall = Date.UTC(p.year, p.month - 1, p.day + 7 * weeks, p.hour, p.minute, p.second);
  return new Date(wallToInstant(wall, tz) + subSecond);
}
