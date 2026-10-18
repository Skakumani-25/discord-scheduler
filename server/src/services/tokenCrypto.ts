import crypto from "node:crypto";

// AES-256-GCM for secrets at rest. Stored format: "v1:<base64 of iv | tag | ciphertext>"
const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

let cachedKey: Buffer | null = null;
let warned = false;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  let secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("TOKEN_ENCRYPTION_KEY (or JWT_SECRET) must be set");
    if (!warned) {
      console.warn("TOKEN_ENCRYPTION_KEY not set; deriving the token encryption key from JWT_SECRET");
      warned = true;
    }
  }
  cachedKey = crypto.createHash("sha256").update(`token-encryption:${secret}`).digest();
  return cachedKey;
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${VERSION}:${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64")}`;
}

// Returns null if the value is malformed, tampered with, or was encrypted with another key
export function decryptSecret(stored: string): string | null {
  const [version, payload] = stored.split(":");
  if (version !== VERSION || !payload) return null;
  const buf = Buffer.from(payload, "base64");
  if (buf.length <= IV_BYTES + TAG_BYTES) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), buf.subarray(0, IV_BYTES));
    decipher.setAuthTag(buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([
      decipher.update(buf.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

// For tests that change the env between cases
export function resetKeyCache() {
  cachedKey = null;
}
