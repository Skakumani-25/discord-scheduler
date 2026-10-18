import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// The real app with the DB and bot mocked: checks headers, limits and error handling
vi.hoisted(() => {
  process.env.JWT_SECRET = "test-jwt-secret";
  process.env.TOKEN_ENCRYPTION_KEY = "test-encryption-key";
});

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  availabilityBlock: { findMany: vi.fn(), create: vi.fn() },
  $queryRaw: vi.fn(),
}));
vi.mock("../db", () => ({ prisma: prismaMock }));
vi.mock("../bot/client", () => ({ getBot: () => null }));

import app from "../app";

let server: Server;
let base: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  vi.resetAllMocks();
});

const cookieFor = (userId: string) => `token=${jwt.sign({ userId }, process.env.JWT_SECRET!)}`;

describe("security headers", () => {
  it("sets helmet headers, with Discord's CDN allowed for images", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-powered-by")).toBeNull();
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("img-src 'self' data: https://cdn.discordapp.com");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});

describe("error handling", () => {
  it("returns JSON 400 for a malformed JSON body", async () => {
    const res = await fetch(`${base}/api/me/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookieFor("u1") },
      body: "{not json",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Request body is not valid JSON" });
  });

  it("returns JSON 404 for unknown API routes", async () => {
    const res = await fetch(`${base}/api/nope`, { headers: { Cookie: cookieFor("u1") } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  it("turns a rejected async handler into a generic JSON 500 without leaking details", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("connection string postgres://secret@db"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await fetch(`${base}/api/me`, { headers: { Cookie: cookieFor("u1") } });

    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "Something went wrong on our side. Try again in a moment." });
    expect(text).not.toContain("secret");
    expect(errorLog).toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it("reports database health without revealing data", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    expect(await (await fetch(`${base}/health/db`)).json()).toEqual({ ok: true });
    prismaMock.$queryRaw.mockRejectedValue(new Error("down"));
    const res = await fetch(`${base}/health/db`);
    expect(res.status).toBe(503);
  });
});

describe("auth", () => {
  it("rejects an OAuth callback with no state even when there is no state cookie", async () => {
    const res = await fetch(`${base}/auth/discord/callback?code=abc`, { redirect: "manual" });
    expect(res.status).toBe(400);
  });

  it("rejects an OAuth callback whose state doesn't match the cookie", async () => {
    const res = await fetch(`${base}/auth/discord/callback?code=abc&state=attacker`, {
      headers: { Cookie: "oauth_state=expected" },
      redirect: "manual",
    });
    expect(res.status).toBe(400);
  });

  it("rejects tokens signed with a different algorithm or missing a user id", async () => {
    const wrongAlg = jwt.sign({ userId: "u1" }, process.env.JWT_SECRET!, { algorithm: "HS512" });
    const noUser = jwt.sign({ sub: "u1" }, process.env.JWT_SECRET!);
    for (const token of [wrongAlg, noUser]) {
      const res = await fetch(`${base}/api/me`, { headers: { Cookie: `token=${token}` } });
      expect(res.status).toBe(401);
    }
  });
});

describe("input validation", () => {
  it("rejects malformed availability date filters instead of erroring", async () => {
    const res = await fetch(`${base}/api/availability?from=yesterday`, { headers: { Cookie: cookieFor("u1") } });
    expect(res.status).toBe(400);
    expect(prismaMock.availabilityBlock.findMany).not.toHaveBeenCalled();
  });
});

describe("rate limiting", () => {
  it("limits writes per user with a JSON 429, without limiting reads", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "limited", timezone: "UTC" });
    const cookie = cookieFor("limited");
    const write = () =>
      fetch(`${base}/api/me/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: "{}",
      });

    let last: Response | undefined;
    for (let i = 0; i < 301; i++) last = await write();

    expect(last!.status).toBe(429);
    expect(await last!.json()).toEqual({
      error: "Too many changes in a short time. Wait a few minutes and try again.",
    });
    expect(last!.headers.get("ratelimit-policy")).toBeTruthy();

    // A different user isn't affected, and reads still work for the limited one
    expect((await fetch(`${base}/api/availability`, { headers: { Cookie: cookie } })).status).not.toBe(429);
    const other = await fetch(`${base}/api/me/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookieFor("someone-else") },
      body: "{}",
    });
    expect(other.status).toBe(400);
  });
});
