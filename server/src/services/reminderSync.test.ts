import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  eventRsvp: { findUnique: vi.fn(), findMany: vi.fn() },
  user: { findUnique: vi.fn() },
  reminder: { deleteMany: vi.fn(), upsert: vi.fn() },
}));
vi.mock("../db", () => ({ prisma: prismaMock }));

import { recomputeEventReminders, recomputeUserReminders, syncReminder } from "./reminderSync";

const START = new Date(Date.now() + 24 * 3_600_000);

function setup(status: string | null, reminderMinutes = 15, startsAt = START) {
  prismaMock.event.findUnique.mockResolvedValue({ startsAt });
  prismaMock.eventRsvp.findUnique.mockResolvedValue(status ? { status } : null);
  prismaMock.user.findUnique.mockResolvedValue({ reminderMinutes });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("syncReminder", () => {
  it.each(["GOING", "MAYBE"])("upserts a reminder at start minus lead time for %s", async (status) => {
    setup(status);
    const sendAt = new Date(START.getTime() - 15 * 60_000);

    expect(await syncReminder("e1", "u1")).toEqual(sendAt);

    expect(prismaMock.reminder.upsert).toHaveBeenCalledWith({
      where: { eventId_userId_sendAt: { eventId: "e1", userId: "u1", sendAt } },
      create: { eventId: "e1", userId: "u1", sendAt },
      update: {},
    });
    // Unsent reminders at any other time are removed
    expect(prismaMock.reminder.deleteMany).toHaveBeenCalledWith({
      where: { eventId: "e1", userId: "u1", sentAt: null, sendAt: { not: sendAt } },
    });
  });

  it("uses the user's own lead time", async () => {
    setup("GOING", 60);
    expect(await syncReminder("e1", "u1")).toEqual(new Date(START.getTime() - 60 * 60_000));
  });

  it("removes unsent reminders for NOT_GOING", async () => {
    setup("NOT_GOING");
    expect(await syncReminder("e1", "u1")).toBeNull();
    expect(prismaMock.reminder.deleteMany).toHaveBeenCalledWith({
      where: { eventId: "e1", userId: "u1", sentAt: null },
    });
    expect(prismaMock.reminder.upsert).not.toHaveBeenCalled();
  });

  it("removes unsent reminders when there is no RSVP", async () => {
    setup(null);
    await syncReminder("e1", "u1");
    expect(prismaMock.reminder.upsert).not.toHaveBeenCalled();
    expect(prismaMock.reminder.deleteMany).toHaveBeenCalled();
  });

  it("does not schedule a reminder for an event that already started", async () => {
    setup("GOING", 15, new Date(Date.now() - 60_000));
    expect(await syncReminder("e1", "u1")).toBeNull();
    expect(prismaMock.reminder.upsert).not.toHaveBeenCalled();
  });

  it("ignores a unique conflict from a concurrent sync", async () => {
    setup("GOING");
    prismaMock.reminder.upsert.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "6" })
    );
    await expect(syncReminder("e1", "u1")).resolves.toBeInstanceOf(Date);
  });
});

describe("recompute helpers", () => {
  it("re-syncs every RSVP on an event", async () => {
    setup("GOING");
    prismaMock.eventRsvp.findMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);
    await recomputeEventReminders("e1");
    expect(prismaMock.reminder.upsert).toHaveBeenCalledTimes(2);
  });

  it("re-syncs a user's upcoming GOING/MAYBE events", async () => {
    setup("MAYBE");
    prismaMock.eventRsvp.findMany.mockResolvedValue([{ eventId: "e1" }, { eventId: "e2" }]);
    await recomputeUserReminders("u1");
    expect(prismaMock.eventRsvp.findMany.mock.calls[0][0].where).toMatchObject({
      userId: "u1",
      status: { in: ["GOING", "MAYBE"] },
    });
    expect(prismaMock.reminder.upsert).toHaveBeenCalledTimes(2);
  });
});
