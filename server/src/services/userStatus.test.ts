import { describe, expect, it } from "vitest";
import { effectiveStatus, parseStatusInput, withEffectiveStatus } from "./userStatus";

const NOW = new Date("2030-01-01T12:00:00.000Z");
const hours = (n: number) => new Date(NOW.getTime() + n * 3_600_000);

describe("effectiveStatus", () => {
  it("returns null when no status is set", () => {
    expect(effectiveStatus({ status: null, statusNote: "stale", statusExpiresAt: null }, NOW)).toBeNull();
  });

  it("returns a status with no expiry", () => {
    expect(effectiveStatus({ status: "BUSY", statusNote: "in class", statusExpiresAt: null }, NOW)).toEqual({
      status: "BUSY",
      note: "in class",
      expiresAt: null,
    });
  });

  it("returns a status until it expires, then null", () => {
    const user = { status: "AWAY" as const, statusNote: null, statusExpiresAt: hours(1) };
    expect(effectiveStatus(user, NOW)?.status).toBe("AWAY");
    expect(effectiveStatus(user, hours(1))).toBeNull();
    expect(effectiveStatus(user, hours(2))).toBeNull();
  });

  it("replaces the raw columns on a user object", () => {
    const shaped = withEffectiveStatus(
      { id: "u1", username: "alice", status: "DND" as const, statusNote: null, statusExpiresAt: null },
      NOW
    );
    expect(shaped).toEqual({ id: "u1", username: "alice", status: { status: "DND", note: null, expiresAt: null } });
    expect(shaped).not.toHaveProperty("statusNote");
  });
});

describe("parseStatusInput", () => {
  it("clears everything with status: null", () => {
    expect(parseStatusInput({ status: null, note: "ignored" }, NOW)).toEqual({
      data: { status: null, statusNote: null, statusExpiresAt: null },
    });
  });

  it("accepts a preset with a trimmed note and expiry", () => {
    expect(parseStatusInput({ status: "AVAILABLE", note: "  free after 8  ", expiresAt: hours(4).toISOString() }, NOW)).toEqual({
      data: { status: "AVAILABLE", statusNote: "free after 8", statusExpiresAt: hours(4) },
    });
  });

  it("treats an empty note as no note and a missing expiry as never", () => {
    expect(parseStatusInput({ status: "BUSY", note: "   " }, NOW)).toEqual({
      data: { status: "BUSY", statusNote: null, statusExpiresAt: null },
    });
  });

  it.each([
    ["an unknown status", { status: "ONLINE" }],
    ["a missing status", {}],
    ["a non-text note", { status: "BUSY", note: 42 }],
    ["a note over 100 characters", { status: "BUSY", note: "x".repeat(101) }],
    ["a malformed expiry", { status: "BUSY", expiresAt: "tomorrow" }],
    ["a numeric expiry", { status: "BUSY", expiresAt: 1234 }],
    ["an expiry in the past", { status: "BUSY", expiresAt: hours(-1).toISOString() }],
    ["an expiry more than 7 days out", { status: "BUSY", expiresAt: hours(24 * 7 + 1).toISOString() }],
  ])("rejects %s", (_label, body) => {
    expect(parseStatusInput(body, NOW)).toHaveProperty("error");
  });
});
