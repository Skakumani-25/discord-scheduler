import { Router } from "express";
import { prisma } from "../db";
import { decryptSecret } from "../services/tokenCrypto";
import { botInviteUrl, canManageFromPermissions, fetchUserGuilds } from "../services/discordApi";
import { requireBot } from "../services/discordBot";

const router = Router();

const REAUTH = { error: "Please log in with Discord again to load your servers", reauth: true };

// My Discord servers that the bot is also in, with any linked group
router.get("/guilds", async (_req, res) => {
  const userId = res.locals.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { discordAccessToken: true, discordTokenExpiresAt: true },
  });
  const accessToken = user?.discordAccessToken ? decryptSecret(user.discordAccessToken) : null;
  if (!accessToken || !user?.discordTokenExpiresAt || user.discordTokenExpiresAt <= new Date()) {
    res.status(401).json(REAUTH);
    return;
  }

  const bot = requireBot();
  const result = await fetchUserGuilds(accessToken);
  if (!result.ok) {
    if (result.reason === "unauthorized") res.status(401).json(REAUTH);
    else res.status(502).json({ error: "Could not reach Discord, try again shortly" });
    return;
  }

  const shared = result.guilds.filter((g) => bot.guilds.cache.has(g.id));
  const groups = await prisma.group.findMany({
    where: { discordGuildId: { in: shared.map((g) => g.id) } },
    select: { id: true, discordGuildId: true, members: { where: { userId }, select: { id: true } } },
  });
  const groupByGuild = new Map(groups.map((g) => [g.discordGuildId, g]));

  res.json(
    shared.map((g) => {
      const group = groupByGuild.get(g.id);
      return {
        id: g.id,
        name: g.name,
        icon: g.icon,
        canManage: canManageFromPermissions(g),
        group: group ? { id: group.id, isMember: group.members.length > 0 } : null,
      };
    })
  );
});

// Link for adding the bot to a server
router.get("/invite-url", (_req, res) => {
  const url = botInviteUrl();
  if (!url) {
    res.status(503).json({ error: "DISCORD_CLIENT_ID is not configured" });
    return;
  }
  res.json({ url });
});

export default router;
