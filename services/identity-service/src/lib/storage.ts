import { Storage } from "@google-cloud/storage";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@tutor-advantage/shared-config";

let keyFilename: string | undefined = process.env.GCP_KEY_FILEPATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (keyFilename && keyFilename.startsWith(".")) {
  // If relative path, resolve from project root (4 levels up from this file, or using process.cwd() if run from root)
  // Assuming this file is in services/identity-service/src/lib/storage.ts
  keyFilename = path.resolve(__dirname, "../../../../", keyFilename);
}

// Verify keyFile exists, otherwise fallback to default auth (Workload Identity, ADC)
if (keyFilename && !fs.existsSync(keyFilename)) {
  logger.warn(`GCP keyfile not found at ${keyFilename}, falling back to Application Default Credentials`);
  keyFilename = undefined;
}

// Initialize GCS
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_PROJECT_ID,
  ...(keyFilename ? { keyFilename } : {}),
});

const bucketName = process.env.GCS_BUCKET_NAME || "tutor-advantage-verification";
const bucket = storage.bucket(bucketName);

const MAX_VERIFICATION_FILE_BYTES = 5 * 1024 * 1024;
const VERIFICATION_KEY = /^verification\/([A-Za-z0-9_-]+)\/([0-9a-f-]{36})\.(jpg|png|webp|pdf)$/i;

export class InvalidVerificationFileError extends Error {
  code = "INVALID_VERIFICATION_FILE";
}

const supportedTypes = new Map([
  ["image/jpeg", { extension: "jpg", matches: (buffer: Buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff }],
  ["image/png", { extension: "png", matches: (buffer: Buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) }],
  ["image/webp", { extension: "webp", matches: (buffer: Buffer) => buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP" }],
  ["application/pdf", { extension: "pdf", matches: (buffer: Buffer) => buffer.subarray(0, 5).toString("ascii") === "%PDF-" }],
]);

export function validateVerificationFile(file: Express.Multer.File): { mimeType: string; extension: string } {
  if (!file?.buffer || file.size > MAX_VERIFICATION_FILE_BYTES || file.buffer.length === 0) {
    throw new InvalidVerificationFileError("Verification document is empty or too large");
  }

  const type = supportedTypes.get(String(file.mimetype || "").toLowerCase());
  if (!type || !type.matches(file.buffer)) {
    throw new InvalidVerificationFileError("Unsupported document type or invalid file signature");
  }
  return { mimeType: String(file.mimetype).toLowerCase(), extension: type.extension };
}

export function isOwnedVerificationObjectKey(value: unknown, ownerId: string): value is string {
  if (typeof value !== "string" || !ownerId || value.includes("..") || value.includes("://")) {
    return false;
  }
  const match = VERIFICATION_KEY.exec(value);
  return Boolean(match && match[1] === ownerId);
}

function normalizeStorageReference(value: string): string | null {
  if (!value || value.includes("..")) return null;
  if (!value.startsWith("https://")) {
    return VERIFICATION_KEY.test(value) ? value : null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.hostname !== "storage.googleapis.com") return null;
    const prefix = `/${bucket.name}/`;
    if (!parsed.pathname.startsWith(prefix)) return null;
    const relativePath = decodeURIComponent(parsed.pathname.slice(prefix.length));
    return VERIFICATION_KEY.test(relativePath) ? relativePath : null;
  } catch {
    return null;
  }
}

export async function uploadToGCS(
  file: Express.Multer.File,
  ownerId: string,
  folder: string = "verification",
): Promise<string> {
  const detected = validateVerificationFile(file);
  if (folder !== "verification" || !/^[A-Za-z0-9_-]+$/.test(ownerId)) {
    throw new InvalidVerificationFileError("Invalid verification object owner");
  }

  // Never derive the object extension or owner from client-controlled input.
  const fileName = `${folder}/${ownerId}/${uuidv4()}.${detected.extension}`;
  const blob = bucket.file(fileName);

  const blobStream = blob.createWriteStream({
    resumable: false,
    contentType: detected.mimeType,
  });

  return new Promise((resolve, reject) => {
    blobStream.on("error", (err) => {
      reject(err);
    });

    blobStream.on("finish", async () => {
      resolve(fileName);
    });

    blobStream.end(file.buffer);
  });
}

export async function getSignedVerificationUrl(objectKey: string, ownerId: string): Promise<string | null> {
  if (!isOwnedVerificationObjectKey(objectKey, ownerId)) return null;
  try {
    const [signedUrl] = await bucket.file(objectKey).getSignedUrl({
      action: "read",
      expires: Date.now() + 10 * 60 * 1000,
    });
    return signedUrl;
  } catch (error) {
    logger.error("Failed to create verification read URL:", error);
    return null;
  }
}

export async function deleteFromGCS(reference: string): Promise<void> {
  try {
    const relativePath = normalizeStorageReference(reference);
    if (!relativePath) return;
    const file = bucket.file(relativePath);
    
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      logger.info(`Successfully deleted old object from GCS: ${relativePath}`);
    }
  } catch (error) {
    // Non-critical, don't crash if cleanup fails
    const err = error as Error;
    logger.error("Failed to cleanup old object from GCS:", err);
  }
}
