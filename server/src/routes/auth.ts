import { Router } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../db";
import { encryptSecret } from "../services/tokenCrypto";

const router = Router();
const DISCORD_API = "https://discord.com/api";
const isProduction = process.env.NODE_ENV === "production";

type DiscordToken = { access_token?: unknown; expires_in?: unknown };
type DiscordProfile = { id?: unknown; username?: unknown; global_name?: unknown; avatar?: unknown };

// Step 1: send the user to Discord
router.get("/discord", (_req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 10 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    redirect_uri: process.env.DISCORD_REDIRECT_URI!,
    response_type: "code",
    scope: "identify guilds",
    state,
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

// Step 2: Discord sends them back here with a code
router.get("/discord/callback", async (req, res) => {
  const { code, state } = req.query;
  const expectedState = req.cookies?.oauth_state;

  // Both must be present and equal; a missing state on both sides must not pass
  if (
    typeof code !== "string" ||
    typeof state !== "string" ||
    typeof expectedState !== "string" ||
    !state ||
    state !== expectedState
  ) {
    res.status(400).send("Invalid or expired login request. Go back and try logging in again.");
    return;
  }
  res.clearCookie("oauth_state", { httpOnly: true, sameSite: "lax", secure: isProduction });

  let token: DiscordToken;
  let profile: DiscordProfile;
  try {
    // Exchange the code for an access token
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI!,
      }),
    });
    if (!tokenRes.ok) {
      // Discord's error body (e.g. invalid_grant) has no secrets; cap it anyway
      console.error(`Token exchange failed (${tokenRes.status}):`, (await tokenRes.text()).slice(0, 200));
      res.status(400).send("Discord login failed. Go back and try again.");
      return;
    }
    token = (await tokenRes.json()) as DiscordToken;
    if (typeof token.access_token !== "string" || typeof token.expires_in !== "number") {
      console.error("Token exchange returned an unexpected response");
      res.status(502).send("Discord login failed. Go back and try again.");
      return;
    }

    // Fetch the Discord profile
    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!userRes.ok) {
      console.error(`Discord profile request failed (${userRes.status})`);
      res.status(502).send("Couldn't read your Discord profile. Go back and try again.");
      return;
    }
    profile = (await userRes.json()) as DiscordProfile;
  } catch (err) {
    console.error("Couldn't reach Discord during login:", (err as Error).message);
    res.status(502).send("Couldn't reach Discord. Check your connection and try logging in again.");
    return;
  }

  if (typeof profile.id !== "string" || typeof profile.username !== "string") {
    console.error("Discord profile response was missing id or username");
    res.status(502).send("Couldn't read your Discord profile. Go back and try again.");
    return;
  }
  const username = typeof profile.global_name === "string" && profile.global_name ? profile.global_name : profile.username;
  const avatar = typeof profile.avatar === "string" ? profile.avatar : null;

  // Kept (encrypted) so we can list the user's servers later; never returned or logged
  const discordAuth = {
    discordAccessToken: encryptSecret(token.access_token),
    discordTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
  };

  // Create or update the user in our database
  const user = await prisma.user.upsert({
    where: { discordId: profile.id },
    update: { username, avatar, ...discordAuth },
    create: { discordId: profile.id, username, avatar, ...discordAuth },
  });

  // Log them in with a signed cookie
  const jwtToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
    algorithm: "HS256",
    expiresIn: "7d",
  });
  res.cookie("token", jwtToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.redirect(process.env.CLIENT_URL!);
});

export default router;
