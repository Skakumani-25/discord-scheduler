import { prisma } from "../db";
import { getBot } from "./client";
import { announcementEmbed, botSender, type MessageSender } from "./messages";

// Posts a new event to its server group's announcement channel, if one is configured.
// Never throws: a failed announcement must not fail event creation.
export async function announceEvent(eventId: string, sender?: MessageSender) {
  try {
    const bot = getBot();
    const send = sender ?? (bot ? botSender(bot) : null);
    if (!send) return false;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        title: true,
        category: true,
        startsAt: true,
        endsAt: true,
        description: true,
        voiceChannelId: true,
        creator: { select: { username: true } },
        group: { select: { name: true, type: true, announcementChannelId: true } },
      },
    });
    const channelId = event?.group.type === "DISCORD_SERVER" ? event.group.announcementChannelId : null;
    if (!event || !channelId) return false;

    await send.sendToChannel(channelId, announcementEmbed(event, event.group.name, event.creator.username));
    return true;
  } catch (err) {
    console.error(`Announcing event ${eventId} failed:`, (err as Error).message);
    return false;
  }
}
