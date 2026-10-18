import { CircleCheck, CircleMinus, Clock, Moon, type LucideIcon } from "lucide-react";

// Mirrors the server's UserStatus enum. Each status has its own icon shape so it reads
// without color.
export type StatusValue = "AVAILABLE" | "BUSY" | "AWAY" | "DND";
export type UserStatus = { status: StatusValue; note: string | null; expiresAt: string | null } | null;

export const STATUS_OPTIONS: { value: StatusValue; label: string; icon: LucideIcon }[] = [
  { value: "AVAILABLE", label: "Available", icon: CircleCheck },
  { value: "BUSY", label: "Busy", icon: Clock },
  { value: "AWAY", label: "Away", icon: Moon },
  { value: "DND", label: "Do not disturb", icon: CircleMinus },
];

export function statusOption(value: StatusValue) {
  return STATUS_OPTIONS.find((o) => o.value === value) ?? STATUS_OPTIONS[0];
}

// Live Discord presence from the bot; null means the member hides it
export type Presence = "online" | "idle" | "dnd" | "offline" | "unknown";

export const PRESENCE_LABEL: Record<Presence, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do not disturb",
  offline: "Offline",
  unknown: "Unknown",
};
