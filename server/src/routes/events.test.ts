import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const prismaMock = vi.hoisted(() => ({
  groupMember: { findUnique: vi.fn() },
  event: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), update: vi.fn() },
  eventRsvp: { upsert: vi.fn() },
  meetingChannel: { findUnique: vi.fn() },
}));
vi.mock("../db", () => ({ prisma: prismaMock }));
const reminderSync = vi.hoisted(() => ({ syncReminder: vi.fn(), recomputeEventReminders: vi.fn() }));
vi.mock("../services/reminderSync", () => reminderSync);
const announceEvent = vi.hoisted(() => vi.fn());
vi.mock("../bot/announcements", () => ({ announceEvent }));

import eventsRouter from "./events";

const GROUP = "group1";
const EVENT = "event1";
const ALICE = "alice"; // member, event creator
const BOB = "bob"; // member
const OWEN = "owen"; // group owner
const MALLORY = "mallory"; // not a member

const members: Record<string, { role: "OWNER" | "MEMBER" }> = {
  [ALICE]: { role: "MEMBER" },
  [BOB]: { role: "MEMBER" },
  [OWEN]: { role: "OWNER" },
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  // Stand-in for requireAuth: the test picks the caller via a header
  app.use((req, res, next) => {
    res.locals.userId = req.header("x-user");
    next();
  });
  app.use("/api", eventsRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  vi.resetAllMocks();
  prismaMock.groupMember.findUnique.mockImplementation(
    async ({ where }: { where: { groupId_userId: { groupId: string; userId: string } } }) => {
      const { groupId, userId } = where.groupId_userId;
      const m = groupId === GROUP ? members[userId] : undefined;
      return m ? { groupId, userId, role: m.role } : null;
    }
  );
  prismaMock.event.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id === EVENT
      ? { id: EVENT, groupId: GROUP, creatorId: ALICE, startsAt: new Date(future(24)), endsAt: new Date(future(26)) }
      : null
  );
});

