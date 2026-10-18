import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// Runs the real app (auth middleware, routers, error handler) with the DB, bot and
// user-token Discord API mocked out
vi.hoisted(() => {
  process.env.JWT_SECRET = "test-jwt-secret";
  process.env.TOKEN_ENCRYPTION_KEY = "test-encryption-key";
  process.env.DISCORD_CLIENT_ID = "123456789012345678";
});

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), count: vi.fn() },
  group: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  groupMember: { findUnique: vi.fn(), upsert: vi.fn() },
  meetingChannel: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  availabilityBlock: { findMany: vi.fn() },
}));
vi.mock("../db", () => ({ prisma: prismaMock }));

const botState = vi.hoisted(() => ({ bot: null as unknown }));
vi.mock("../bot/client", () => ({ getBot: () => botState.bot }));

const getPresence = vi.hoisted(() => vi.fn());
vi.mock("../bot/presence", () => ({ getPresence }));

const fetchUserGuilds = vi.hoisted(() => vi.fn());
vi.mock("../services/discordApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/discordApi")>()),
  fetchUserGuilds,
}));

import app from "../app";
import { encryptSecret } from "../services/tokenCrypto";

const GUILD = "111111111111111111";
const OTHER_GUILD = "222222222222222222";
const NO_BOT_GUILD = "333333333333333333";
const VOICE = "444444444444444444";
const TEXT = "555555555555555555";
const READ_ONLY_TEXT = "666666666666666666";

const SERVER_GROUP = "server-group";
const CUSTOM_GROUP = "custom-group";

// App users. discordId is what the server looks up; the client never supplies it
const OWNER = "owner"; // group OWNER, plain member of the Discord server
const MEMBER = "member"; // group MEMBER, no MANAGE_GUILD
const MANAGER = "manager"; // group MEMBER with MANAGE_GUILD in Discord
const JOINER = "joiner"; // in the Discord server, not in the group yet
const OUTSIDER = "outsider"; // in neither
const discordId = (userId: string) => `discord-${userId}`;

// Who the bot sees in the guild, and whether they have MANAGE_GUILD
const guildMembers = new Map<string, boolean>([
  [discordId(OWNER), false],
  [discordId(MEMBER), false],
  [discordId(MANAGER), true],
  [discordId(JOINER), false],
]);

const groupMembers: Record<string, Record<string, "OWNER" | "MEMBER">> = {
  [SERVER_GROUP]: { [OWNER]: "OWNER", [MEMBER]: "MEMBER", [MANAGER]: "MEMBER" },
  [CUSTOM_GROUP]: { [OWNER]: "OWNER" },
};
const groups: Record<string, object> = {
  [SERVER_GROUP]: { id: SERVER_GROUP, name: "Test Server", type: "DISCORD_SERVER", discordGuildId: GUILD },
  [CUSTOM_GROUP]: { id: CUSTOM_GROUP, name: "Friends", type: "CUSTOM", discordGuildId: null },
};

