import "dotenv/config";
import app from "./app";
import { startBot } from "./bot/client";
import { startReminderScheduler } from "./bot/reminders";

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Reminders are only delivered by the bot, so skip the scheduler without one
if (startBot()) startReminderScheduler();
