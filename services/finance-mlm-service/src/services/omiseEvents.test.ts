import { describe, expect, it } from "vitest";
import { classifyOmiseEvent, disputeTakesFunds, refundState } from "./omiseEvents";

describe("classifyOmiseEvent", () => {
  it("reads the charge id from refund and dispute objects", () => {
    expect(classifyOmiseEvent({
      key: "refund.create",
      data: { object: "refund", id: "rfnd_1", charge: "chrg_1" },
    })).toMatchObject({ kind: "refund", chargeId: "chrg_1", metadataPaymentIntentId: null });

    expect(classifyOmiseEvent({
      key: "dispute.update",
      data: { object: "dispute", id: "dspt_1", status: "lost", charge: { id: "chrg_2" } },
    })).toMatchObject({ kind: "chargeback", chargeId: "chrg_2", disputeStatus: "lost" });
  });

  it("keeps charge events and older refund payloads working", () => {
    expect(classifyOmiseEvent({
      key: "charge.complete",
      data: { object: "charge", id: "chrg_1", metadata: { paymentIntentId: "pi-1" } },
    })).toMatchObject({ kind: "charge", chargeId: "chrg_1", metadataPaymentIntentId: "pi-1" });

    expect(classifyOmiseEvent({
      type: "charge.refunded",
      data: { id: "chrg_1", metadata: { paymentIntentId: "pi-1" } },
    })).toMatchObject({ kind: "refund", chargeId: "chrg_1", metadataPaymentIntentId: "pi-1" });
  });
});

describe("refundState / disputeTakesFunds", () => {
  it("tells full, partial and no refunds apart", () => {
    expect(refundState({ amount: 1000, refunded_amount: 1000 })).toBe("full");
    expect(refundState({ amount: 1000, refunded_amount: 400 })).toBe("partial");
    expect(refundState({ amount: 1000, refunded_amount: 0 })).toBe("none");
    expect(refundState({ amount: 1000 })).toBe("full");
  });

  it("only a won/closed dispute leaves the money with us", () => {
    expect(disputeTakesFunds("open")).toBe(true);
    expect(disputeTakesFunds("lost")).toBe(true);
    expect(disputeTakesFunds(null)).toBe(true);
    expect(disputeTakesFunds("won")).toBe(false);
  });
});
