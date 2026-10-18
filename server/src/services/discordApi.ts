import { PermissionFlagsBits } from "discord.js";

// Calls made with the user's OAuth token (as opposed to the bot)
const DISCORD_API = "https://discord.com/api/v10";

export type UserGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
};

export type UserGuildsResult =
  | { ok: true; guilds: UserGuild[] }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function fetchUserGuilds(accessToken: string): Promise<UserGuildsResult> {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds?limit=200`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) return { ok: false, reason: "unauthorized" };
  if (!res.ok) {
    console.error(`Discord guild list failed with status ${res.status}`);
    return { ok: false, reason: "unavailable" };
  }
  return { ok: true, guilds: (await res.json()) as UserGuild[] };
}

// MANAGE_GUILD from the permissions bitfield in /users/@me/guilds (owners and admins have it implicitly)
export function canManageFromPermissions(guild: Pick<UserGuild, "owner" | "permissions">) {
  if (guild.owner) return true;
  const bits = BigInt(guild.permissions);
  return (bits & (PermissionFlagsBits.ManageGuild | PermissionFlagsBits.Administrator)) !== 0n;
}

export const BOT_INVITE_PERMISSIONS =
  PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.Connect;

export function botInviteUrl(clientId = process.env.DISCORD_CLIENT_ID): string | null {
  if (!clientId) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "bot applications.commands",
    permissions: BOT_INVITE_PERMISSIONS.toString(),
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}
