import { describe, expect, it } from "vitest";
import { findOverlaps, type OverlapBlock } from "./overlap";

// Fixed "now" so tests are deterministic; all blocks sit on 2030-01-01 unless noted
const NOW = new Date("2030-01-01T00:00:00.000Z");
const t = (hhmm: string) => `2030-01-01T${hhmm}:00.000Z`;
const block = (start: string, end: string, category = "GAMING"): OverlapBlock => ({
  category,
  startsAt: t(start),
  endsAt: t(end),
});
const win = (start: string, end: string) => ({ startsAt: t(start), endsAt: t(end) });

describe("findOverlaps", () => {
  it("returns nothing when members never overlap", () => {
    const result = findOverlaps(
      { a: [block("10:00", "12:00")], b: [block("13:00", "15:00")] },
      ["a", "b"],
      { now: NOW }
    );
    expect(result).toEqual([]);
  });

  it("returns the shared part of a partial overlap", () => {
    const result = findOverlaps(
      { a: [block("10:00", "12:00")], b: [block("11:00", "14:00")] },
      ["a", "b"],
      { now: NOW }
    );
    expect(result).toEqual([win("11:00", "12:00")]);
  });

  it("intersects across three users", () => {
    const result = findOverlaps(
      {
        a: [block("09:00", "17:00")],
        b: [block("10:00", "13:00"), block("14:00", "16:00")],
        c: [block("12:00", "15:00")],
      },
      ["a", "b", "c"],
      { now: NOW }
    );
    expect(result).toEqual([win("12:00", "13:00"), win("14:00", "15:00")]);
  });

  it("merges adjacent blocks from the same user into one interval", () => {
    const result = findOverlaps(
      {
        a: [block("10:00", "10:20"), block("10:20", "10:40")],
        b: [block("10:00", "11:00")],
      },
      ["a", "b"],
      { now: NOW }
    );
    // Each half is only 20 min, so merging is what makes this pass the 30 min default
    expect(result).toEqual([win("10:00", "10:40")]);
  });

  it("does not treat blocks touching across different users as overlap", () => {
    const result = findOverlaps(
      { a: [block("10:00", "11:00")], b: [block("11:00", "12:00")] },
      ["a", "b"],
      { now: NOW, minMinutes: 1 }
    );
    expect(result).toEqual([]);
  });

  it("merges one user's overlapping blocks before intersecting", () => {
    const result = findOverlaps(
      {
        a: [block("11:00", "13:00"), block("10:00", "12:00"), block("10:30", "11:00")],
        b: [block("09:00", "14:00")],
      },
      ["a", "b"],
      { now: NOW }
    );
    expect(result).toEqual([win("10:00", "13:00")]);
  });

  it("returns nothing when one member has no blocks", () => {
    const result = findOverlaps(
      { a: [block("10:00", "12:00")], b: [block("10:00", "12:00")] },
      ["a", "b", "c"],
      { now: NOW }
    );
    expect(result).toEqual([]);
  });

  it("returns nothing when one member has an empty block list", () => {
    const result = findOverlaps(
      { a: [block("10:00", "12:00")], b: [] },
      ["a", "b"],
      { now: NOW }
    );
    expect(result).toEqual([]);
  });

  it("filters windows shorter than the minimum duration (default 30)", () => {
    const blocks = {
      a: [block("10:00", "10:20"), block("12:00", "12:30"), block("14:00", "16:00")],
      b: [block("09:00", "17:00")],
    };
    expect(findOverlaps(blocks, ["a", "b"], { now: NOW })).toEqual([
      win("12:00", "12:30"),
      win("14:00", "16:00"),
    ]);
    expect(findOverlaps(blocks, ["a", "b"], { now: NOW, minMinutes: 60 })).toEqual([
      win("14:00", "16:00"),
    ]);
    expect(findOverlaps(blocks, ["a", "b"], { now: NOW, minMinutes: 121 })).toEqual([]);
  });

  it("excludes past windows and clips an in-progress window to now", () => {
    const now = new Date(t("12:00"));
    const result = findOverlaps(
      {
        a: [block("08:00", "09:00"), block("11:00", "13:00"), block("15:00", "16:00")],
        b: [block("08:00", "16:00")],
      },
      ["a", "b"],
      { now }
    );
    expect(result).toEqual([win("12:00", "13:00"), win("15:00", "16:00")]);
  });

  it("drops an in-progress window whose remaining time is under the minimum", () => {
    const now = new Date(t("11:45"));
    const result = findOverlaps(
      { a: [block("11:00", "12:00")], b: [block("11:00", "12:00")] },
      ["a", "b"],
      { now }
    );
    expect(result).toEqual([]);
  });

  it("only counts blocks of the chosen category", () => {
    const blocks = {
      a: [block("10:00", "12:00", "GAMING"), block("14:00", "16:00", "MOVIE")],
      b: [block("10:00", "12:00", "STUDYING"), block("14:00", "16:00", "MOVIE")],
    };
    expect(findOverlaps(blocks, ["a", "b"], { now: NOW, category: "GAMING" })).toEqual([]);
    expect(findOverlaps(blocks, ["a", "b"], { now: NOW, category: "MOVIE" })).toEqual([
      win("14:00", "16:00"),
    ]);
  });

  it("merges blocks of different categories when category is ALL", () => {
    const result = findOverlaps(
      {
        a: [block("10:00", "11:00", "GAMING"), block("11:00", "12:00", "TALKING")],
        b: [block("10:00", "12:00", "OTHER")],
      },
      ["a", "b"],
      { now: NOW, category: "ALL" }
    );
    expect(result).toEqual([win("10:00", "12:00")]);
  });

  it("returns a single user's merged future intervals, sorted", () => {
    const result = findOverlaps(
      { a: [block("15:00", "16:00"), block("10:00", "11:00")] },
      ["a"],
      { now: NOW }
    );
    expect(result).toEqual([win("10:00", "11:00"), win("15:00", "16:00")]);
  });

  it("ignores blocks of users not in memberIds", () => {
    const result = findOverlaps(
      { a: [block("10:00", "12:00")], b: [block("10:00", "12:00")], c: [] },
      ["a", "b"],
      { now: NOW }
    );
    expect(result).toEqual([win("10:00", "12:00")]);
  });

  it("returns nothing for an empty member list", () => {
    expect(findOverlaps({ a: [block("10:00", "12:00")] }, [], { now: NOW })).toEqual([]);
  });

  it("accepts Date objects and returns ISO UTC strings", () => {
    const result = findOverlaps(
      {
        a: [{ category: "GAMING", startsAt: new Date(t("10:00")), endsAt: new Date(t("11:00")) }],
        b: [{ category: "GAMING", startsAt: "2030-01-01T05:00:00-05:00", endsAt: t("12:00") }],
      },
      ["a", "b"],
      { now: NOW }
    );
    expect(result).toEqual([win("10:00", "11:00")]);
  });
});
