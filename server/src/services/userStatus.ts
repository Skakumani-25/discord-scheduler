import { UserStatus } from "@prisma/client";

// One week
export const MAX_STATUS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_STATUS_NOTE = 100;

export type StatusFields = {
  status: UserStatus | null;
  statusNote: string | null;
  statusExpiresAt: Date | null;
};

export type EffectiveStatus = {
  status: UserStatus;
  note: string | null;
  expiresAt: Date | null;
} | null;

export const statusSelect = { status: true, statusNote: true, statusExpiresAt: true } as const;

// The status others should see: null if none is set or it has expired
export function effectiveStatus(user: StatusFields, now = new Date()): EffectiveStatus {
  if (!user.status) return null;
  if (user.statusExpiresAt && user.statusExpiresAt <= now) return null;
  return { status: user.status, note: user.statusNote, expiresAt: user.statusExpiresAt };
}

// Replace the raw status columns on a user object with a single effective `status`
export function withEffectiveStatus<T extends StatusFields>(user: T, now = new Date()) {
  const { status, statusNote, statusExpiresAt, ...rest } = user;
  return { ...rest, status: effectiveStatus({ status, statusNote, statusExpiresAt }, now) };
}

export type StatusInput = { status?: unknown; note?: unknown; expiresAt?: unknown };

// Validates a PUT /api/me/status body into the columns to write, or returns an error
export function parseStatusInput(
  body: StatusInput,
  now = new Date()
): { data: StatusFields } | { error: string } {
  if (body.status === null) {
    return { data: { status: null, statusNote: null, statusExpiresAt: null } };
  }
  if (!Object.values(UserStatus).includes(body.status as UserStatus)) {
    return { error: `Status must be one of ${Object.values(UserStatus).join(", ")}, or null to clear` };
  }

  let note: string | null = null;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== "string") return { error: "Note must be text" };
    note = body.note.trim() || null;
    if (note && note.length > MAX_STATUS_NOTE) {
      return { error: `Note must be at most ${MAX_STATUS_NOTE} characters` };
    }
  }

  let expiresAt: Date | null = null;
  if (body.expiresAt !== undefined && body.expiresAt !== null) {
    expiresAt = typeof body.expiresAt === "string" ? new Date(body.expiresAt) : new Date(NaN);
    if (isNaN(expiresAt.getTime())) return { error: "expiresAt must be an ISO date" };
    if (expiresAt <= now) return { error: "expiresAt must be in the future" };
    if (expiresAt.getTime() - now.getTime() > MAX_STATUS_DURATION_MS) {
      return { error: "A status can be set to expire at most 7 days ahead" };
    }
  }

  return { data: { status: body.status as UserStatus, statusNote: note, statusExpiresAt: expiresAt } };
}
