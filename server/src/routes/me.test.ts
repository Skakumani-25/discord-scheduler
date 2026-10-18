import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
}));
vi.mock("../db", () => ({ prisma: prismaMock }));
const recomputeUserReminders = vi.hoisted(() => vi.fn());
vi.mock("../services/reminderSync", () => ({ recomputeUserReminders }));

import meRouter from "./me";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.locals.userId = "u1";
    next();
  });
  app.use("/api/me", meRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/me`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  vi.resetAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({ reminderMinutes: 15 });
  prismaMock.user.update.mockImplementation(async ({ data }) => ({ id: "u1", timezone: "UTC", reminderMinutes: 15, ...data }));
});

const put = (body: unknown) =>
  fetch(`${baseUrl}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("PUT /api/me/settings", () => {
  it.each(["America/New_York", "UTC", "America/Argentina/Buenos_Aires", "Etc/GMT+5", "Asia/Calcutta"])(
    "accepts the IANA zone %s",
    async (timezone) => {
      const res = await put({ timezone });
      expect(res.status).toBe(200);
      expect((await res.json()).timezone).toBe(timezone);
      expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { timezone } });
    }
  );

  it.each([["Mars/Olympus_Mons"], ["EST"], ["+05:00"], [""], [123], ["America/New_York; DROP"]])(
    "rejects the timezone %j",
    async (timezone) => {
      expect((await put({ timezone })).status).toBe(400);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    }
  );

  it.each([[-1], [1.5], ["15"], [10081], [null]])("rejects reminderMinutes %j", async (reminderMinutes) => {
    expect((await put({ reminderMinutes })).status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("accepts 0 (remind at start) and recomputes reminders when the lead time changes", async () => {
    const res = await put({ reminderMinutes: 0 });
    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { reminderMinutes: 0 } });
    expect(recomputeUserReminders).toHaveBeenCalledWith("u1");
  });

  it("does not recompute when the lead time is unchanged", async () => {
    await put({ reminderMinutes: 15, timezone: "Europe/London" });
    expect(recomputeUserReminders).not.toHaveBeenCalled();
  });

  it("saves the show-presence setting", async () => {
    expect((await put({ showPresence: false })).status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { showPresence: false } });
  });

  it.each([["yes"], [1], [null]])("rejects showPresence %j", async (showPresence) => {
    expect((await put({ showPresence })).status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("rejects an empty update", async () => {
    expect((await put({})).status).toBe(400);
  });
});

describe("PUT /api/me/status", () => {
  const putStatus = (body: unknown) =>
    fetch(`${baseUrl}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  it("saves a status and returns it in effective form", async () => {
    prismaMock.user.update.mockImplementation(async ({ data }) => ({ id: "u1", username: "alice", ...data }));
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();

    const res = await putStatus({ status: "BUSY", note: "studying", expiresAt });

    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { status: "BUSY", statusNote: "studying", statusExpiresAt: new Date(expiresAt) },
    });
    expect((await res.json()).status).toEqual({ status: "BUSY", note: "studying", expiresAt });
  });

  it("clears the status", async () => {
    prismaMock.user.update.mockImplementation(async ({ data }) => ({ id: "u1", ...data }));
    const res = await putStatus({ status: null });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBeNull();
  });

  it("rejects an invalid status without writing", async () => {
    expect((await putStatus({ status: "INVISIBLE" })).status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
