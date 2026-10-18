import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { prisma } from "./db";
import authRouter from "./routes/auth";
import { requireAuth } from "./middleware/auth";
import { apiNotFound, errorHandler } from "./middleware/errors";
import { authLimiter, mutationLimiter, securityHeaders, TRUST_PROXY } from "./middleware/security";
import availabilityRouter from "./routes/availability";
import groupsRouter from "./routes/groups";
import serverGroupsRouter from "./routes/serverGroups";
import eventsRouter from "./routes/events";
import discordRouter from "./routes/discord";
import meRouter from "./routes/me";
import { withEffectiveStatus } from "./services/userStatus";

const app = express();
// Needed so req.ip is the real client behind Caddy (prod) or the Vite proxy (dev)
app.set("trust proxy", TRUST_PROXY);
app.use(securityHeaders);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Database reachability only; deliberately reveals nothing about the data
app.get("/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use("/auth", authLimiter, authRouter);

app.use("/api", mutationLimiter);

app.get("/api/me", requireAuth, async (_req, res) => {
  // The Discord token fields are omitted globally in db.ts
  const user = await prisma.user.findUnique({
    where: { id: res.locals.userId },
  });
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json(withEffectiveStatus(user));
});

app.use("/api/me", requireAuth, meRouter);

app.post("/api/logout", (_req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  res.json({ ok: true });
});

app.use("/api/availability", requireAuth, availabilityRouter);
app.use("/api/groups", requireAuth, groupsRouter);
app.use("/api/groups", requireAuth, serverGroupsRouter);
app.use("/api/discord", requireAuth, discordRouter);
app.use("/api", requireAuth, eventsRouter);
app.use("/api", apiNotFound);

if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Last: turns every error (including rejected async handlers) into a JSON response
app.use(errorHandler);

export default app;
