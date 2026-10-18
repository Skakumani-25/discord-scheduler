import type { Presence, UserStatus } from "../../status";

// Shapes returned by GET /api/groups/:id and related endpoints
export type Member = {
  userId: string;
  role: "OWNER" | "MEMBER";
  user: {
    id: string;
    username: string;
    avatar: string | null;
    discordId: string;
    status: UserStatus;
    presence: Presence | null;
  };
};

export type Block = {
  id: string;
  userId: string;
  category: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
};

export type GroupDetailData = {
  id: string;
  name: string;
  inviteCode: string;
  type: "CUSTOM" | "DISCORD_SERVER";
  discordGuildId: string | null;
  announcementChannelId: string | null;
  role: "OWNER" | "MEMBER";
  members: Member[];
  blocks: Block[];
};

export type MeetingChannel = { channelId: string; label: string };
export type MeetingInfo = { channels: MeetingChannel[]; canManage: boolean };

export type OverlapWindow = { startsAt: string; endsAt: string };

export type SessionPrefill = {
  // Changes on every prefill so the form remounts with the new values
  nonce: number;
  startsAt: string;
  endsAt: string;
  category?: string;
};
