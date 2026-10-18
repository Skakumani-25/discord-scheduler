// IANA zone names only ("Area/Location" or "UTC"). Intl alone would also accept
// abbreviations and offsets like "EST" or "+05:00", which we don't want to store.
const IANA_SHAPE = /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)+$/;

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length > 64) return false;
  if (tz !== "UTC" && !IANA_SHAPE.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
