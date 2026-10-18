import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIEmbed } from "discord.js";

// In-memory stand-in for the Reminder table. updateMany is a check-and-set with no await
// between the check and the write, which is the same guarantee Postgres gives a
// single UPDATE ... WHERE "sentAt" IS NULL.
type Row = { id: string; eventId: string; userId: string; sendAt: Date; sentAt: Date | null };
type EventRow = {
  title: string;
  category: string;
  startsAt: Date;
  endsAt: Date;
  voiceChannelId: string | null;
  group: { name: string; type: "CUSTOM" | "DISCORD_SERVER"; announcementChannelId: string | null };
};

const db = vi.hoisted(() => ({
  reminders: [] as Row[],
  events: new Map<string, EventRow>(),
  users: new Map<string, { discordId: string }>(),
}));
const tick = () => new Promise((r) => setTimeout(r, 0));

const prismaMock = vi.hoisted(() => ({
  reminder: { findMany: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
}));
vi.mock("../db", () => ({ prisma: prismaMock }));
vi.mock("./client", () => ({ getBot: () => null }));

import { processDueReminders } from "./reminders";

const NOW = new Date("2030-01-01T12:00:00.000Z");
const mins = (n: number) => new Date(NOW.getTime() + n * 60_000);

function addEvent(id: string, overrides: Partial<EventRow> = {}) {
  db.events.set(id, {
    title: "Raid night",
    category: "GAMING",
    startsAt: mins(15),
    endsAt: mins(135),
    voiceChannelId: null,
    group: { name: "The Squad", type: "DISCORD_SERVER", announcementChannelId: null },
    ...overrides,
  });
}
function addReminder(id: string, eventId: string, userId: string, sendAt: Date, sentAt: Date | null = null) {
  db.reminders.push({ id, eventId, userId, sendAt, sentAt });
  if (!db.users.has(userId)) db.users.set(userId, { discordId: `discord-${userId}` });
}
const row = (id: string) => db.reminders.find((r) => r.id === id)!;

function makeSender() {
  return {
    sendDm: vi.fn<(discordUserId: string, embed: APIEmbed) => Promise<void>>().mockResolvedValue(undefined),
    sendToChannel: vi
      .fn<(channelId: string, embed: APIEmbed, mention?: string) => Promise<void>>()
      .mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.reminders = [];
  db.events.clear();
  db.users.clear();

  prismaMock.reminder.findMany.mockImplementation(
    async ({ where, take }: { where: { sendAt: { lte: Date } }; take: number }) => {
      await tick();
      return db.reminders
        .filter((r) => r.sentAt === null && r.sendAt <= where.sendAt.lte)
        .sort((a, b) => a.sendAt.getTime() - b.sendAt.getTime())
        .slice(0, take)
        .map((r) => ({ id: r.id }));
    }
  );
  prismaMock.reminder.updateMany.mockImplementation(
    async ({ where, data }: { where: { id: string; sentAt?: null }; data: { sentAt: Date } }) => {
      await tick();
      const r = db.reminders.find((x) => x.id === where.id);
      // Only filter on sentAt if the query asks to, like a real WHERE clause
      if (!r || ("sentAt" in where && r.sentAt !== null)) return { count: 0 };
      r.sentAt = data.sentAt;
      return { count: 1 };
    }
  );
  prismaMock.reminder.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
    await tick();
    const r = db.reminders.find((x) => x.id === where.id);
    const event = r && db.events.get(r.eventId);
    return r && event ? { user: db.users.get(r.userId)!, event } : null;
  });
});

