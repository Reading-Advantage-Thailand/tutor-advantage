import { describe, expect, it } from "vitest";
import {
  InvalidVerificationFileError,
  isOwnedVerificationObjectKey,
  validateVerificationFile,
} from "./storage";

const file = (mimetype: string, buffer: Buffer) => ({
  mimetype,
  buffer,
  size: buffer.length,
} as Express.Multer.File);

describe("verification storage validation", () => {
  it("requires an approved MIME type and matching magic bytes", () => {
    expect(validateVerificationFile(file("image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))).toEqual({
      mimeType: "image/png",
      extension: "png",
    });
    expect(() => validateVerificationFile(file("image/png", Buffer.from("not an image")))).toThrow(InvalidVerificationFileError);
    expect(() => validateVerificationFile(file("application/octet-stream", Buffer.from("MZ")))).toThrow(InvalidVerificationFileError);
  });

  it("accepts the magic bytes for every supported document type", () => {
    expect(validateVerificationFile(file("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0])))).toEqual({
      mimeType: "image/jpeg",
      extension: "jpg",
    });
    expect(validateVerificationFile(file("image/webp", Buffer.from("RIFFxxxxWEBP")))).toEqual({
      mimeType: "image/webp",
      extension: "webp",
    });
    expect(validateVerificationFile(file("application/pdf", Buffer.from("%PDF-1.7")))).toEqual({
      mimeType: "application/pdf",
      extension: "pdf",
    });
  });

  it("only accepts object keys owned by the authenticated user", () => {
    const key = "verification/user-1/123e4567-e89b-42d3-a456-426614174000.jpg";
    expect(isOwnedVerificationObjectKey(key, "user-1")).toBe(true);
    expect(isOwnedVerificationObjectKey(key, "user-2")).toBe(false);
    expect(isOwnedVerificationObjectKey("https://attacker.example/document.jpg", "user-1")).toBe(false);
  });
});
