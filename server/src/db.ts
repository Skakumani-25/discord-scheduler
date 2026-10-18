import { PrismaClient } from "@prisma/client";

// The Discord OAuth token is never returned by default; read it with an explicit select
export const prisma = new PrismaClient({
  omit: { user: { discordAccessToken: true, discordTokenExpiresAt: true } },
});
