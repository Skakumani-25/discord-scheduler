import { Router } from "express";
import { Category, RsvpStatus } from "@prisma/client";
import { prisma } from "../db";
import { recomputeEventReminders, syncReminder } from "../services/reminderSync";
import { announceEvent } from "../bot/announcements";

const router = Router();

const MAX_DESCRIPTION = 1000;

function getMembership(groupId: string, userId: string) {
  return prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
}

type EventWithRsvps = {
  id: string;
  groupId: string;
  creatorId: string;
  title: string;
  category: Category;
  startsAt: Date;
  endsAt: Date;
  description: string | null;
  voiceChannelId: string | null;
  creator: { id: string; username: string };
  rsvps: { userId: string; status: RsvpStatus }[];
};

// Shape returned to the client: counts plus the caller's own status
function serializeEvent(event: EventWithRsvps, userId: string, isOwner: boolean) {
  const counts = { GOING: 0, MAYBE: 0, NOT_GOING: 0 };
  for (const r of event.rsvps) counts[r.status]++;
  return {
    id: event.id,
    groupId: event.groupId,
    title: event.title,
    category: event.category,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    description: event.description,
    voiceChannelId: event.voiceChannelId,
    creator: event.creator,
    counts,
    myStatus: event.rsvps.find((r) => r.userId === userId)?.status ?? null,
    canDelete: event.creatorId === userId || isOwner,
  };
}

const eventInclude = {
  creator: { select: { id: true, username: true } },
  rsvps: { select: { userId: true, status: true } },
} as const;

// Create an event in a group (members only); creator is RSVP'd GOING
router.post("/groups/:id/events", async (req, res) => {
  const userId = res.locals.userId;
  const membership = await getMembership(req.params.id, userId);
  if (!membership) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { title: rawTitle, category, startsAt, endsAt, description, voiceChannelId } =
    req.body ?? {};
  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (!title || title.length > 100) {
    res.status(400).json({ error: "Title must be 1 to 100 characters" });
    return;
  }
  if (!Object.values(Category).includes(category)) {
    res.status(400).json({ error: "Invalid category" });
    return;
  }
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    res.status(400).json({ error: "End time must be after start time" });
    return;
  }
  if (start <= new Date()) {
    res.status(400).json({ error: "Start time must be in the future" });
    return;
  }
  if (
    description !== undefined &&
    description !== null &&
    (typeof description !== "string" || description.length > MAX_DESCRIPTION)
  ) {
    res.status(400).json({ error: `Description must be text of at most ${MAX_DESCRIPTION} characters` });
    return;
  }

  // Optional, but must be one of the group's meeting channels
  let channelId: string | null = null;
  if (voiceChannelId !== undefined && voiceChannelId !== null && voiceChannelId !== "") {
    const meetingChannel =
      typeof voiceChannelId === "string"
        ? await prisma.meetingChannel.findUnique({
            where: { groupId_channelId: { groupId: req.params.id, channelId: voiceChannelId } },
          })
        : null;
    if (!meetingChannel) {
      res.status(400).json({ error: "Voice channel must be one of this group's meeting channels" });
      return;
    }
    channelId = meetingChannel.channelId;
  }

  const event = await prisma.event.create({
    data: {
      groupId: req.params.id,
      creatorId: userId,
      title,
      category,
      startsAt: start,
      endsAt: end,
      description:
        typeof description === "string" && description.trim() ? description.trim() : null,
      voiceChannelId: channelId,
      rsvps: { create: { userId, status: RsvpStatus.GOING } },
    },
    include: eventInclude,
  });
  await syncReminder(event.id, userId);
  // Fire and forget; announceEvent never throws
  void announceEvent(event.id);
  res.status(201).json(serializeEvent(event, userId, membership.role === "OWNER"));
});

// Upcoming (and in-progress) events in a group (members only)
router.get("/groups/:id/events", async (req, res) => {
  const userId = res.locals.userId;
  const membership = await getMembership(req.params.id, userId);
  if (!membership) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const events = await prisma.event.findMany({
    where: { groupId: req.params.id, endsAt: { gt: new Date() } },
    include: eventInclude,
    orderBy: { startsAt: "asc" },
  });
  const isOwner = membership.role === "OWNER";
  res.json(events.map((e) => serializeEvent(e, userId, isOwner)));
});

// Set my RSVP (members of the event's group only)
router.put("/events/:id/rsvp", async (req, res) => {
  const userId = res.locals.userId;
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    select: { id: true, groupId: true },
  });
  if (!event || !(await getMembership(event.groupId, userId))) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const status = req.body?.status;
  if (!Object.values(RsvpStatus).includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const rsvp = await prisma.eventRsvp.upsert({
    where: { eventId_userId: { eventId: event.id, userId } },
    update: { status },
    create: { eventId: event.id, userId, status },
  });
  // Creates/moves the reminder for GOING or MAYBE, removes unsent ones for NOT_GOING
  await syncReminder(event.id, userId);
  res.json({ eventId: rsvp.eventId, status: rsvp.status });
});

// Change an event's time (creator or group OWNER only); reminders follow the new start
router.patch("/events/:id", async (req, res) => {
  const userId = res.locals.userId;
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    select: { id: true, groupId: true, creatorId: true, startsAt: true, endsAt: true },
  });
  const membership = event && (await getMembership(event.groupId, userId));
  if (!event || !membership) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (event.creatorId !== userId && membership.role !== "OWNER") {
    res.status(403).json({ error: "Only the creator or group owner can edit this event" });
    return;
  }

  const { startsAt, endsAt } = req.body ?? {};
  if (startsAt === undefined && endsAt === undefined) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  const start = startsAt === undefined ? event.startsAt : new Date(startsAt);
  const end = endsAt === undefined ? event.endsAt : new Date(endsAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    res.status(400).json({ error: "End time must be after start time" });
    return;
  }
  const startChanged = start.getTime() !== event.startsAt.getTime();
  if (startChanged && start <= new Date()) {
    res.status(400).json({ error: "Start time must be in the future" });
    return;
  }

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { startsAt: start, endsAt: end },
    include: eventInclude,
  });
  if (startChanged) await recomputeEventReminders(event.id);
  res.json(serializeEvent(updated, userId, membership.role === "OWNER"));
});

// Delete an event (creator or group OWNER only)
router.delete("/events/:id", async (req, res) => {
  const userId = res.locals.userId;
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    select: { id: true, groupId: true, creatorId: true },
  });
  const membership = event && (await getMembership(event.groupId, userId));
  if (!event || !membership) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (event.creatorId !== userId && membership.role !== "OWNER") {
    res.status(403).json({ error: "Only the creator or group owner can delete this event" });
    return;
  }
  // Reminders are removed by the cascade
  await prisma.event.delete({ where: { id: event.id } });
  res.json({ ok: true });
});

export default router;
