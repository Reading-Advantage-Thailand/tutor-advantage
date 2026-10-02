import { describe, expect, it, vi } from "vitest";
import {
  buildEnrollLoginRedirect,
  buildEnrollPaymentHref,
  classifyEnrollError,
  getEnrollCtaKind,
  getEnrollSeatState,
  isRetryableEnrollLoadError,
  mapEnrollClassDetails,
  requestFreeEnrollment,
} from "./enrollFlow";

describe("mapEnrollClassDetails", () => {
  it("maps class details and defaults the tutor name", () => {
    expect(
      mapEnrollClassDetails({
        id: "c1",
        name: "Reading A1",
        tutor: null,
        book: "Book",
        price: 0,
        maxStudents: 10,
        students: 4,
        cefr: "A1",
        schedule: "เสาร์ 09:00-10:00",
        totalHours: 0,
      }),
    ).toEqual({
      classId: "c1",
      className: "Reading A1",
      tutorName: "Tutor Advantage",
      tutorPictureUrl: null,
      bookTitle: "Book",
      price: 0,
      maxStudents: 10,
      currentStudents: 4,
      cefrLevel: "A1",
      schedule: "เสาร์ 09:00-10:00",
      totalHours: null,
    });
  });

  it("keeps positive live hours", () => {
    const mapped = mapEnrollClassDetails({
      id: "c",
      name: "n",
      tutor: { name: "ครูเอ", pictureUrl: "https://x/p.png" },
      book: "b",
      price: 1,
      maxStudents: 1,
      students: 0,
      cefr: "A2",
      schedule: "s",
      totalHours: 23,
    });
    expect(mapped.totalHours).toBe(23);
    expect(mapped.tutorName).toBe("ครูเอ");
  });
});

describe("getEnrollSeatState", () => {
  it("flags full, busy and urgent classes", () => {
    expect(getEnrollSeatState(4, 30)).toEqual({ spotsLeft: 26, isFull: false, spotsPercent: 13, busy: false, urgent: false });
    expect(getEnrollSeatState(27, 30)).toMatchObject({ spotsLeft: 3, isFull: false, busy: true, urgent: true });
    expect(getEnrollSeatState(30, 30)).toMatchObject({ spotsLeft: 0, isFull: true, spotsPercent: 100, urgent: false });
    expect(getEnrollSeatState(31, 30)).toMatchObject({ isFull: true, spotsPercent: 100 });
    expect(getEnrollSeatState(0, 0)).toMatchObject({ isFull: true, spotsPercent: 100 });
  });
});

describe("routes", () => {
  it("builds the payment href with classId and optional referralToken", () => {
    expect(buildEnrollPaymentHref("c1", null)).toBe("/payment?classId=c1");
    expect(buildEnrollPaymentHref("c1", "tok en")).toBe("/payment?classId=c1&referralToken=tok+en");
  });

  it("re-encodes the whole enroll query into the login redirect", () => {
    expect(buildEnrollLoginRedirect("classId=c1&token=t")).toBe(
      `/login?redirect=${encodeURIComponent("/enroll?classId=c1&token=t")}`,
    );
  });
});

describe("requestFreeEnrollment", () => {
  it("uses the referral token when there is one", async () => {
    const api = { enrollByReferral: vi.fn().mockResolvedValue({ status: "ACTIVE" }), enrollClass: vi.fn() };
    await expect(requestFreeEnrollment(api, "c1", "tok")).resolves.toEqual({ status: "ACTIVE" });
    expect(api.enrollByReferral).toHaveBeenCalledWith("tok");
    expect(api.enrollClass).not.toHaveBeenCalled();
  });

  it("falls back to the direct class enrollment", async () => {
    const api = { enrollByReferral: vi.fn(), enrollClass: vi.fn().mockResolvedValue({}) };
    await requestFreeEnrollment(api, "c1", null);
    expect(api.enrollClass).toHaveBeenCalledWith("c1", null);
    expect(api.enrollByReferral).not.toHaveBeenCalled();
  });
});

describe("classifyEnrollError", () => {
  it("reads codes and messages from the learning service", () => {
    expect(classifyEnrollError({ status: 400, code: "CLASS_FULL", message: "full" })).toBe("classFull");
    expect(classifyEnrollError({ status: 400, code: "BAD_REQUEST", message: "CLASS_FULL" })).toBe("classFull");
    expect(classifyEnrollError({ status: 400, code: "BAD_REQUEST", message: "CLASS_CLOSED" })).toBe("classClosed");
    expect(classifyEnrollError({ status: 404, code: "REFERRAL_INVALID" })).toBe("linkInvalid");
    expect(classifyEnrollError({ status: 400, message: "DEMO_EXPIRED" })).toBe("demoExpired");
    expect(classifyEnrollError({ status: 403, code: "TUTOR_CANNOT_ENROLL_OWN_CLASS" })).toBe("ownClass");
    expect(classifyEnrollError({ status: 404, code: "NOT_FOUND" })).toBe("notFound");
    expect(classifyEnrollError({ status: 403, code: "FORBIDDEN" })).toBe("classClosed");
  });

  it("falls back to generic", () => {
    expect(classifyEnrollError(new TypeError("Failed to fetch"))).toBe("generic");
    expect(classifyEnrollError(null)).toBe("generic");
    expect(classifyEnrollError("boom")).toBe("generic");
  });
});

describe("CTA and retry rules", () => {
  it("only offers a retry for generic load failures", () => {
    expect(isRetryableEnrollLoadError("generic")).toBe(true);
    expect(isRetryableEnrollLoadError("notFound")).toBe(false);
    expect(isRetryableEnrollLoadError("linkInvalid")).toBe(false);
  });

  it("picks the CTA: full wins, then free vs paid", () => {
    expect(getEnrollCtaKind(true, 0)).toBe("full");
    expect(getEnrollCtaKind(false, 0)).toBe("free");
    expect(getEnrollCtaKind(false, 2500)).toBe("continue");
  });
});
