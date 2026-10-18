import express, { type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { prisma } from "./db";
import authRouter from "./routes/auth";
import { requireAuth } from "./middleware/auth";
import availabilityRouter from "./routes/availability";
import groupsRouter from "./routes/groups";
import serverGroupsRouter from "./routes/serverGroups";
import eventsRouter from "./routes/events";
import discordRouter from "./routes/discord";
import { BotUnavailableError } from "./services/discordBot";

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
  // The Discord token fields are omitted globally in db.ts
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
app.use("/api/groups", requireAuth, serverGroupsRouter);
app.use("/api/discord", requireAuth, discordRouter);
app.use("/api", requireAuth, eventsRouter);

if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Routes that need the bot throw BotUnavailableError when it is not logged in
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof BotUnavailableError) {
    res.status(503).json({ error: err.message });
    return;
  }
  next(err);
});

export default app;
