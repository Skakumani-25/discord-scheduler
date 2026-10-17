import { Router } from "express";
import { Category } from "@prisma/client";
import { prisma } from "../db";

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