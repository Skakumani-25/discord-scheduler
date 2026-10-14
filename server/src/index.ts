import "dotenv/config";
import express from "express";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

import { prisma } from "./db";

app.get("/health/db", async (_req, res) => {
  const count = await prisma.user.count();
  res.json({ ok: true, users: count });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});