import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const gcs = vi.hoisted(() => {
  const blob = {
    createWriteStream: vi.fn(),
    getSignedUrl: vi.fn(),
    exists: vi.fn(),
    delete: vi.fn(),
  };
  const bucket = {
    name: "tutor-advantage-verification",
    file: vi.fn(() => blob),
  };
  const storage = {
    bucket: vi.fn(() => bucket),
  };

  return {
    blob,
    bucket,
    storage,
    Storage: vi.fn(function Storage() {
      return storage;
    }),
  };
});

const log = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@google-cloud/storage", () => ({ Storage: gcs.Storage }));
vi.mock("@tutor-advantage/shared-config", () => ({ logger: log }));

import {
  deleteFromGCS,
  getSignedVerificationUrl,
  uploadToGCS,
} from "./storage";

const pngFile = () => ({
  mimetype: "image/png",
  buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  size: 8,
} as Express.Multer.File);

const objectKey = "verification/user-1/123e4567-e89b-42d3-a456-426614174000.jpg";

describe("verification GCS operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gcs.bucket.file.mockReset().mockReturnValue(gcs.blob);
    gcs.blob.createWriteStream.mockReset();
    gcs.blob.getSignedUrl.mockReset();
    gcs.blob.exists.mockReset();
    gcs.blob.delete.mockReset();
  });

  it("uploads a validated file under the authenticated owner's key", async () => {
    const stream = Object.assign(new EventEmitter(), { end: vi.fn() });
    stream.end.mockImplementation(() => {
      stream.emit("finish");
    });
    gcs.blob.createWriteStream.mockReturnValue(stream);

    const file = pngFile();
    const result = await uploadToGCS(file, "user-1");

    expect(result).toMatch(/^verification\/user-1\/[0-9a-f-]{36}\.png$/);
    expect(gcs.bucket.file).toHaveBeenCalledWith(result);
    expect(gcs.blob.createWriteStream).toHaveBeenCalledWith({
      resumable: false,
      contentType: "image/png",
    });
    expect(stream.end).toHaveBeenCalledWith(file.buffer);
  });

  it("rejects when the GCS write stream emits an error", async () => {
    const stream = Object.assign(new EventEmitter(), { end: vi.fn() });
    const error = new Error("GCS unavailable");
    stream.end.mockImplementation(() => {
      stream.emit("error", error);
    });
    gcs.blob.createWriteStream.mockReturnValue(stream);

    await expect(uploadToGCS(pngFile(), "user-1")).rejects.toBe(error);
  });

  it("returns a signed URL only for an object owned by the user", async () => {
    gcs.blob.getSignedUrl.mockResolvedValue(["https://signed.example/object"]);

    await expect(getSignedVerificationUrl(objectKey, "user-1")).resolves.toBe(
      "https://signed.example/object",
    );
    await expect(getSignedVerificationUrl(objectKey, "user-2")).resolves.toBeNull();
    expect(gcs.blob.getSignedUrl).toHaveBeenCalledOnce();
  });

  it("normalizes a GCS URL before deleting the owned object", async () => {
    gcs.blob.exists.mockResolvedValue([true]);
    gcs.blob.delete.mockResolvedValue(undefined);

    await deleteFromGCS(
      `https://storage.googleapis.com/${gcs.bucket.name}/${objectKey}`,
    );

    expect(gcs.bucket.file).toHaveBeenCalledWith(objectKey);
    expect(gcs.blob.exists).toHaveBeenCalledOnce();
    expect(gcs.blob.delete).toHaveBeenCalledOnce();
    expect(log.info).toHaveBeenCalled();
  });
});
