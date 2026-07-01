import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOmiseCharge,
  createOmiseRecipient,
  createOmiseTransfer,
  downloadOmiseDocumentAsDataUri,
  getOmisePublicKey,
  isOmiseConfigured,
  retrieveOmiseCharge,
  retrieveOmiseTransfer,
} from "./omiseService";

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("omiseService", () => {
  beforeEach(() => {
    vi.stubEnv("OMISE_PRIVATE_KEY", "skey_test");
    vi.stubEnv("OMISE_PUBLIC_KEY", "pkey_test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reports configuration and exposes the public key", () => {
    expect(isOmiseConfigured()).toBe(true);
    expect(getOmisePublicKey()).toBe("pkey_test");
  });

  it("creates a PromptPay charge with encoded metadata", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: "chrg_1", status: "pending" }));
    vi.stubGlobal("fetch", fetchMock);

    await createOmiseCharge({
      amount: 300_000,
      currency: "THB",
      description: "Enrollment payment",
      paymentIntentId: "pi-1",
      enrollmentId: "en-1",
      studentUserId: "student-1",
      returnUri: "https://example.test/return",
      method: "promptpay",
      ip: "127.0.0.1",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = init.body as URLSearchParams;
    expect(url).toBe("https://api.omise.co/charges");
    expect(init.method).toBe("POST");
    expect(body.get("source[type]")).toBe("promptpay");
    expect(body.get("metadata[paymentIntentId]")).toBe("pi-1");
    expect(body.get("currency")).toBe("thb");
    expect(init.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("skey_test:").toString("base64")}`,
    });
  });

  it("requires a card token before calling Omise", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createOmiseCharge({
        amount: 100,
        currency: "THB",
        description: "Card payment",
        paymentIntentId: "pi-1",
        enrollmentId: "en-1",
        studentUserId: "student-1",
        returnUri: "https://example.test/return",
        method: "card",
      }),
    ).rejects.toThrow("OMISE_CARD_TOKEN_REQUIRED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates recipients and transfers with the expected form fields", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "recp_1" }))
      .mockResolvedValueOnce(jsonResponse({ id: "trsf_1" }));
    vi.stubGlobal("fetch", fetchMock);

    await createOmiseRecipient({
      name: "Tutor",
      email: "tutor@example.test",
      bankAccountBrand: "bbl",
      bankAccountNumber: "1234567890",
      bankAccountName: "Tutor Name",
    });
    await createOmiseTransfer({
      amount: 9_700,
      recipient: "recp_1",
      failFast: false,
      metadata: { payoutLineId: "line-1" },
    });

    const recipientBody = fetchMock.mock.calls[0][1].body as URLSearchParams;
    const transferBody = fetchMock.mock.calls[1][1].body as URLSearchParams;
    expect(recipientBody.get("bank_account[number]")).toBe("1234567890");
    expect(transferBody.get("fail_fast")).toBe("false");
    expect(transferBody.get("metadata[payoutLineId]")).toBe("line-1");
  });

  it("URL-encodes resource identifiers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "charge" }))
      .mockResolvedValueOnce(jsonResponse({ id: "transfer" }));
    vi.stubGlobal("fetch", fetchMock);

    await retrieveOmiseCharge("charge/with space");
    await retrieveOmiseTransfer("transfer/with space");

    expect(fetchMock.mock.calls[0][0]).toContain(
      "/charges/charge%2Fwith%20space",
    );
    expect(fetchMock.mock.calls[1][0]).toContain(
      "/transfers/transfer%2Fwith%20space",
    );
  });

  it("rejects document URLs outside the Omise charge path", async () => {
    await expect(
      downloadOmiseDocumentAsDataUri("https://attacker.test/charges/1"),
    ).rejects.toThrow("INVALID_OMISE_DOCUMENT_URL");
    await expect(
      downloadOmiseDocumentAsDataUri("https://api.omise.co/transfers/1"),
    ).rejects.toThrow("INVALID_OMISE_DOCUMENT_URL");
  });

  it("downloads an approved document as a data URI", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(Uint8Array.from([1, 2, 3]), {
          headers: { "content-type": "image/png" },
        }),
      ),
    );

    const result = await downloadOmiseDocumentAsDataUri(
      "https://api.omise.co/charges/chrg_1/documents/qr.png",
    );
    expect(result).toBe("data:image/png;base64,AQID");
  });

  it("surfaces Omise error messages and missing credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ message: "bad request" }, 400)),
    );
    await expect(retrieveOmiseCharge("chrg_1")).rejects.toThrow("bad request");

    vi.stubEnv("OMISE_PRIVATE_KEY", "");
    await expect(retrieveOmiseCharge("chrg_1")).rejects.toThrow(
      "OMISE_PRIVATE_KEY_NOT_CONFIGURED",
    );
  });
});
