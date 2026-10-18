import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, resetKeyCache } from "./tokenCrypto";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
  resetKeyCache();
});

describe("tokenCrypto", () => {
  it("round-trips a secret without storing it in plain text", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "key-one";
    const stored = encryptSecret("my-access-token");
    expect(stored).toMatch(/^v1:/);
    expect(stored).not.toContain("my-access-token");
    expect(decryptSecret(stored)).toBe("my-access-token");
  });

  it("uses a fresh IV each time", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "key-one";
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("returns null for tampered ciphertext", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "key-one";
    const buf = Buffer.from(encryptSecret("secret").slice(3), "base64");
    buf[buf.length - 1] ^= 1;
    expect(decryptSecret(`v1:${buf.toString("base64")}`)).toBeNull();
  });

  it("returns null when the key changed", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "key-one";
    const stored = encryptSecret("secret");
    process.env.TOKEN_ENCRYPTION_KEY = "key-two";
    resetKeyCache();
    expect(decryptSecret(stored)).toBeNull();
  });

  it("returns null for malformed values", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "key-one";
    expect(decryptSecret("plaintext-token")).toBeNull();
    expect(decryptSecret("v1:")).toBeNull();
    expect(decryptSecret("v1:AAAA")).toBeNull();
  });

  it("falls back to JWT_SECRET when TOKEN_ENCRYPTION_KEY is unset", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    process.env.JWT_SECRET = "jwt-secret";
    expect(decryptSecret(encryptSecret("secret"))).toBe("secret");
  });
});