describe("processDueReminders", () => {
  it("sends due reminders once, marks them sent, and leaves the rest alone", async () => {
    addEvent("e1");
    addReminder("due", "e1", "alice", mins(-1));
    addReminder("exactly-now", "e1", "bob", NOW);
    addReminder("future", "e1", "carol", mins(1));
    addReminder("already-sent", "e1", "dave", mins(-5), mins(-5));
    const sender = makeSender();

    const result = await processDueReminders(sender, NOW);

    expect(result).toEqual({ dm: 2, channel: 0, undelivered: 0, skipped: 0 });
    expect(sender.sendDm.mock.calls.map((c) => c[0]).sort()).toEqual(["discord-alice", "discord-bob"]);
    expect(row("due").sentAt).toEqual(NOW);
    expect(row("exactly-now").sentAt).toEqual(NOW);
    expect(row("future").sentAt).toBeNull();
  });

  it("claims with a conditional update on sentAt: null before sending", async () => {
    addEvent("e1");
    addReminder("r1", "e1", "alice", mins(-1));
    const sender = makeSender();
    sender.sendDm.mockImplementation(async () => {
      // By the time anything is sent, the row is already claimed
      expect(row("r1").sentAt).toEqual(NOW);
    });

    await processDueReminders(sender, NOW);

    expect(prismaMock.reminder.updateMany).toHaveBeenCalledWith({
      where: { id: "r1", sentAt: null },
      data: { sentAt: NOW },
    });
    expect(sender.sendDm).toHaveBeenCalledOnce();
  });

  it("never double-sends when runs overlap", async () => {
    addEvent("e1");
    for (let i = 0; i < 20; i++) addReminder(`r${i}`, "e1", `user${i}`, mins(-i));
    const sender = makeSender();

    // Three runs list the same due reminders and race to claim them
    const results = await Promise.all([
      processDueReminders(sender, NOW),
      processDueReminders(sender, NOW),
      processDueReminders(sender, NOW),
    ]);

    expect(sender.sendDm).toHaveBeenCalledTimes(20);
    const recipients = sender.sendDm.mock.calls.map((c) => c[0]);
    expect(new Set(recipients).size).toBe(20);
    expect(results.reduce((n, r) => n + r.dm, 0)).toBe(20);
  });

  it("skips a reminder another process claimed after it was listed", async () => {
    addEvent("e1");
    addReminder("r1", "e1", "alice", mins(-1));
    prismaMock.reminder.findMany.mockImplementationOnce(async () => {
      const ids = [{ id: "r1" }];
      row("r1").sentAt = mins(-0.5); // the other process wins
      return ids;
    });
    const sender = makeSender();

    const result = await processDueReminders(sender, NOW);

    expect(sender.sendDm).not.toHaveBeenCalled();
    expect(result).toEqual({ dm: 0, channel: 0, undelivered: 0, skipped: 0 });
  });

  it("falls back to the announcement channel with a mention when the DM fails", async () => {
    addEvent("e1", { group: { name: "The Squad", type: "DISCORD_SERVER", announcementChannelId: "announce" } });
    addReminder("r1", "e1", "alice", mins(-1));
    const sender = makeSender();
    sender.sendDm.mockRejectedValue(new Error("Cannot send messages to this user"));

    const result = await processDueReminders(sender, NOW);

    expect(result.channel).toBe(1);
    expect(sender.sendToChannel).toHaveBeenCalledWith("announce", expect.any(Object), "discord-alice");
  });

  it("logs and marks sent when the DM fails and there is no announcement channel", async () => {
    addEvent("e1");
    addReminder("r1", "e1", "alice", mins(-1));
    const sender = makeSender();
    sender.sendDm.mockRejectedValue(new Error("Cannot send messages to this user"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const first = await processDueReminders(sender, NOW);
    const second = await processDueReminders(sender, mins(1));

    expect(first.undelivered).toBe(1);
    expect(warn).toHaveBeenCalled();
    expect(sender.sendToChannel).not.toHaveBeenCalled();
    expect(row("r1").sentAt).toEqual(NOW);
    // Not retried on the next run
    expect(second.undelivered).toBe(0);
    expect(sender.sendDm).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("does not use an announcement channel for custom groups", async () => {
    addEvent("e1", { group: { name: "Friends", type: "CUSTOM", announcementChannelId: "stale" } });
    addReminder("r1", "e1", "alice", mins(-1));
    const sender = makeSender();
    sender.sendDm.mockRejectedValue(new Error("DMs closed"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect((await processDueReminders(sender, NOW)).undelivered).toBe(1);
    expect(sender.sendToChannel).not.toHaveBeenCalled();
  });

  it("survives both the DM and the fallback failing", async () => {
    addEvent("e1", { group: { name: "The Squad", type: "DISCORD_SERVER", announcementChannelId: "announce" } });
    addReminder("r1", "e1", "alice", mins(-1));
    const sender = makeSender();
    sender.sendDm.mockRejectedValue(new Error("DMs closed"));
    sender.sendToChannel.mockRejectedValue(new Error("Missing Access"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await processDueReminders(sender, NOW);

    expect(result.undelivered).toBe(1);
    expect(row("r1").sentAt).toEqual(NOW);
  });

  it("skips reminders for events that have already ended", async () => {
    addEvent("old", { startsAt: mins(-180), endsAt: mins(-60) });
    addReminder("r1", "old", "alice", mins(-195));
    const sender = makeSender();

    const result = await processDueReminders(sender, NOW);

    expect(result.skipped).toBe(1);
    expect(sender.sendDm).not.toHaveBeenCalled();
    expect(row("r1").sentAt).toEqual(NOW);
  });

  it("keeps going when one reminder throws", async () => {
    addEvent("e1");
    addReminder("bad", "e1", "alice", mins(-2));
    addReminder("good", "e1", "bob", mins(-1));
    prismaMock.reminder.findUnique.mockRejectedValueOnce(new Error("connection reset"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sender = makeSender();

    const result = await processDueReminders(sender, NOW);

    expect(result).toMatchObject({ dm: 1, undelivered: 1 });
    expect(sender.sendDm).toHaveBeenCalledWith("discord-bob", expect.any(Object));
  });

  it("builds an embed with Discord timestamps, group name and voice channel", async () => {
    addEvent("e1", { voiceChannelId: "999" });
    addReminder("r1", "e1", "alice", mins(-1));
    const sender = makeSender();

    await processDueReminders(sender, NOW);

    const embed = sender.sendDm.mock.calls[0][1];
    const text = JSON.stringify(embed);
    const unix = Math.floor(mins(15).getTime() / 1000);
    expect(embed.title).toContain("Raid night");
    expect(text).toContain(`<t:${unix}:F>`);
    expect(text).toContain(`<t:${unix}:R>`);
    expect(text).toContain("The Squad");
    expect(text).toContain("<#999>");
  });
});
