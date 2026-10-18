import type { Client } from "discord.js";
import { getBot } from "./client";

export type Presence = "online" | "idle" | "dnd" | "offline" | "unknown";

/**
 * Live Discord presence for each Discord user ID, read only from the bot's caches
 * (filled by the gateway; this never calls the Discord API).
 *
 * - "unknown": the bot shares no server with the user, or the server is too large for
 *   its member list to be cached and the user isn't online (see warmMemberCache).
 * - Limitation: Discord reports users set to Invisible exactly like offline users, so
 *   they show as "offline". There is no way to tell the two apart.
 *
 * Presence is account-wide, so any shared server works; `preferGuildId` (a server
 * group's own guild) is checked first only as a shortcut.
 */
export function getPresence(
  discordIds: string[],
  options: { preferGuildId?: string | null } = {},
  bot: Client<true> | null = getBot()
): Map<string, Presence> {
  const result = new Map<string, Presence>();
  if (!bot) {
    for (const id of discordIds) result.set(id, "unknown");
    return result;
  }

  const guilds = [...bot.guilds.cache.values()];
  if (options.preferGuildId) {
    guilds.sort((a, b) => Number(b.id === options.preferGuildId) - Number(a.id === options.preferGuildId));
  }

  for (const id of discordIds) {
    let presence: Presence = "unknown";
    for (const guild of guilds) {
      const status = guild.presences.cache.get(id)?.status;
      if (status) {
        presence = status === "invisible" ? "offline" : status;
        break;
      }
      // A cached member with no presence entry is offline (or invisible)
      if (guild.members.cache.has(id)) {
        presence = "offline";
        break;
      }
    }
    result.set(id, presence);
  }
  return result;
}
