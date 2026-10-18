import { Router, type Response } from "express";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import {
  fetchGuildMember,
  getBotGuild,
  getVoiceChannel,
  listVoiceChannels,
  memberCanManageGuild,
  requireBot,
} from "../services/discordBot";

// Groups backed by a Discord server, mounted at /api/groups alongside routes/groups.ts
const router = Router();

const SNOWFLAKE = /^\d{17,20}$/;

async function getDiscordId(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { discordId: true } });
  return user?.discordId ?? null;
}

// Resolves the guild and confirms with Discord that the caller is in it; sends an error otherwise
async function verifyGuildMembership(guildId: unknown, userId: string, res: Response) {
  if (typeof guildId !== "string" || !SNOWFLAKE.test(guildId)) {
    res.status(400).json({ error: "Invalid guildId" });
    return null;
  }
  requireBot();
  const guild = getBotGuild(guildId);
  if (!guild) {
    res.status(404).json({ error: "The bot is not in that server" });
    return null;
  }
  const discordId = await getDiscordId(userId);
  const member = discordId ? await fetchGuildMember(guild, discordId) : null;
  if (!member) {
    res.status(403).json({ error: "You are not a member of that server" });
    return null;
  }
  return guild;
}

// Create the group for a server (creator becomes OWNER)
router.post("/from-guild", async (req, res) => {
  const userId = res.locals.userId;
  const guild = await verifyGuildMembership(req.body?.guildId, userId, res);
  if (!guild) return;

  const existing = await prisma.group.findUnique({ where: { discordGuildId: guild.id } });
  if (existing) {
    res.status(409).json({ error: "This server already has a group", groupId: existing.id });
    return;
  }
  try {
    const group = await prisma.group.create({
      data: {
        name: guild.name.slice(0, 50),
        inviteCode: crypto.randomBytes(4).toString("hex").toUpperCase(),
        type: "DISCORD_SERVER",
        discordGuildId: guild.id,
        members: { create: { userId, role: "OWNER" } },
      },
    });
    res.status(201).json({ id: group.id, name: group.name });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      res.status(409).json({ error: "This server already has a group" });
      return;
    }
    throw err;
  }
});

// Join an existing server group (must be a member of the server)
router.post("/join-guild", async (req, res) => {
  const userId = res.locals.userId;
  const guild = await verifyGuildMembership(req.body?.guildId, userId, res);
  if (!guild) return;

  const group = await prisma.group.findUnique({ where: { discordGuildId: guild.id } });
  if (!group) {
    res.status(404).json({ error: "This server does not have a group yet" });
    return;
  }
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId } },
    update: {},
    create: { groupId: group.id, userId },
  });
  res.json({ id: group.id, name: group.name });
});

// Membership + DISCORD_SERVER check shared by the channel routes; sends an error otherwise
async function loadServerGroup(groupId: string, userId: string, res: Response) {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    include: { group: true },
  });
  if (!membership) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  const { group } = membership;
  if (group.type !== "DISCORD_SERVER" || !group.discordGuildId) {
    res.status(400).json({ error: "Only Discord server groups have meeting channels" });
    return null;
  }
  return { group, guildId: group.discordGuildId, role: membership.role };
}

// Group OWNER, or MANAGE_GUILD in the server (checked live through the bot)
async function canManageChannels(guildId: string, role: string, userId: string) {
  if (role === "OWNER") return true;
  const guild = getBotGuild(guildId);
  if (!guild) return false;
  const discordId = await getDiscordId(userId);
  const member = discordId ? await fetchGuildMember(guild, discordId) : null;
  return member ? memberCanManageGuild(member) : false;
}

router.get("/:id/meeting-channels", async (req, res) => {
  const userId = res.locals.userId;
  const ctx = await loadServerGroup(req.params.id, userId, res);
  if (!ctx) return;
  const channels = await prisma.meetingChannel.findMany({
    where: { groupId: ctx.group.id },
    select: { channelId: true, label: true },
    orderBy: { label: "asc" },
  });
  // Without the bot only the OWNER can be confirmed as a manager
  const canManage = await canManageChannels(ctx.guildId, ctx.role, userId).catch(() => false);
  res.json({ channels, canManage });
});

router.post("/:id/meeting-channels", async (req, res) => {
  const userId = res.locals.userId;
  const ctx = await loadServerGroup(req.params.id, userId, res);
  if (!ctx) return;
  requireBot();
  if (!(await canManageChannels(ctx.guildId, ctx.role, userId))) {
    res.status(403).json({ error: "Only the group owner or a server manager can change meeting channels" });
    return;
  }

  const { channelId, label: rawLabel } = req.body ?? {};
  const guild = getBotGuild(ctx.guildId);
  if (!guild) {
    res.status(409).json({ error: "The bot is no longer in this server" });
    return;
  }
  const channel = typeof channelId === "string" ? getVoiceChannel(guild, channelId) : null;
  if (!channel) {
    res.status(400).json({ error: "That is not a voice channel in this server" });
    return;
  }
  const label = (typeof rawLabel === "string" && rawLabel.trim()) || channel.name;
  if (label.length > 100) {
    res.status(400).json({ error: "Label must be at most 100 characters" });
    return;
  }

  try {
    const created = await prisma.meetingChannel.create({
      data: { groupId: ctx.group.id, channelId: channel.id, label },
      select: { channelId: true, label: true },
    });
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      res.status(409).json({ error: "That channel is already a meeting channel" });
      return;
    }
    throw err;
  }
});

router.delete("/:id/meeting-channels/:channelId", async (req, res) => {
  const userId = res.locals.userId;
  const ctx = await loadServerGroup(req.params.id, userId, res);
  if (!ctx) return;
  // OWNER can remove without the bot; anyone else needs it to check MANAGE_GUILD
  if (!(await canManageChannels(ctx.guildId, ctx.role, userId))) {
    res.status(403).json({ error: "Only the group owner or a server manager can change meeting channels" });
    return;
  }
  const result = await prisma.meetingChannel.deleteMany({
    where: { groupId: ctx.group.id, channelId: req.params.channelId },
  });
  if (result.count === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

// The server's voice channels, for the meeting channel picker
router.get("/:id/voice-channels", async (req, res) => {
  const ctx = await loadServerGroup(req.params.id, res.locals.userId, res);
  if (!ctx) return;
  requireBot();
  const guild = getBotGuild(ctx.guildId);
  if (!guild) {
    res.status(409).json({ error: "The bot is no longer in this server" });
    return;
  }
  res.json(listVoiceChannels(guild));
});

export default router;