function call(method: string, path: string, user: string, body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { "x-user": user, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const future = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
const validEvent = () => ({
  title: "Raid night",
  category: "GAMING",
  startsAt: future(24),
  endsAt: future(26),
});

describe("authorization: non-members get 404", () => {
  it("POST /groups/:id/events", async () => {
    const res = await call("POST", `/groups/${GROUP}/events`, MALLORY, validEvent());
    expect(res.status).toBe(404);
    expect(prismaMock.event.create).not.toHaveBeenCalled();
  });

  it("GET /groups/:id/events", async () => {
    const res = await call("GET", `/groups/${GROUP}/events`, MALLORY);
    expect(res.status).toBe(404);
    expect(prismaMock.event.findMany).not.toHaveBeenCalled();
  });

  it("PUT /events/:id/rsvp", async () => {
    const res = await call("PUT", `/events/${EVENT}/rsvp`, MALLORY, { status: "GOING" });
    expect(res.status).toBe(404);
    expect(prismaMock.eventRsvp.upsert).not.toHaveBeenCalled();
  });

  it("PATCH /events/:id", async () => {
    const res = await call("PATCH", `/events/${EVENT}`, MALLORY, { startsAt: future(48) });
    expect(res.status).toBe(404);
    expect(prismaMock.event.update).not.toHaveBeenCalled();
  });

  it("DELETE /events/:id", async () => {
    const res = await call("DELETE", `/events/${EVENT}`, MALLORY);
    expect(res.status).toBe(404);
    expect(prismaMock.event.delete).not.toHaveBeenCalled();
  });

  it("returns 404 for an event that does not exist", async () => {
    const res = await call("PUT", `/events/missing/rsvp`, ALICE, { status: "GOING" });
    expect(res.status).toBe(404);
  });
});

describe("PUT /events/:id/rsvp", () => {
  it("upserts on (eventId, userId) with the given status", async () => {
    prismaMock.eventRsvp.upsert.mockResolvedValue({ eventId: EVENT, userId: BOB, status: "MAYBE" });

    const res = await call("PUT", `/events/${EVENT}/rsvp`, BOB, { status: "MAYBE" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ eventId: EVENT, status: "MAYBE" });
    expect(prismaMock.eventRsvp.upsert).toHaveBeenCalledWith({
      where: { eventId_userId: { eventId: EVENT, userId: BOB } },
      update: { status: "MAYBE" },
      create: { eventId: EVENT, userId: BOB, status: "MAYBE" },
    });
  });

  it("syncs the user's reminder after every RSVP change", async () => {
    prismaMock.eventRsvp.upsert.mockResolvedValue({ eventId: EVENT, userId: BOB, status: "NOT_GOING" });
    await call("PUT", `/events/${EVENT}/rsvp`, BOB, { status: "NOT_GOING" });
    expect(reminderSync.syncReminder).toHaveBeenCalledWith(EVENT, BOB);
  });

  it("changing an RSVP reuses the same upsert key", async () => {
    prismaMock.eventRsvp.upsert
      .mockResolvedValueOnce({ eventId: EVENT, userId: BOB, status: "GOING" })
      .mockResolvedValueOnce({ eventId: EVENT, userId: BOB, status: "NOT_GOING" });

    await call("PUT", `/events/${EVENT}/rsvp`, BOB, { status: "GOING" });
    await call("PUT", `/events/${EVENT}/rsvp`, BOB, { status: "NOT_GOING" });

    const [first, second] = prismaMock.eventRsvp.upsert.mock.calls.map((c) => c[0]);
    expect(first.where).toEqual(second.where);
    expect(second.update).toEqual({ status: "NOT_GOING" });
  });

  it("rejects an invalid status", async () => {
    const res = await call("PUT", `/events/${EVENT}/rsvp`, BOB, { status: "YES" });
    expect(res.status).toBe(400);
    expect(prismaMock.eventRsvp.upsert).not.toHaveBeenCalled();
  });
});

describe("POST /groups/:id/events", () => {
  it("creates the event with the creator RSVP'd GOING", async () => {
    const body = validEvent();
    prismaMock.event.create.mockImplementation(async ({ data }) => ({
      id: EVENT,
      groupId: GROUP,
      creatorId: ALICE,
      title: data.title,
      category: data.category,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      description: null,
      voiceChannelId: data.voiceChannelId,
      creator: { id: ALICE, username: "Alice" },
      rsvps: [{ userId: ALICE, status: "GOING" }],
    }));

    const res = await call("POST", `/groups/${GROUP}/events`, ALICE, body);

    expect(res.status).toBe(201);
    const data = prismaMock.event.create.mock.calls[0][0].data;
    expect(data.rsvps).toEqual({ create: { userId: ALICE, status: "GOING" } });
    expect(data.creatorId).toBe(ALICE);
    // Creator's GOING reminder is scheduled and the event is announced
    expect(reminderSync.syncReminder).toHaveBeenCalledWith(EVENT, ALICE);
    expect(announceEvent).toHaveBeenCalledWith(EVENT);
    const json = await res.json();
    expect(json.myStatus).toBe("GOING");
    expect(json.counts).toEqual({ GOING: 1, MAYBE: 0, NOT_GOING: 0 });
  });

  it("accepts a voiceChannelId that is one of the group's meeting channels", async () => {
    prismaMock.meetingChannel.findUnique.mockResolvedValue({ groupId: GROUP, channelId: "vc1" });
    prismaMock.event.create.mockImplementation(async ({ data }) => ({
      ...data,
      id: EVENT,
      creator: { id: ALICE, username: "Alice" },
      rsvps: [],
    }));

    const res = await call("POST", `/groups/${GROUP}/events`, ALICE, { ...validEvent(), voiceChannelId: "vc1" });

    expect(res.status).toBe(201);
    expect(prismaMock.meetingChannel.findUnique).toHaveBeenCalledWith({
      where: { groupId_channelId: { groupId: GROUP, channelId: "vc1" } },
    });
    expect(prismaMock.event.create.mock.calls[0][0].data.voiceChannelId).toBe("vc1");
  });

  it("rejects a voiceChannelId that is not a meeting channel of the group", async () => {
    prismaMock.meetingChannel.findUnique.mockResolvedValue(null);
    const res = await call("POST", `/groups/${GROUP}/events`, ALICE, { ...validEvent(), voiceChannelId: "random" });
    expect(res.status).toBe(400);
    expect(prismaMock.event.create).not.toHaveBeenCalled();
  });

  it.each([
    ["empty title", { title: "   " }],
    ["title over 100 chars", { title: "x".repeat(101) }],
    ["bad category", { category: "PARTY" }],
    ["end before start", { startsAt: future(26), endsAt: future(24) }],
    ["start in the past", { startsAt: future(-1), endsAt: future(1) }],
  ])("rejects %s", async (_label, override) => {
    const res = await call("POST", `/groups/${GROUP}/events`, ALICE, { ...validEvent(), ...override });
    expect(res.status).toBe(400);
    expect(prismaMock.event.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /events/:id", () => {
  beforeEach(() => {
    prismaMock.event.update.mockImplementation(async ({ data }) => ({
      id: EVENT,
      groupId: GROUP,
      creatorId: ALICE,
      title: "Raid night",
      category: "GAMING",
      description: null,
      voiceChannelId: null,
      creator: { id: ALICE, username: "Alice" },
      rsvps: [],
      ...data,
    }));
  });

  it("lets the creator move the event and recomputes reminders", async () => {
    const res = await call("PATCH", `/events/${EVENT}`, ALICE, { startsAt: future(48), endsAt: future(50) });
    expect(res.status).toBe(200);
    expect(reminderSync.recomputeEventReminders).toHaveBeenCalledWith(EVENT);
  });

  it("lets the group owner move the event", async () => {
    expect((await call("PATCH", `/events/${EVENT}`, OWEN, { startsAt: future(25) })).status).toBe(200);
  });

  it("does not recompute when only the end time changes", async () => {
    expect((await call("PATCH", `/events/${EVENT}`, ALICE, { endsAt: future(30) })).status).toBe(200);
    expect(reminderSync.recomputeEventReminders).not.toHaveBeenCalled();
  });

  it("forbids other members", async () => {
    expect((await call("PATCH", `/events/${EVENT}`, BOB, { startsAt: future(48) })).status).toBe(403);
    expect(prismaMock.event.update).not.toHaveBeenCalled();
  });

  it.each([
    ["start in the past", { startsAt: future(-1) }],
    ["end before start", { endsAt: future(23) }],
    ["no fields", {}],
  ])("rejects %s", async (_label, body) => {
    expect((await call("PATCH", `/events/${EVENT}`, ALICE, body)).status).toBe(400);
    expect(prismaMock.event.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /events/:id", () => {
  it("forbids a member who is not the creator or owner", async () => {
    const res = await call("DELETE", `/events/${EVENT}`, BOB);
    expect(res.status).toBe(403);
    expect(prismaMock.event.delete).not.toHaveBeenCalled();
  });

  it("allows the creator", async () => {
    const res = await call("DELETE", `/events/${EVENT}`, ALICE);
    expect(res.status).toBe(200);
    expect(prismaMock.event.delete).toHaveBeenCalledWith({ where: { id: EVENT } });
  });

  it("allows the group owner", async () => {
    const res = await call("DELETE", `/events/${EVENT}`, OWEN);
    expect(res.status).toBe(200);
  });
});
