import { Router } from "express";
import { Category } from "@prisma/client";
import { prisma } from "../db";
import { addWeeksInZone } from "../services/zonedTime";

const router = Router();

// List my blocks (optionally within a date range)
router.get("/", async (req, res) => {
  const { from, to } = req.query;
  const blocks = await prisma.availabilityBlock.findMany({
    where: {
      userId: res.locals.userId,
      ...(typeof from === "string" && { endsAt: { gte: new Date(from) } }),
      ...(typeof to === "string" && { startsAt: { lte: new Date(to) } }),
    },
    orderBy: { startsAt: "asc" },
  });
  res.json(blocks);
});

// Create a block
router.post("/", async (req, res) => {
  const { category, startsAt, endsAt, note } = req.body ?? {};
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (!Object.values(Category).includes(category)) {
    res.status(400).json({ error: "Invalid category" });
    return;
  }
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    res.status(400).json({ error: "End time must be after start time" });
    return;
  }

  const block = await prisma.availabilityBlock.create({
    data: {
      userId: res.locals.userId,
      category,
      startsAt: start,
      endsAt: end,
      note: typeof note === "string" && note.trim() ? note.trim() : null,
    },
  });
  res.status(201).json(block);
});

const MAX_BULK_WEEKS = 12;
const MAX_BULK_SLOTS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// Create several blocks at once, optionally repeated weekly
// { category, note?, slots: [{ startsAt, endsAt }] (1-7), weeks: 1-12 }
// Each slot is repeated `weeks` times (week 0 included) at the same local time in my
// saved timezone. All blocks are inserted in a single statement, so it's all or nothing.
router.post("/bulk", async (req, res) => {
  const { category, note, slots, weeks = 1 } = req.body ?? {};

  if (!Object.values(Category).includes(category)) {
    res.status(400).json({ error: "Invalid category" });
    return;
  }
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_BULK_WEEKS) {
    res.status(400).json({ error: `weeks must be a whole number from 1 to ${MAX_BULK_WEEKS}` });
    return;
  }
  if (!Array.isArray(slots) || slots.length < 1 || slots.length > MAX_BULK_SLOTS) {
    res.status(400).json({ error: `slots must contain 1 to ${MAX_BULK_SLOTS} time ranges` });
    return;
  }
  const parsed: { start: Date; end: Date }[] = [];
  for (const slot of slots) {
    const start = new Date(slot?.startsAt);
    const end = new Date(slot?.endsAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      res.status(400).json({ error: "Each slot's end time must be after its start time" });
      return;
    }
    if (end.getTime() - start.getTime() > DAY_MS) {
      res.status(400).json({ error: "Each slot can be at most 24 hours long" });
      return;
    }
    parsed.push({ start, end });
  }
  if (note !== undefined && note !== null && (typeof note !== "string" || note.length > 200)) {
    res.status(400).json({ error: "Note must be text of at most 200 characters" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: res.locals.userId },
    select: { timezone: true },
  });
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  const cleanNote = typeof note === "string" && note.trim() ? note.trim() : null;
  const data = parsed.flatMap(({ start, end }) =>
    Array.from({ length: weeks }, (_, w) => ({
      userId: res.locals.userId as string,
      category: category as Category,
      startsAt: addWeeksInZone(start, w, user.timezone),
      endsAt: addWeeksInZone(end, w, user.timezone),
      note: cleanNote,
    }))
  );
  const blocks = await prisma.availabilityBlock.createManyAndReturn({ data });
  blocks.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  res.status(201).json(blocks);
});

// Delete one of my blocks
router.delete("/:id", async (req, res) => {
  const result = await prisma.availabilityBlock.deleteMany({
    where: { id: req.params.id, userId: res.locals.userId },
  });
  if (result.count === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;