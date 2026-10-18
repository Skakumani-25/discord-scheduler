import "dotenv/config";
import app from "./app";
import { prisma } from "./db";
import { startBot, stopBot } from "./bot/client";
import { startReminderScheduler, stopReminderScheduler } from "./bot/reminders";

// Route handlers' errors go to the Express error handler; this catches anything else
// (e.g. inside discord.js) so one stray rejection can't take the whole API down
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason instanceof Error ? reason.message : String(reason));
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Reminders are only delivered by the bot, so skip the scheduler without one
if (startBot()) startReminderScheduler();

// `docker compose stop`/redeploys send SIGTERM: stop taking work, then close cleanly
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);
  stopReminderScheduler();
  server.close();
  await stopBot().catch(() => {});
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
