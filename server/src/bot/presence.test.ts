import { describe, expect, it, vi } from "vitest";
import type { Client } from "discord.js";

vi.mock("./client", () => ({ getBot: () => null }));
import { getPresence } from "./presence";

// Minimal stand-in for the discord.js caches getPresence reads
function guild(id: string, presences: Record<string, string>, members: string[]) {
  return {
    id,
    presences: { cache: new Map(Object.entries(presences).map(([u, status]) => [u, { status }])) },
    members: { cache: new Map(members.map((u) => [u, {}])), fetch: vi.fn() },
  };
}
function bot(...guilds: ReturnType<typeof guild>[]) {
  return { guilds: { cache: new Map(guilds.map((g) => [g.id, g])) } } as unknown as Client<true>;
}

describe("getPresence", () => {
  it("maps cached presences and treats cached members without one as offline", () => {
    const g = guild("g1", { a: "online", b: "idle", c: "dnd" }, ["a", "b", "c", "d"]);
    const result = getPresence(["a", "b", "c", "d"], {}, bot(g));
    expect(Object.fromEntries(result)).toEqual({ a: "online", b: "idle", c: "dnd", d: "offline" });
  });

  it("reports invisible as offline", () => {
    const g = guild("g1", { a: "invisible" }, ["a"]);
    expect(getPresence(["a"], {}, bot(g)).get("a")).toBe("offline");
  });

  it("returns unknown for users the bot cannot see", () => {
    const g = guild("g1", { a: "online" }, ["a"]);
    expect(getPresence(["stranger"], {}, bot(g)).get("stranger")).toBe("unknown");
  });

  it("finds a user through any shared server", () => {
    const g1 = guild("g1", {}, ["a"]);
    const g2 = guild("g2", { b: "online" }, ["b"]);
    const result = getPresence(["a", "b"], {}, bot(g1, g2));
    expect(Object.fromEntries(result)).toEqual({ a: "offline", b: "online" });
  });

  it("returns unknown for everyone when the bot is not running", () => {
    expect(Object.fromEntries(getPresence(["a", "b"], {}, null))).toEqual({ a: "unknown", b: "unknown" });
  });

  it("reads only from cache, never fetching from Discord", () => {
    const g1 = guild("g1", { a: "online" }, ["a"]);
    const g2 = guild("g2", {}, ["b"]);
    getPresence(["a", "b", "c"], { preferGuildId: "g2" }, bot(g1, g2));
    expect(g1.members.fetch).not.toHaveBeenCalled();
    expect(g2.members.fetch).not.toHaveBeenCalled();
  });
});
