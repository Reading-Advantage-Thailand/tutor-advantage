import { beforeEach, describe, expect, it, vi } from "vitest";

const scan = vi.hoisted(() => ({
  isPassportScanConfigured: vi.fn(() => true),
  scanPassportImage: vi.fn(),
}));
const log = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }));

vi.mock("../services/passportScan", () => scan);
vi.mock("@tutor-advantage/shared-config", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  logger: log,
}));

import { scanPassportPhoto } from "./passportScanController";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function response() {
  const res = {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, string>,
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      res.body = body;
      return res;
    }),
    set: vi.fn((name: string, value: string) => {
      res.headers[name] = value;
      return res;
    }),
  };
  return res;
}

async function post(file: Partial<Express.Multer.File> | undefined, user: unknown = { userId: "tutor-1", role: "TUTOR" }) {
  const res = response();
  await scanPassportPhoto({ id: "req-1", user, file } as never, res as never);
  return res;
}

const jpegFile = { buffer: JPEG, size: JPEG.length, mimetype: "image/jpeg" };

describe("scanPassportPhoto", () => {
  beforeEach(() => {
    scan.isPassportScanConfigured.mockReturnValue(true);
  });

  it("returns the suggested values without caching them", async () => {
    const result = { fields: { passportNumber: "533401372" }, confirmed: ["passportNumber"] };
    scan.scanPassportImage.mockResolvedValue(result);

    const res = await post(jpegFile);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ scan: result });
    expect(res.headers["Cache-Control"]).toBe("no-store");
    expect(scan.scanPassportImage).toHaveBeenCalledWith({ buffer: JPEG, mimeType: "image/jpeg" });
  });

  it("never logs the values it read", async () => {
    scan.scanPassportImage.mockResolvedValue({ fields: { passportNumber: "533401372", fullName: "JOHN SMITH" }, confirmed: [] });
    await post(jpegFile);
    expect(JSON.stringify(log.info.mock.calls)).not.toMatch(/533401372|JOHN SMITH/);
  });

  it("rejects a missing file, a fake image and an unauthenticated request", async () => {
    expect((await post(undefined)).statusCode).toBe(400);
    const fake = await post({ buffer: Buffer.from("not an image"), size: 12, mimetype: "image/jpeg" });
    expect(fake.statusCode).toBe(400);
    expect(fake.body.error.code).toBe("INVALID_VERIFICATION_FILE");
    expect((await post(jpegFile, null)).statusCode).toBe(401);
    expect(scan.scanPassportImage).not.toHaveBeenCalled();
  });

  it("answers 503 when the scan is not configured", async () => {
    scan.isPassportScanConfigured.mockReturnValue(false);
    const res = await post(jpegFile);
    expect(res.statusCode).toBe(503);
    expect(res.body.error.code).toBe("PASSPORT_SCAN_UNAVAILABLE");
  });

  it("answers 422 when no passport data was found", async () => {
    scan.scanPassportImage.mockResolvedValue(null);
    const res = await post(jpegFile);
    expect(res.statusCode).toBe(422);
    expect(res.body.error.code).toBe("PASSPORT_NOT_READABLE");
  });

  it("answers 502 on a provider failure and logs only the error type", async () => {
    const failure = Object.assign(new Error("No object generated"), { name: "AI_NoObjectGeneratedError", text: '{"passportNumber":"533401372"}' });
    scan.scanPassportImage.mockRejectedValue(failure);

    const res = await post(jpegFile);

    expect(res.statusCode).toBe(502);
    expect(res.body.error.code).toBe("PASSPORT_SCAN_FAILED");
    expect(log.error).toHaveBeenCalledWith("Passport scan failed", { userId: "tutor-1", errorName: "AI_NoObjectGeneratedError" });
    expect(JSON.stringify(log.error.mock.calls)).not.toContain("533401372");
  });
});
