import type { APIEmbed, Client } from "discord.js";

// Discord renders these in each viewer's own timezone
export function discordTimestamp(date: Date, style: "F" | "R" | "t") {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

type EmbedEvent = {
  title: string;
  category: string;
  startsAt: Date;
  endsAt: Date;
  voiceChannelId: string | null;
};

const BLURPLE = 0x5865f2;

function eventFields(event: EmbedEvent, groupName: string) {
  const fields = [
    {
      name: "When",
      value: `${discordTimestamp(event.startsAt, "F")} (${discordTimestamp(event.startsAt, "R")}), until ${discordTimestamp(event.endsAt, "t")}`,
    },
    { name: "Group", value: groupName, inline: true },
    { name: "Category", value: event.category, inline: true },
  ];
  if (event.voiceChannelId) {
    fields.push({ name: "Voice channel", value: `<#${event.voiceChannelId}>`, inline: true });
  }
  return fields;
}

export function reminderEmbed(event: EmbedEvent, groupName: string): APIEmbed {
  return {
    title: `⏰ Reminder: ${event.title}`,
    color: BLURPLE,
    fields: eventFields(event, groupName),
  };
}

export function announcementEmbed(
  event: EmbedEvent & { description: string | null },
  groupName: string,
  creatorName: string
): APIEmbed {
  const clientUrl = process.env.CLIENT_URL;
  return {
    title: `📅 New event: ${event.title}`,
    color: BLURPLE,
    description: event.description ?? undefined,
    url: clientUrl || undefined,
    fields: [
      ...eventFields(event, groupName),
      { name: "Created by", value: creatorName, inline: true },
    ],
  };
}

// Delivery primitives; both throw on failure so callers can fall back
export type MessageSender = {
  sendDm(discordUserId: string, embed: APIEmbed): Promise<void>;
  sendToChannel(channelId: string, embed: APIEmbed, mentionDiscordUserId?: string): Promise<void>;
};

export function botSender(bot: Client<true>): MessageSender {
  return {
    async sendDm(discordUserId, embed) {
      const user = await bot.users.fetch(discordUserId);
      await user.send({ embeds: [embed] });
    },
    async sendToChannel(channelId, embed, mentionDiscordUserId) {
      const channel = await bot.channels.fetch(channelId);
      if (!channel?.isSendable()) throw new Error(`Channel ${channelId} is not sendable`);
      await channel.send({
        content: mentionDiscordUserId ? `<@${mentionDiscordUserId}>` : undefined,
        embeds: [embed],
        // Only ping the reminded user, never @everyone or roles from event text
        allowedMentions: { users: mentionDiscordUserId ? [mentionDiscordUserId] : [] },
      });
    },
  };
}
