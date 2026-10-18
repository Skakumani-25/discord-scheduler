import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  availabilityBlock: { createManyAndReturn: vi.fn() },
}));
vi.mock("../db", () => ({ prisma: prismaMock }));

import availabilityRouter from "./availability";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.locals.userId = "u1";
    next();
  });
  app.use("/api/availability", availabilityRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/availability`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  vi.resetAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({ timezone: "America/New_York" });
  prismaMock.availabilityBlock.createManyAndReturn.mockImplementation(async ({ data }) =>
    data.map((d: object, i: number) => ({ id: `b${i}`, ...d }))
  );
});

const bulk = (body: unknown) =>
  fetch(`${baseUrl}/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

// Thu Oct 29 2026, 7-10 PM EDT, and Fri Oct 30, 7-10 PM EDT
const thu = { startsAt: "2026-10-29T23:00:00.000Z", endsAt: "2026-10-30T02:00:00.000Z" };
const fri = { startsAt: "2026-10-30T23:00:00.000Z", endsAt: "2026-10-31T02:00:00.000Z" };

describe("POST /api/availability/bulk", () => {
  it("creates slots x weeks blocks in a single insert", async () => {
    const res = await bulk({ category: "GAMING", note: " raids ", slots: [thu, fri], weeks: 3 });

    expect(res.status).toBe(201);
    expect(prismaMock.availabilityBlock.createManyAndReturn).toHaveBeenCalledOnce();
    const { data } = prismaMock.availabilityBlock.createManyAndReturn.mock.calls[0][0];
    expect(data).toHaveLength(6);
    expect(data.every((d: { userId: string; category: string; note: string }) =>
      d.userId === "u1" && d.category === "GAMING" && d.note === "raids")).toBe(true);
    // Response is sorted by start time
    const starts = (await res.json()).map((b: { startsAt: string }) => b.startsAt);
    expect(starts).toEqual([...starts].sort());
  });

  it("repeats at the same local time in my saved timezone across DST", async () => {
    await bulk({ category: "GAMING", slots: [thu], weeks: 2 });
    const { data } = prismaMock.availabilityBlock.createManyAndReturn.mock.calls[0][0];
    // US clocks fall back on Nov 1, so week 2 is one hour later in UTC
    expect(data.map((d: { startsAt: Date }) => new Date(d.startsAt).toISOString())).toEqual([
      "2026-10-29T23:00:00.000Z",
      "2026-11-06T00:00:00.000Z",
    ]);
  });

  it("defaults to a single week", async () => {
    await bulk({ category: "TALKING", slots: [thu] });
    expect(prismaMock.availabilityBlock.createManyAndReturn.mock.calls[0][0].data).toHaveLength(1);
  });

  it.each([
    ["an invalid category", { category: "PARTY", slots: [thu], weeks: 1 }],
    ["0 weeks", { category: "GAMING", slots: [thu], weeks: 0 }],
    ["13 weeks", { category: "GAMING", slots: [thu], weeks: 13 }],
    ["fractional weeks", { category: "GAMING", slots: [thu], weeks: 1.5 }],
    ["string weeks", { category: "GAMING", slots: [thu], weeks: "2" }],
    ["no slots", { category: "GAMING", slots: [], weeks: 1 }],
    ["slots not an array", { category: "GAMING", slots: thu, weeks: 1 }],
    ["more than 7 slots", { category: "GAMING", slots: Array(8).fill(thu), weeks: 1 }],
    ["a slot ending before it starts", { category: "GAMING", slots: [{ startsAt: thu.endsAt, endsAt: thu.startsAt }] }],
    ["a malformed slot", { category: "GAMING", slots: [{ startsAt: "soon", endsAt: thu.endsAt }] }],
    ["a slot over 24 hours", { category: "GAMING", slots: [{ startsAt: thu.startsAt, endsAt: "2026-10-31T00:00:00.000Z" }] }],
    ["a non-text note", { category: "GAMING", slots: [thu], note: 5 }],
  ])("rejects %s", async (_label, body) => {
    expect((await bulk(body)).status).toBe(400);
    expect(prismaMock.availabilityBlock.createManyAndReturn).not.toHaveBeenCalled();
  });

  it("allows the maximum of 7 slots x 12 weeks", async () => {
    const res = await bulk({ category: "GAMING", slots: Array(7).fill(thu), weeks: 12 });
    expect(res.status).toBe(201);
    expect(prismaMock.availabilityBlock.createManyAndReturn.mock.calls[0][0].data).toHaveLength(84);
  });
});
