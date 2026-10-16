import { beforeEach, describe, expect, it, vi } from "vitest";

const gcs = vi.hoisted(() => ({
  getSignedUrl: vi.fn(),
  file: vi.fn(),
}));

vi.mock("@google-cloud/storage", () => ({
  Storage: class {
    bucket() {
      return {
        name: "tutor-advantage-verification",
        file: (key: string) => {
          gcs.file(key);
          return { getSignedUrl: gcs.getSignedUrl };
        },
      };
    }
  },
}));

vi.mock("@tutor-advantage/shared-config", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

process.env.GCS_BUCKET_NAME = "tutor-advantage-verification";

import { signVerificationDocument, verificationObjectKey } from "./documentUrl";

const OWNER = "c4b1fc73-5f03-45e0-a0db-20c4d6cbaba1";
const KEY = `verification/${OWNER}/aaaaaaaa-2222-4333-8444-555555555555.png`;

describe("verificationObjectKey", () => {
  it("accepts an owner-bound key", () => {
    expect(verificationObjectKey(KEY, OWNER)).toBe(KEY);
  });

  it("accepts a legacy public GCS URL of the owner's object", () => {
    const legacy = `https://storage.googleapis.com/tutor-advantage-verification/${KEY}`;
    expect(verificationObjectKey(legacy, OWNER)).toBe(KEY);
  });

  it("rejects another user's key, traversal, foreign hosts and junk", () => {
    expect(verificationObjectKey(KEY, "someone-else")).toBeNull();
    expect(verificationObjectKey(`verification/${OWNER}/../x/aaaaaaaa-2222-4333-8444-555555555555.png`, OWNER)).toBeNull();
    expect(verificationObjectKey(`https://evil.example/tutor-advantage-verification/${KEY}`, OWNER)).toBeNull();
    expect(verificationObjectKey("/id.png", OWNER)).toBeNull();
    expect(verificationObjectKey("", OWNER)).toBeNull();
    expect(verificationObjectKey(null, OWNER)).toBeNull();
  });
});

describe("signVerificationDocument", () => {
  beforeEach(() => {
    gcs.getSignedUrl.mockReset();
    gcs.file.mockReset();
  });

  it("returns a signed URL for the owner's key", async () => {
    gcs.getSignedUrl.mockResolvedValue(["https://signed.example/object"]);
    await expect(signVerificationDocument(KEY, OWNER)).resolves.toBe("https://signed.example/object");
    expect(gcs.file).toHaveBeenCalledWith(KEY);
  });

  it("never signs a key that belongs to someone else", async () => {
    await expect(signVerificationDocument(KEY, "someone-else")).resolves.toBeNull();
    expect(gcs.getSignedUrl).not.toHaveBeenCalled();
  });

  it("returns null when signing fails", async () => {
    gcs.getSignedUrl.mockRejectedValue(new Error("no credentials"));
    await expect(signVerificationDocument(KEY, OWNER)).resolves.toBeNull();
  });

  it("fails closed (null, no signing) when GCS_BUCKET_NAME is not configured", async () => {
    const saved = process.env.GCS_BUCKET_NAME;
    delete process.env.GCS_BUCKET_NAME;
    vi.resetModules();
    try {
      const fresh = await import("./documentUrl");
      await expect(fresh.signVerificationDocument(KEY, OWNER)).resolves.toBeNull();
      expect(gcs.getSignedUrl).not.toHaveBeenCalled();
    } finally {
      process.env.GCS_BUCKET_NAME = saved;
    }
  });
});
