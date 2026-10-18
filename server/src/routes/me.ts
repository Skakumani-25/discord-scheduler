import { Router } from "express";
import { prisma } from "../db";
import { isValidTimeZone } from "../services/timezone";
import { recomputeUserReminders } from "../services/reminderSync";
import { parseStatusInput, withEffectiveStatus } from "../services/userStatus";

const router = Router();

// One week
const MAX_REMINDER_MINUTES = 7 * 24 * 60;

// Update my timezone and/or reminder lead time
router.put("/settings", async (req, res) => {
  const userId = res.locals.userId;
  const { timezone, reminderMinutes } = req.body ?? {};
  if (timezone === undefined && reminderMinutes === undefined) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  if (timezone !== undefined && !isValidTimeZone(timezone)) {
    res.status(400).json({ error: "Timezone must be a valid IANA zone like America/New_York" });
    return;
  }
  if (
    reminderMinutes !== undefined &&
    (!Number.isInteger(reminderMinutes) || reminderMinutes < 0 || reminderMinutes > MAX_REMINDER_MINUTES)
  ) {
    res.status(400).json({
      error: `Reminder lead time must be a whole number of minutes from 0 to ${MAX_REMINDER_MINUTES}`,
    });
    return;
  }

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { reminderMinutes: true },
  });
  if (!before) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(timezone !== undefined && { timezone }),
      ...(reminderMinutes !== undefined && { reminderMinutes }),
    },
  });
  if (reminderMinutes !== undefined && reminderMinutes !== before.reminderMinutes) {
    await recomputeUserReminders(userId);
  }
  res.json(withEffectiveStatus(user));
});

// Set my status { status, note?, expiresAt? }, or clear it with { status: null }
router.put("/status", async (req, res) => {
  const parsed = parseStatusInput(req.body ?? {});
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const user = await prisma.user.update({
    where: { id: res.locals.userId },
    data: parsed.data,
  });
  res.json(withEffectiveStatus(user));
});

export default router;
