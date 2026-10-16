import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/*
 * Field-level encryption for identity document numbers (passport numbers).
 *
 * AES-256-GCM with a 32-byte key from PII_ENCRYPTION_KEY (base64). The stored
 * value is "v1:<iv>:<tag>:<ciphertext>" (base64 parts), so the key can be
 * rotated later by adding a v2 prefix.
 */

const VERSION = "v1";

function loadKey(): Buffer {
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw) throw new Error("PII_ENCRYPTION_KEY is not configured");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("PII_ENCRYPTION_KEY must be 32 bytes (base64)");
  return key;
}

export function isPiiEncryptionConfigured(): boolean {
  try {
    loadKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptPii(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", loadKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptPii(stored: string): string {
  const [version, iv, tag, ciphertext] = stored.split(":");
  if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
    throw new Error("Unsupported encrypted PII format");
  }
  const decipher = createDecipheriv("aes-256-gcm", loadKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}
