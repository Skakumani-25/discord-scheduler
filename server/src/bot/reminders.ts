import cron, { type ScheduledTask } from "node-cron";
import { prisma } from "../db";
import { getBot } from "./client";
import { botSender, reminderEmbed, type MessageSender } from "./messages";

const BATCH_SIZE = 100;

export type ReminderRunResult = {
  dm: number;
  channel: number;
  undelivered: number;
  skipped: number;
};

/**
 * Sends every due reminder at most once. Each reminder is claimed with a conditional
 * update (sentAt: null -> now) before anything is sent, so overlapping runs, or several
 * server processes, can never deliver the same reminder twice. A claimed reminder that
 * fails to deliver stays marked as sent; we prefer a missed reminder to a duplicate.
 */
export async function processDueReminders(
  sender: MessageSender,
  now = new Date()
): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { dm: 0, channel: 0, undelivered: 0, skipped: 0 };

  const due = await prisma.reminder.findMany({
    where: { sentAt: null, sendAt: { lte: now } },
    orderBy: { sendAt: "asc" },
    take: BATCH_SIZE,
    select: { id: true },
  });

  for (const { id } of due) {
    const claim = await prisma.reminder.updateMany({
      where: { id, sentAt: null },
      data: { sentAt: now },
    });
    if (claim.count !== 1) continue; // another run got it first

    try {
      result[await deliver(id, sender, now)]++;
    } catch (err) {
      // Keep going so one bad reminder can't block the rest of the batch
      console.error(`Reminder ${id} failed:`, (err as Error).message);
      result.undelivered++;
    }
  }
  return result;
}

async function deliver(
  reminderId: string,
  sender: MessageSender,
  now: Date
): Promise<keyof ReminderRunResult> {
  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
    select: {
      user: { select: { discordId: true } },
      event: {
        select: {
          title: true,
          category: true,
          startsAt: true,
          endsAt: true,
          voiceChannelId: true,
          group: { select: { name: true, type: true, announcementChannelId: true } },
        },
      },
    },
  });
  // Event deleted after the claim, or long over (e.g. the bot was offline)
  if (!reminder || reminder.event.endsAt <= now) return "skipped";

  const { event, user } = reminder;
  const embed = reminderEmbed(event, event.group.name);

  try {
    await sender.sendDm(user.discordId, embed);
    return "dm";
  } catch (dmErr) {
    const fallback =
      event.group.type === "DISCORD_SERVER" ? event.group.announcementChannelId : null;
    if (fallback) {
      try {
        await sender.sendToChannel(fallback, embed, user.discordId);
        return "channel";
      } catch (channelErr) {
        console.error(
          `Reminder ${reminderId}: DM and channel fallback both failed:`,
          (channelErr as Error).message
        );
        return "undelivered";
      }
    }
    console.warn(
      `Reminder ${reminderId}: DM failed and no announcement channel is set:`,
      (dmErr as Error).message
    );
    return "undelivered";
  }
}

let task: ScheduledTask | null = null;

// Runs every minute; ticks are skipped (reminders stay queued) while the bot is offline
export function startReminderScheduler() {
  if (task) return task;
  task = cron.schedule(
    "* * * * *",
    async () => {
      const bot = getBot();
      if (!bot) return;
      try {
        const r = await processDueReminders(botSender(bot));
        const total = r.dm + r.channel + r.undelivered + r.skipped;
        if (total > 0) console.log("Reminders processed:", r);
      } catch (err) {
        console.error("Reminder run failed:", (err as Error).message);
      }
    },
    { noOverlap: true }
  );
  return task;
}

export function stopReminderScheduler() {
  task?.stop();
  task = null;
}
