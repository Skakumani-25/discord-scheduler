import { Prisma, type RsvpStatus } from "@prisma/client";
import { prisma } from "../db";

const REMINDED_STATUSES: RsvpStatus[] = ["GOING", "MAYBE"];

export function reminderSendAt(startsAt: Date, reminderMinutes: number) {
  return new Date(startsAt.getTime() - reminderMinutes * 60_000);
}

function deleteUnsent(eventId: string, userId: string, keepSendAt?: Date) {
  return prisma.reminder.deleteMany({
    where: {
      eventId,
      userId,
      sentAt: null,
      ...(keepSendAt && { sendAt: { not: keepSendAt } }),
    },
  });
}

/**
 * Brings one user's reminder for one event in line with their RSVP, the event's start
 * time and their lead time. Unsent reminders that no longer apply are removed; sent
 * ones are kept so a reminder is never re-sent for the same send time.
 */
export async function syncReminder(eventId: string, userId: string) {
  const [event, rsvp, user] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { startsAt: true } }),
    prisma.eventRsvp.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { status: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { reminderMinutes: true } }),
  ]);

  const wantsReminder =
    event && user && rsvp && REMINDED_STATUSES.includes(rsvp.status) && event.startsAt > new Date();
  if (!wantsReminder) {
    await deleteUnsent(eventId, userId);
    return null;
  }

  const sendAt = reminderSendAt(event.startsAt, user.reminderMinutes);
  await deleteUnsent(eventId, userId, sendAt);
  try {
    // update: {} leaves an already-sent reminder untouched
    await prisma.reminder.upsert({
      where: { eventId_userId_sendAt: { eventId, userId, sendAt } },
      create: { eventId, userId, sendAt },
      update: {},
    });
  } catch (err) {
    // A concurrent sync created the same row first
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
  }
  return sendAt;
}

// After an event's start time changes
export async function recomputeEventReminders(eventId: string) {
  const rsvps = await prisma.eventRsvp.findMany({ where: { eventId }, select: { userId: true } });
  for (const r of rsvps) await syncReminder(eventId, r.userId);
}

// After a user's lead time changes
export async function recomputeUserReminders(userId: string) {
  const rsvps = await prisma.eventRsvp.findMany({
    where: { userId, status: { in: REMINDED_STATUSES }, event: { startsAt: { gt: new Date() } } },
    select: { eventId: true },
  });
  for (const r of rsvps) await syncReminder(r.eventId, userId);
}
