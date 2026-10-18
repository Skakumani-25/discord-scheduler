import { Client, Events, GatewayIntentBits, type Guild } from "discord.js";

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
      // Privileged: enable "Presence Intent" in the Developer Portal
      GatewayIntentBits.GuildPresences,
    ],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`Discord bot logged in as ${c.user.tag} (${c.guilds.cache.size} servers)`);
    for (const guild of c.guilds.cache.values()) void warmMemberCache(guild);
  });
  client.on(Events.GuildCreate, (guild) => void warmMemberCache(guild));
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

// Servers up to this size get their full member list cached so offline members show as
// "offline" rather than "unknown"; larger ones rely on whatever the gateway sends
const WARM_CACHE_MAX_MEMBERS = 1000;

// One gateway member-chunk request per server (not a REST call per user). After this,
// presence updates arrive as gateway events and keep the cache current.
async function warmMemberCache(guild: Guild) {
  if (guild.memberCount > WARM_CACHE_MAX_MEMBERS) return;
  try {
    await guild.members.fetch({ withPresences: true });
  } catch (err) {
    console.warn(`Could not cache members for server ${guild.id}:`, (err as Error).message);
  }
}

// The bot client once it is logged in and its guild cache is populated
export function getBot(): Client<true> | null {
  return client?.isReady() ? client : null;
}

export async function stopBot() {
  await client?.destroy();
  client = null;
}
