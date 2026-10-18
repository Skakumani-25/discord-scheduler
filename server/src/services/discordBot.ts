import { ChannelType, PermissionFlagsBits, type Guild, type GuildMember } from "discord.js";
import { getBot } from "../bot/client";

// Discord API error code for "Unknown Member"
const UNKNOWN_MEMBER = 10007;

export class BotUnavailableError extends Error {
  constructor() {
    super("The Discord bot is not running");
  }
}

export function requireBot() {
  const bot = getBot();
  if (!bot) throw new BotUnavailableError();
  return bot;
}

export function getBotGuild(guildId: string): Guild | null {
  return requireBot().guilds.cache.get(guildId) ?? null;
}

// Asks Discord (not the client) whether the user is in the guild; null if not
export async function fetchGuildMember(guild: Guild, discordUserId: string): Promise<GuildMember | null> {
  try {
    return await guild.members.fetch(discordUserId);
  } catch (err) {
    if ((err as { code?: number }).code === UNKNOWN_MEMBER) return null;
    throw err;
  }
}

export function memberCanManageGuild(member: GuildMember) {
  // has() treats Administrator as granting everything
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}

export function listVoiceChannels(guild: Guild) {
  return [...guild.channels.cache.values()]
    .filter((c) => c.type === ChannelType.GuildVoice)
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ id: c.id, name: c.name }));
}

export function getVoiceChannel(guild: Guild, channelId: string) {
  const channel = guild.channels.cache.get(channelId);
  return channel && channel.type === ChannelType.GuildVoice ? channel : null;
}
