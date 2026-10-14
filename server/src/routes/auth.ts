import { Router } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../db";

const router = Router();
const DISCORD_API = "https://discord.com/api";

// Step 1: send the user to Discord
router.get("/discord", (_req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
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

  if (typeof code !== "string" || state !== req.cookies.oauth_state) {
    res.status(400).send("Invalid OAuth request");
    return;
  }
  res.clearCookie("oauth_state");

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
    console.error("Token exchange failed:", await tokenRes.text());
    res.status(400).send("Discord token exchange failed");
    return;
  }
  const token = (await tokenRes.json()) as { access_token: string };

  // Fetch the Discord profile
  const userRes = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = (await userRes.json()) as {
    id: string;
    username: string;
    global_name?: string | null;
    avatar: string | null;
  };

  // Create or update the user in our database
  const user = await prisma.user.upsert({
    where: { discordId: profile.id },
    update: {
      username: profile.global_name ?? profile.username,
      avatar: profile.avatar,
    },
    create: {
      discordId: profile.id,
      username: profile.global_name ?? profile.username,
      avatar: profile.avatar,
    },
  });

  // Log them in with a signed cookie
  const jwtToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
    expiresIn: "7d",
  });
  res.cookie("token", jwtToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.redirect(process.env.CLIENT_URL!);
});

export default router;