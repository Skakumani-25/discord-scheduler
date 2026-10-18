import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { prisma } from "./db";
import authRouter from "./routes/auth";
import { requireAuth } from "./middleware/auth";
import path from "node:path";
import availabilityRouter from "./routes/availability";
import groupsRouter from "./routes/groups";

const app = express();
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/health/db", async (_req, res) => {
  const count = await prisma.user.count();
  res.json({ ok: true, users: count });
});

app.use("/auth", authRouter);

app.get("/api/me", requireAuth, async (_req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: res.locals.userId },
  });
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

app.post("/api/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

app.use("/api/availability", requireAuth, availabilityRouter);
app.use("/api/groups", requireAuth, groupsRouter);

if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});