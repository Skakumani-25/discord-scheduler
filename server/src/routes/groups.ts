import { Router } from "express";
import crypto from "node:crypto";
import { Category } from "@prisma/client";
import { prisma } from "../db";
import { findOverlaps } from "../services/overlap";
import { statusSelect, withEffectiveStatus } from "../services/userStatus";
import { getPresence, type Presence } from "../bot/presence";

const router = Router();

type PresenceMember = { userId: string; user: { discordId: string; showPresence: boolean } };

// userId -> live presence, or null for members who hide it. Callers must already have
// checked that the viewer is in the group, so presence only reaches co-members.
function memberPresence(members: PresenceMember[], guildId: string | null) {
  const visible = members.filter((m) => m.user.showPresence);
  const live = getPresence(
    visible.map((m) => m.user.discordId),
    { preferGuildId: guildId }
  );
  const out: Record<string, Presence | null> = {};
  for (const m of members) out[m.userId] = m.user.showPresence ? live.get(m.user.discordId)! : null;
  return out;
}

// One week
const MAX_MIN_MINUTES = 7 * 24 * 60;

// My groups
router.get("/", async (_req, res) => {
  const memberships = await prisma.groupMember.findMany({
    where: { userId: res.locals.userId },
    include: { group: { include: { _count: { select: { members: true } } } } },
    orderBy: { joinedAt: "asc" },
  });
  res.json(
    memberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      inviteCode: m.group.inviteCode,
      type: m.group.type,
      role: m.role,
      memberCount: m.group._count.members,
    }))
  );
});

// Create a group (creator becomes OWNER)
router.post("/", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name || name.length > 50) {
    res.status(400).json({ error: "Name must be 1 to 50 characters" });
    return;
  }
  const group = await prisma.group.create({
    data: {
      name,
      inviteCode: crypto.randomBytes(4).toString("hex").toUpperCase(),
      members: { create: { userId: res.locals.userId, role: "OWNER" } },
    },
  });
  res.status(201).json(group);
});

// Join with an invite code
router.post("/join", async (req, res) => {
  const code =
    typeof req.body?.code === "string" ? req.body.code.trim().toUpperCase() : "";
  const group = await prisma.group.findUnique({ where: { inviteCode: code } });
  if (!group) {
    res.status(404).json({ error: "Invalid invite code" });
    return;
  }
  // Server groups are joined through Discord so membership is verified
  if (group.type === "DISCORD_SERVER") {
    res.status(400).json({ error: "Join Discord server groups from the Discord servers panel" });
    return;
  }
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: res.locals.userId } },
    update: {},
    create: { groupId: group.id, userId: res.locals.userId },
  });
  res.json({ id: group.id, name: group.name });
});

// Group details: members plus their upcoming availability (members only)
router.get("/:id", async (req, res) => {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: req.params.id, userId: res.locals.userId } },
  });
  if (!membership) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const group = await prisma.group.findUnique({
    where: { id: req.params.id },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
              discordId: true,
              showPresence: true,
              ...statusSelect,
            },
          },
        },
      },
    },
  });
  if (!group) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const now = new Date();
  const presence = memberPresence(group.members, group.discordGuildId);
  const blocks = await prisma.availabilityBlock.findMany({
    where: {
      userId: { in: group.members.map((m) => m.userId) },
      endsAt: { gte: now },
    },
    orderBy: { startsAt: "asc" },
  });
  res.json({
    id: group.id,
    name: group.name,
    inviteCode: group.inviteCode,
    type: group.type,
    discordGuildId: group.discordGuildId,
    announcementChannelId: group.announcementChannelId,
    role: membership.role,
    // user.status: their current status, or null if unset/expired
    // user.presence: live Discord presence, or null if they hide it
    members: group.members.map(({ user: { showPresence: _hidden, ...user }, ...m }) => ({
      ...m,
      user: { ...withEffectiveStatus(user, now), presence: presence[m.userId] },
    })),
    blocks,
  });
});

// Just the live presence map { userId: presence | null }, for polling (members only)
router.get("/:id/presence", async (req, res) => {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: req.params.id, userId: res.locals.userId } },
    include: {
      group: {
        select: {
          discordGuildId: true,
          members: {
            select: { userId: true, user: { select: { discordId: true, showPresence: true } } },
          },
        },
      },
    },
  });
  if (!membership) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(memberPresence(membership.group.members, membership.group.discordGuildId));
});

// Shared free windows across members (members only)
// Query: category (Category or ALL, default ALL), minMinutes (default 30), userIds (comma-separated subset)
router.get("/:id/overlaps", async (req, res) => {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: req.params.id, userId: res.locals.userId } },
  });
  if (!membership) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { category: rawCategory, minMinutes: rawMin, userIds: rawUserIds } = req.query;

  const category = typeof rawCategory === "string" && rawCategory ? rawCategory : "ALL";
  if (category !== "ALL" && !Object.values(Category).includes(category as Category)) {
    res.status(400).json({ error: "Invalid category" });
    return;
  }

  let minMinutes = 30;
  if (rawMin !== undefined) {
    minMinutes = typeof rawMin === "string" && /^\d+$/.test(rawMin) ? Number(rawMin) : NaN;
    if (!Number.isInteger(minMinutes) || minMinutes < 1 || minMinutes > MAX_MIN_MINUTES) {
      res.status(400).json({ error: `minMinutes must be a whole number from 1 to ${MAX_MIN_MINUTES}` });
      return;
    }
  }

  const members = await prisma.groupMember.findMany({
    where: { groupId: req.params.id },
    select: { userId: true },
  });
  const memberSet = new Set(members.map((m) => m.userId));

  let userIds = [...memberSet];
  if (rawUserIds !== undefined) {
    if (typeof rawUserIds !== "string") {
      res.status(400).json({ error: "userIds must be a comma-separated list" });
      return;
    }
    userIds = [...new Set(rawUserIds.split(",").map((s) => s.trim()).filter(Boolean))];
    if (userIds.length === 0) {
      res.status(400).json({ error: "Select at least one member" });
      return;
    }
    if (userIds.some((id) => !memberSet.has(id))) {
      res.status(400).json({ error: "userIds must all be members of this group" });
      return;
    }
  }

  const now = new Date();
  const blocks = await prisma.availabilityBlock.findMany({
    where: {
      userId: { in: userIds },
      endsAt: { gt: now },
      ...(category !== "ALL" && { category: category as Category }),
    },
    select: { userId: true, category: true, startsAt: true, endsAt: true },
  });

  const blocksByUser: Record<string, typeof blocks> = {};
  for (const b of blocks) (blocksByUser[b.userId] ??= []).push(b);

  res.json(findOverlaps(blocksByUser, userIds, { category, minMinutes, now }));
});

export default router;