const fakeGuild = {
  id: GUILD,
  name: "Test Server",
  members: {
    me: { id: "bot" },
    fetch: vi.fn(async (id: string) => {
      if (!guildMembers.has(id)) throw Object.assign(new Error("Unknown Member"), { code: 10007 });
      const canManage = guildMembers.get(id);
      return {
        permissions: { has: (bit: bigint) => bit === PermissionFlagsBits.ManageGuild && canManage },
      };
    }),
  },
  channels: {
    cache: new Map<string, object>([
      [
        TEXT,
        { id: TEXT, name: "general", type: ChannelType.GuildText, position: 0, permissionsFor: () => ({ has: () => true }) },
      ],
      [
        READ_ONLY_TEXT,
        { id: READ_ONLY_TEXT, name: "rules", type: ChannelType.GuildText, position: 2, permissionsFor: () => ({ has: () => false }) },
      ],
      [VOICE, { id: VOICE, name: "Voice Lounge", type: ChannelType.GuildVoice, position: 1 }],
    ]),
  },
};
const fakeBot = {
  guilds: { cache: new Map<string, object>([[GUILD, fakeGuild], [OTHER_GUILD, { id: OTHER_GUILD }]]) },
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

const stored = { token: encryptSecret("user-access-token"), expires: new Date(Date.now() + 3_600_000) };

beforeEach(() => {
  vi.clearAllMocks();
  botState.bot = fakeBot;

  prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
    discordId: discordId(where.id),
    discordAccessToken: stored.token,
    discordTokenExpiresAt: stored.expires,
  }));
  prismaMock.groupMember.findUnique.mockImplementation(
    async ({ where }: { where: { groupId_userId: { groupId: string; userId: string } } }) => {
      const { groupId, userId } = where.groupId_userId;
      const role = groupMembers[groupId]?.[userId];
      return role ? { groupId, userId, role, group: groups[groupId] } : null;
    }
  );
  prismaMock.group.findUnique.mockResolvedValue(null);
  prismaMock.group.findMany.mockResolvedValue([]);
  prismaMock.meetingChannel.findMany.mockResolvedValue([]);
  getPresence.mockImplementation((ids: string[]) => new Map(ids.map((id) => [id, "online"])));
});

