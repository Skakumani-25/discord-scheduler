// Mirrors the server's UserStatus enum
export type StatusValue = "AVAILABLE" | "BUSY" | "AWAY" | "DND";
export type UserStatus = { status: StatusValue; note: string | null; expiresAt: string | null } | null;

export const STATUS_OPTIONS: { value: StatusValue; label: string; color: string }[] = [
  { value: "AVAILABLE", label: "Available", color: "#23a55a" },
  { value: "BUSY", label: "Busy", color: "#f0b232" },
  { value: "AWAY", label: "Away", color: "#80848e" },
  { value: "DND", label: "Do not disturb", color: "#f23f43" },
];

// Live Discord presence from the bot; null means the member hides it
export type Presence = "online" | "idle" | "dnd" | "offline" | "unknown";

export const PRESENCE_INFO: Record<Presence, { label: string; color: string }> = {
  online: { label: "Online", color: "#23a55a" },
  idle: { label: "Idle", color: "#f0b232" },
  dnd: { label: "Do not disturb", color: "#f23f43" },
  offline: { label: "Offline", color: "#80848e" },
  unknown: { label: "Unknown", color: "transparent" },
};
