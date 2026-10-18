// URLs for Discord-hosted images and pages. Only built from data the API already returns.
const CDN = "https://cdn.discordapp.com";

export function userAvatarUrl(discordId: string, avatar: string | null | undefined, size = 64) {
  return avatar ? `${CDN}/avatars/${discordId}/${avatar}.png?size=${size}` : null;
}

export function guildIconUrl(guildId: string, icon: string | null | undefined, size = 64) {
  return icon ? `${CDN}/icons/${guildId}/${icon}.png?size=${size}` : null;
}

// Opens the channel in the Discord app or web client; it doesn't join the call itself
export function channelUrl(guildId: string, channelId: string) {
  return `https://discord.com/channels/${guildId}/${channelId}`;
}
