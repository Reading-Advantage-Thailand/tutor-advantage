import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleTransferWebhook } from "./transferWebhookController";

const prisma = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
}));

vi.mock("@tutor-advantage/database", () => ({ prisma }));

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

describe("transfer webhook verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("OMISE_WEBHOOK_SECRET", "");
    vi.stubEnv("NODE_ENV", "staging");
    vi.stubEnv("ENABLE_DEV_ROUTES", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed in staging when the webhook secret is missing", async () => {
    const req = {
      body: { id: "evt-1", key: "transfer.pay", data: { id: "trsf-1" } },
      headers: {},
    };
    const res = response();

    await handleTransferWebhook(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("allows unsigned local webhook tests only behind the explicit dev flag", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_DEV_ROUTES", "true");
    prisma.$queryRaw.mockResolvedValue([{ transfer_status: "PENDING_TRANSFER" }]);

    const req = {
      body: { id: "evt-1", key: "transfer.pay", data: { id: "trsf-1" } },
      headers: {},
    };
    const res = response();

    await handleTransferWebhook(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it("accepts a correctly signed webhook", async () => {
    const payload = { id: "evt-1", key: "transfer.pay", data: { id: "trsf-1" } };
    const rawBody = JSON.stringify(payload);
    const timestamp = "1723950000";
    const secret = "c2VjcmV0";
    vi.stubEnv("OMISE_WEBHOOK_SECRET", secret);
    const signature = crypto
      .createHmac("sha256", Buffer.from(secret, "base64"))
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");
    prisma.$queryRaw.mockResolvedValue([{ transfer_status: "PENDING_TRANSFER" }]);

    const req = {
      body: payload,
      rawBody,
      headers: {
        "omise-signature": `sha256=${signature}`,
        "omise-signature-timestamp": timestamp,
      },
    };
    const res = response();

    await handleTransferWebhook(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });
});
