import "dotenv/config";
import app from "./app";
import { startBot } from "./bot/client";

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

startBot();
