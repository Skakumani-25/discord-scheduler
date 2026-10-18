import type { UserStatus } from "./status";

// The signed-in user, as returned by GET /api/me
export type User = {
  id: string;
  discordId: string;
  username: string;
  avatar: string | null;
  timezone: string;
  reminderMinutes: number;
  showPresence: boolean;
  status: UserStatus;
};
