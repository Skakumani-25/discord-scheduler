import { Client, Events, GatewayIntentBits } from "discord.js";

let client: Client | null = null;

// Starts the bot if DISCORD_BOT_TOKEN is set; otherwise logs a warning and does nothing
export function startBot(): Client | null {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.warn("DISCORD_BOT_TOKEN is not set; the Discord bot will not start");
    return null;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`Discord bot logged in as ${c.user.tag} (${c.guilds.cache.size} servers)`);
  });
  client.on(Events.Error, (err) => {
    console.error("Discord client error:", err.message);
  });

  // A bad token or disallowed intent should not take down the API
  client.login(token).catch((err: Error) => {
    console.error("Discord bot login failed:", err.message);
    client?.destroy();
    client = null;
  });

  return client;
}

// The bot client once it is logged in and its guild cache is populated
export function getBot(): Client<true> | null {
  return client?.isReady() ? client : null;
}

export async function stopBot() {
  await client?.destroy();
  client = null;
}
