import path from "path";
import fs from "fs";
import { Storage, type Bucket } from "@google-cloud/storage";
import { logger } from "@tutor-advantage/shared-config";

/*
 * Short-lived read URLs for tutor identity documents shown in the admin
 * console. identity-service stores owner-bound object keys
 * (`verification/<userId>/<uuid>.<ext>`); a browser cannot load a bare key
 * (it resolves against the admin page URL and 404s), so the admin API must
 * return a signed URL. Same key rules as identity-service/src/lib/storage.ts.
 */

const VERIFICATION_KEY = /^verification\/([A-Za-z0-9_-]+)\/([0-9a-f-]{36})\.(jpg|png|webp|pdf)$/i;
const SIGNED_URL_TTL_MS = 10 * 60 * 1000;

let cachedBucket: Bucket | null = null;

/**
 * The bucket must be configured explicitly (GCS_BUCKET_NAME, same value as
 * identity-service). We never guess a default: signing for the wrong bucket
 * would hand admins dead links. Returns null (document hidden) when unset.
 */
function getBucket(): Bucket | null {
  if (cachedBucket) return cachedBucket;
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    logger.warn("GCS_BUCKET_NAME is not set: admin verification documents are hidden");
    return null;
  }
  let keyFilename: string | undefined = process.env.GCP_KEY_FILEPATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyFilename && keyFilename.startsWith(".")) {
    // services/finance-mlm-service/src/lib -> repo root is 4 levels up
    keyFilename = path.resolve(__dirname, "../../../../", keyFilename);
  }
  if (keyFilename && !fs.existsSync(keyFilename)) {
    logger.warn(`GCP keyfile not found at ${keyFilename}, falling back to Application Default Credentials`);
    keyFilename = undefined;
  }
  const storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_PROJECT_ID,
    ...(keyFilename ? { keyFilename } : {}),
  });
  cachedBucket = storage.bucket(bucketName);
  return cachedBucket;
}

/** Owner-bound object key for a stored value, or null when it is not one we can trust. */
export function verificationObjectKey(value: string | null | undefined, ownerId: string): string | null {
  if (!value || !ownerId || value.includes("..")) return null;
  let key: string | null = null;
  if (!value.startsWith("https://")) {
    key = value;
  } else {
    // Legacy rows may still hold the public GCS URL of the object.
    try {
      const parsed = new URL(value);
      const bucket = getBucket();
      if (!bucket) return null;
      const prefix = `/${bucket.name}/`;
      if (parsed.hostname !== "storage.googleapis.com" || !parsed.pathname.startsWith(prefix)) return null;
      key = decodeURIComponent(parsed.pathname.slice(prefix.length));
    } catch {
      return null;
    }
  }
  const match = VERIFICATION_KEY.exec(key);
  return match && match[1] === ownerId ? key : null;
}

/** Signed read URL for the document, or null (no document / untrusted value / signing failed). */
export async function signVerificationDocument(
  value: string | null | undefined,
  ownerId: string,
): Promise<string | null> {
  const key = verificationObjectKey(value, ownerId);
  if (!key) return null;
  const bucket = getBucket();
  if (!bucket) return null;
  try {
    const [url] = await bucket.file(key).getSignedUrl({ action: "read", expires: Date.now() + SIGNED_URL_TTL_MS });
    return url;
  } catch (error) {
    logger.error("Failed to create admin verification read URL:", error);
    return null;
  }
}