function call(method: string, path: string, user: string, body?: unknown) {
  const token = jwt.sign({ userId: user }, process.env.JWT_SECRET!);
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { Cookie: `token=${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("GET /api/discord/guilds", () => {
  const MANAGE = PermissionFlagsBits.ManageGuild.toString();
  const ADMIN = PermissionFlagsBits.Administrator.toString();

  it("returns only guilds the bot is in, with manage flags and linked groups", async () => {
    fetchUserGuilds.mockResolvedValue({
      ok: true,
      guilds: [
        { id: GUILD, name: "Test Server", icon: null, owner: false, permissions: MANAGE },
        { id: OTHER_GUILD, name: "Other", icon: "abc", owner: false, permissions: "0" },
        { id: NO_BOT_GUILD, name: "No bot here", icon: null, owner: true, permissions: ADMIN },
      ],
    });
    prismaMock.group.findMany.mockResolvedValue([
      { id: SERVER_GROUP, discordGuildId: GUILD, members: [{ id: "m1" }] },
    ]);

    const res = await call("GET", "/api/discord/guilds", MEMBER);

    expect(res.status).toBe(200);
    expect(fetchUserGuilds).toHaveBeenCalledWith("user-access-token");
    expect(await res.json()).toEqual([
      { id: GUILD, name: "Test Server", icon: null, canManage: true, group: { id: SERVER_GROUP, isMember: true } },
      { id: OTHER_GUILD, name: "Other", icon: "abc", canManage: false, group: null },
    ]);
  });

  it("treats Administrator and server owner as able to manage", async () => {
    fetchUserGuilds.mockResolvedValue({
      ok: true,
      guilds: [
        { id: GUILD, name: "A", icon: null, owner: false, permissions: ADMIN },
        { id: OTHER_GUILD, name: "B", icon: null, owner: true, permissions: "0" },
      ],
    });
    const body = await (await call("GET", "/api/discord/guilds", MEMBER)).json();
    expect(body.map((g: { canManage: boolean }) => g.canManage)).toEqual([true, true]);
  });

  it("never includes the stored token in the response", async () => {
    fetchUserGuilds.mockResolvedValue({ ok: true, guilds: [] });
    const text = await (await call("GET", "/api/discord/guilds", MEMBER)).text();
    expect(text).not.toContain("user-access-token");
    expect(text).not.toContain(stored.token);
  });

  it("asks the user to log in again when no token is stored", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ discordAccessToken: null, discordTokenExpiresAt: null });
    const res = await call("GET", "/api/discord/guilds", MEMBER);
    expect(res.status).toBe(401);
    expect((await res.json()).reauth).toBe(true);
    expect(fetchUserGuilds).not.toHaveBeenCalled();
  });

  it("asks the user to log in again when the token has expired", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      discordAccessToken: stored.token,
      discordTokenExpiresAt: new Date(Date.now() - 1000),
    });
    expect((await call("GET", "/api/discord/guilds", MEMBER)).status).toBe(401);
  });

  it("asks the user to log in again when Discord rejects the token", async () => {
    fetchUserGuilds.mockResolvedValue({ ok: false, reason: "unauthorized" });
    expect((await call("GET", "/api/discord/guilds", MEMBER)).status).toBe(401);
  });

  it("returns 503 when the bot is not running", async () => {
    botState.bot = null;
    expect((await call("GET", "/api/discord/guilds", MEMBER)).status).toBe(503);
  });
});

describe("GET /api/discord/invite-url", () => {
  it("builds the invite from DISCORD_CLIENT_ID with bot scopes and permissions", async () => {
    const { url } = await (await call("GET", "/api/discord/invite-url", MEMBER)).json();
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(parsed.searchParams.get("client_id")).toBe(process.env.DISCORD_CLIENT_ID);
    expect(parsed.searchParams.get("scope")).toBe("bot applications.commands");
    // View Channels (1 << 10) + Send Messages (1 << 11) + Connect (1 << 20)
    expect(parsed.searchParams.get("permissions")).toBe(String(1024 + 2048 + 1048576));
  });
});

describe("POST /api/groups/from-guild", () => {
  it("creates a DISCORD_SERVER group with the caller as OWNER", async () => {
    prismaMock.group.create.mockResolvedValue({ id: "new-group", name: "Test Server" });

    const res = await call("POST", "/api/groups/from-guild", JOINER, { guildId: GUILD });

    expect(res.status).toBe(201);
    // Membership was checked with Discord using the stored discordId
    expect(fakeGuild.members.fetch).toHaveBeenCalledWith(discordId(JOINER));
    const { data } = prismaMock.group.create.mock.calls[0][0];
    expect(data).toMatchObject({
      name: "Test Server",
      type: "DISCORD_SERVER",
      discordGuildId: GUILD,
      members: { create: { userId: JOINER, role: "OWNER" } },
    });
  });

  it("rejects a user who is not in the Discord server", async () => {
    const res = await call("POST", "/api/groups/from-guild", OUTSIDER, { guildId: GUILD });
    expect(res.status).toBe(403);
    expect(prismaMock.group.create).not.toHaveBeenCalled();
  });

  it("rejects a guild the bot is not in", async () => {
    const res = await call("POST", "/api/groups/from-guild", JOINER, { guildId: NO_BOT_GUILD });
    expect(res.status).toBe(404);
  });

  it("rejects a malformed guildId", async () => {
    const res = await call("POST", "/api/groups/from-guild", JOINER, { guildId: "../etc" });
    expect(res.status).toBe(400);
  });

  it("returns 409 when the server already has a group", async () => {
    prismaMock.group.findUnique.mockResolvedValue({ id: SERVER_GROUP });
    const res = await call("POST", "/api/groups/from-guild", JOINER, { guildId: GUILD });
    expect(res.status).toBe(409);
    expect((await res.json()).groupId).toBe(SERVER_GROUP);
    expect(prismaMock.group.create).not.toHaveBeenCalled();
  });

  it("returns 503 when the bot is not running", async () => {
    botState.bot = null;
    expect((await call("POST", "/api/groups/from-guild", JOINER, { guildId: GUILD })).status).toBe(503);
  });
});

describe("POST /api/groups/join-guild", () => {
  it("adds a server member to the existing group as MEMBER", async () => {
    prismaMock.group.findUnique.mockResolvedValue({ id: SERVER_GROUP, name: "Test Server" });
    const res = await call("POST", "/api/groups/join-guild", JOINER, { guildId: GUILD });
    expect(res.status).toBe(200);
    expect(prismaMock.groupMember.upsert).toHaveBeenCalledWith({
      where: { groupId_userId: { groupId: SERVER_GROUP, userId: JOINER } },
      update: {},
      create: { groupId: SERVER_GROUP, userId: JOINER },
    });
  });

  it("rejects a user who is not in the Discord server", async () => {
    prismaMock.group.findUnique.mockResolvedValue({ id: SERVER_GROUP, name: "Test Server" });
    expect((await call("POST", "/api/groups/join-guild", OUTSIDER, { guildId: GUILD })).status).toBe(403);
    expect(prismaMock.groupMember.upsert).not.toHaveBeenCalled();
  });

  it("returns 404 when the server has no group yet", async () => {
    expect((await call("POST", "/api/groups/join-guild", JOINER, { guildId: GUILD })).status).toBe(404);
  });
});

describe("POST /api/groups/join (invite code)", () => {
  it("refuses to join a server group by invite code", async () => {
    prismaMock.group.findUnique.mockResolvedValue({ ...groups[SERVER_GROUP], inviteCode: "ABCD1234" });
    const res = await call("POST", "/api/groups/join", OUTSIDER, { code: "ABCD1234" });
    expect(res.status).toBe(400);
    expect(prismaMock.groupMember.upsert).not.toHaveBeenCalled();
  });
});

describe("meeting channels", () => {
  const path = `/api/groups/${SERVER_GROUP}/meeting-channels`;

  it("returns 404 to non-members", async () => {
    expect((await call("GET", path, OUTSIDER)).status).toBe(404);
    expect((await call("POST", path, OUTSIDER, { channelId: VOICE })).status).toBe(404);
    expect((await call("DELETE", `${path}/${VOICE}`, OUTSIDER)).status).toBe(404);
    expect((await call("GET", `/api/groups/${SERVER_GROUP}/voice-channels`, OUTSIDER)).status).toBe(404);
  });

  it("is only available for DISCORD_SERVER groups", async () => {
    const res = await call("GET", `/api/groups/${CUSTOM_GROUP}/meeting-channels`, OWNER);
    expect(res.status).toBe(400);
  });

  it("lets members read and reports who can manage", async () => {
    prismaMock.meetingChannel.findMany.mockResolvedValue([{ channelId: VOICE, label: "Voice Lounge" }]);
    const asMember = await (await call("GET", path, MEMBER)).json();
    expect(asMember).toEqual({ channels: [{ channelId: VOICE, label: "Voice Lounge" }], canManage: false });
    expect((await (await call("GET", path, OWNER)).json()).canManage).toBe(true);
    expect((await (await call("GET", path, MANAGER)).json()).canManage).toBe(true);
  });

  it("still lets members read while the bot is down", async () => {
    botState.bot = null;
    const res = await call("GET", path, MEMBER);
    expect(res.status).toBe(200);
    expect((await res.json()).canManage).toBe(false);
  });

  it("forbids adding by a member without MANAGE_GUILD", async () => {
    const res = await call("POST", path, MEMBER, { channelId: VOICE });
    expect(res.status).toBe(403);
    expect(prismaMock.meetingChannel.create).not.toHaveBeenCalled();
  });

  it("lets a MANAGE_GUILD member add a voice channel", async () => {
    prismaMock.meetingChannel.create.mockResolvedValue({ channelId: VOICE, label: "Raid room" });
    const res = await call("POST", path, MANAGER, { channelId: VOICE, label: "Raid room" });
    expect(res.status).toBe(201);
    expect(prismaMock.meetingChannel.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { groupId: SERVER_GROUP, channelId: VOICE, label: "Raid room" } })
    );
  });

  it("lets the OWNER add, defaulting the label to the channel name", async () => {
    prismaMock.meetingChannel.create.mockResolvedValue({ channelId: VOICE, label: "Voice Lounge" });
    expect((await call("POST", path, OWNER, { channelId: VOICE })).status).toBe(201);
    expect(prismaMock.meetingChannel.create.mock.calls[0][0].data.label).toBe("Voice Lounge");
  });

  it.each([
    ["a text channel", TEXT],
    ["an unknown channel", "999999999999999999"],
    ["a missing channelId", undefined],
  ])("rejects %s", async (_label, channelId) => {
    const res = await call("POST", path, OWNER, { channelId });
    expect(res.status).toBe(400);
    expect(prismaMock.meetingChannel.create).not.toHaveBeenCalled();
  });

  it("forbids removing by a member without MANAGE_GUILD", async () => {
    expect((await call("DELETE", `${path}/${VOICE}`, MEMBER)).status).toBe(403);
    expect(prismaMock.meetingChannel.deleteMany).not.toHaveBeenCalled();
  });

  it("lets the OWNER remove a channel", async () => {
    prismaMock.meetingChannel.deleteMany.mockResolvedValue({ count: 1 });
    expect((await call("DELETE", `${path}/${VOICE}`, OWNER)).status).toBe(200);
    expect(prismaMock.meetingChannel.deleteMany).toHaveBeenCalledWith({
      where: { groupId: SERVER_GROUP, channelId: VOICE },
    });
  });

  it("lists only voice channels for the picker", async () => {
    const res = await call("GET", `/api/groups/${SERVER_GROUP}/voice-channels`, MEMBER);
    expect(await res.json()).toEqual([{ id: VOICE, name: "Voice Lounge" }]);
  });
});

describe("announcement channel", () => {
  const path = `/api/groups/${SERVER_GROUP}/announcement-channel`;

  it("lists only text channels the bot can post in, for the OWNER", async () => {
    const res = await call("GET", `/api/groups/${SERVER_GROUP}/text-channels`, OWNER);
    expect(await res.json()).toEqual([{ id: TEXT, name: "general" }]);
    expect((await call("GET", `/api/groups/${SERVER_GROUP}/text-channels`, MANAGER)).status).toBe(403);
  });

  it("lets the OWNER set a postable text channel", async () => {
    const res = await call("PUT", path, OWNER, { channelId: TEXT });
    expect(res.status).toBe(200);
    expect(prismaMock.group.update).toHaveBeenCalledWith({
      where: { id: SERVER_GROUP },
      data: { announcementChannelId: TEXT },
    });
  });

  it("is OWNER only, even for server managers", async () => {
    expect((await call("PUT", path, MANAGER, { channelId: TEXT })).status).toBe(403);
    expect((await call("PUT", path, OUTSIDER, { channelId: TEXT })).status).toBe(404);
    expect(prismaMock.group.update).not.toHaveBeenCalled();
  });

  it.each([
    ["a voice channel", VOICE],
    ["a channel the bot cannot post in", READ_ONLY_TEXT],
    ["an unknown channel", "999999999999999999"],
    ["a non-string", 42],
  ])("rejects %s", async (_label, channelId) => {
    expect((await call("PUT", path, OWNER, { channelId })).status).toBe(400);
    expect(prismaMock.group.update).not.toHaveBeenCalled();
  });

  it("can be cleared with null, even while the bot is down", async () => {
    botState.bot = null;
    expect((await call("PUT", path, OWNER, { channelId: null })).status).toBe(200);
    expect(prismaMock.group.update).toHaveBeenCalledWith({
      where: { id: SERVER_GROUP },
      data: { announcementChannelId: null },
    });
  });

  it("is only for server groups", async () => {
    const res = await call("PUT", `/api/groups/${CUSTOM_GROUP}/announcement-channel`, OWNER, { channelId: TEXT });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/groups/:id member statuses", () => {
  it("shows each member's current status and hides expired ones and raw columns", async () => {
    const user = (id: string, extra: object) => ({
      id,
      username: id,
      avatar: null,
      discordId: discordId(id),
      showPresence: true,
      ...extra,
    });
    prismaMock.group.findUnique.mockResolvedValue({
      ...groups[SERVER_GROUP],
      inviteCode: "ABCD1234",
      announcementChannelId: null,
      members: [
        { userId: OWNER, user: user(OWNER, { status: "BUSY", statusNote: "in class", statusExpiresAt: null }) },
        { userId: MEMBER, user: user(MEMBER, { status: "AWAY", statusNote: null, statusExpiresAt: new Date(Date.now() - 1000) }) },
        { userId: MANAGER, user: user(MANAGER, { status: null, statusNote: null, statusExpiresAt: null }) },
      ],
    });
    prismaMock.availabilityBlock.findMany.mockResolvedValue([]);

    const body = await (await call("GET", `/api/groups/${SERVER_GROUP}`, MEMBER)).json();

    const statuses = Object.fromEntries(body.members.map((m: { userId: string; user: { status: unknown } }) => [m.userId, m.user.status]));
    expect(statuses).toEqual({
      [OWNER]: { status: "BUSY", note: "in class", expiresAt: null },
      [MEMBER]: null,
      [MANAGER]: null,
    });
    expect(body.members[0].user).not.toHaveProperty("statusNote");
  });
});

describe("member presence", () => {
  const member = (id: string, showPresence: boolean) => ({
    userId: id,
    user: {
      id,
      username: id,
      avatar: null,
      discordId: discordId(id),
      showPresence,
      status: null,
      statusNote: null,
      statusExpiresAt: null,
    },
  });

  beforeEach(() => {
    prismaMock.group.findUnique.mockResolvedValue({
      ...groups[SERVER_GROUP],
      inviteCode: "ABCD1234",
      announcementChannelId: null,
      members: [member(OWNER, true), member(MEMBER, false), member(MANAGER, true)],
    });
    prismaMock.availabilityBlock.findMany.mockResolvedValue([]);
    getPresence.mockReturnValue(
      new Map([
        [discordId(OWNER), "idle"],
        [discordId(MANAGER), "unknown"],
      ])
    );
  });

  it("includes presence in group detail and hides it for members who opted out", async () => {
    const body = await (await call("GET", `/api/groups/${SERVER_GROUP}`, MEMBER)).json();
    const presence = Object.fromEntries(
      body.members.map((m: { userId: string; user: { presence: unknown } }) => [m.userId, m.user.presence])
    );
    expect(presence).toEqual({ [OWNER]: "idle", [MEMBER]: null, [MANAGER]: "unknown" });
    // Opted-out members are never even looked up, and the setting itself isn't exposed
    expect(getPresence).toHaveBeenCalledWith([discordId(OWNER), discordId(MANAGER)], { preferGuildId: GUILD });
    expect(body.members[0].user).not.toHaveProperty("showPresence");
  });

  it("serves a presence-only map for polling", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue({
      role: "MEMBER",
      group: {
        discordGuildId: GUILD,
        members: [member(OWNER, true), member(MEMBER, false), member(MANAGER, true)].map((m) => ({
          userId: m.userId,
          user: { discordId: m.user.discordId, showPresence: m.user.showPresence },
        })),
      },
    });
    const res = await call("GET", `/api/groups/${SERVER_GROUP}/presence`, MEMBER);
    expect(await res.json()).toEqual({ [OWNER]: "idle", [MEMBER]: null, [MANAGER]: "unknown" });
  });

  it("does not reveal presence to non-members", async () => {
    expect((await call("GET", `/api/groups/${SERVER_GROUP}/presence`, OUTSIDER)).status).toBe(404);
    expect((await call("GET", `/api/groups/${SERVER_GROUP}`, OUTSIDER)).status).toBe(404);
    expect(getPresence).not.toHaveBeenCalled();
  });
});
