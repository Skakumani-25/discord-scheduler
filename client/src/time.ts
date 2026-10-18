import { createContext, useContext } from "react";

// The user's chosen IANA timezone; every displayed time and datetime input uses it
export const TimezoneContext = createContext<string>(browserTimeZone());

export function useTimezone() {
  return useContext(TimezoneContext);
}

export function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function listTimeZones(): string[] {
  const zones = Intl.supportedValuesOf("timeZone");
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
}

// "Oct 18, 2026, 7:00 PM PDT"
export function formatDateTime(iso: string, tz: string) {
  return new Date(iso).toLocaleString(undefined, {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
  }) + ` ${zoneAbbreviation(iso, tz)}`;
}

// "7:00 PM PDT"
export function formatTime(iso: string, tz: string) {
  return (
    new Date(iso).toLocaleTimeString(undefined, { timeZone: tz, timeStyle: "short" }) +
    ` ${zoneAbbreviation(iso, tz)}`
  );
}

// "PDT", "GMT+5:30", etc. for the given instant (so DST is reflected)
export function zoneAbbreviation(iso: string, tz: string) {
  const part = new Intl.DateTimeFormat(undefined, { timeZone: tz, timeZoneName: "short" })
    .formatToParts(new Date(iso))
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? tz;
}

// Label for a datetime-local input: the abbreviation at the entered time, else the zone name
export function inputZoneLabel(value: string, tz: string) {
  const iso = zonedInputToIso(value, tz);
  return iso ? zoneAbbreviation(iso, tz) : tz;
}

// Wall-clock fields of an instant in a zone
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

const pad = (n: number) => String(n).padStart(2, "0");

// ISO instant -> "YYYY-MM-DDTHH:mm" for <input type="datetime-local">, in tz
export function isoToZonedInput(iso: string, tz: string, round: "up" | "down" = "down") {
  const minute = 60_000;
  const ms = new Date(iso).getTime();
  const rounded = round === "up" ? Math.ceil(ms / minute) * minute : Math.floor(ms / minute) * minute;
  const p = zonedParts(rounded, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

// "YYYY-MM-DDTHH:mm" wall time in tz -> ISO instant ("" if empty or malformed)
export function zonedInputToIso(value: string, tz: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return "";
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Two passes settle the offset around DST transitions
  let ms = wall - offsetMs(wall, tz);
  ms = wall - offsetMs(ms, tz);
  return new Date(ms).toISOString();
}
