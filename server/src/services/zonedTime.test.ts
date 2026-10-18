import { describe, expect, it } from "vitest";
import { addWeeksInZone } from "./zonedTime";

describe("addWeeksInZone", () => {
  it("adds exact weeks in UTC", () => {
    expect(addWeeksInZone(new Date("2026-10-01T19:00:00.000Z"), 2, "UTC").toISOString()).toBe(
      "2026-10-15T19:00:00.000Z"
    );
  });

  it("keeps 7 PM local across the US fall-back change", () => {
    // Oct 29 7 PM EDT (23:00Z) -> Nov 5 7 PM EST (00:00Z next day)
    const start = new Date("2026-10-29T23:00:00.000Z");
    expect(addWeeksInZone(start, 1, "America/New_York").toISOString()).toBe("2026-11-06T00:00:00.000Z");
  });

  it("keeps 7 PM local across the US spring-forward change", () => {
    // Mar 5 7 PM EST (00:00Z Mar 6) -> Mar 12 7 PM EDT (23:00Z)
    const start = new Date("2026-03-06T00:00:00.000Z");
    expect(addWeeksInZone(start, 1, "America/New_York").toISOString()).toBe("2026-03-12T23:00:00.000Z");
  });

  it("handles southern-hemisphere DST and half-hour zones", () => {
    // Sydney leaves DST on Apr 5 2026: 8 PM AEDT (09:00Z) -> 8 PM AEST (10:00Z)
    expect(addWeeksInZone(new Date("2026-04-01T09:00:00.000Z"), 1, "Australia/Sydney").toISOString()).toBe(
      "2026-04-08T10:00:00.000Z"
    );
    expect(addWeeksInZone(new Date("2026-10-18T03:45:00.000Z"), 12, "Asia/Kolkata").toISOString()).toBe(
      "2027-01-10T03:45:00.000Z"
    );
  });

  it("returns the same instant for 0 weeks", () => {
    const d = new Date("2026-10-18T03:45:12.345Z");
    expect(addWeeksInZone(d, 0, "America/New_York").toISOString()).toBe(d.toISOString());
  });
});
