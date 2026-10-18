import type { Request } from "express";
import helmet from "helmet";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import jwt from "jsonwebtoken";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Which proxy hops to trust for req.ip (used by the rate limiter):
 * - production: exactly one hop, Caddy, which sets X-Forwarded-For
 * - development: only loopback, i.e. the Vite dev proxy on the same machine
 */
export const TRUST_PROXY = isProduction ? 1 : "loopback";

// Security headers. In development the page itself is served by Vite, so the CSP only
// applies to the production build that Express serves.
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      // Discord avatars and server icons; data: for the inline SVG select arrow
      "img-src": ["'self'", "data:", "https://cdn.discordapp.com"],
      // Caddy already redirects to HTTPS; forcing upgrades would break local http testing
      "upgrade-insecure-requests": null,
    },
  },
});

// Rate limit per signed-in user when possible (so people behind one shared IP don't
// throttle each other), otherwise per IP. IPv6 addresses are grouped by subnet.
function userOrIpKey(req: Request) {
  const token = req.cookies?.token;
  if (typeof token === "string") {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ["HS256"] }) as { userId?: unknown };
      if (typeof payload.userId === "string") return `user:${payload.userId}`;
    } catch {
      // Fall through to the IP
    }
  }
  return `ip:${ipKeyGenerator(req.ip ?? "")}`;
}

// The Discord login flow: two requests per login, so this is generous for people and
// tight for scripts hammering the OAuth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  // Browsers navigate here directly, so reply with text rather than JSON
  message: "Too many login attempts. Wait a few minutes and try again.",
});

// Writes (POST/PUT/PATCH/DELETE) under /api. Reads aren't limited.
export const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req) => req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS",
  keyGenerator: userOrIpKey,
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json({ error: "Too many changes in a short time. Wait a few minutes and try again." });
  },
});
