import { describe, expect, it } from "vitest";
import { getLoginError, identityCallbackErrorCode } from "./login-error";

describe("getLoginError", () => {
  it("shows nothing without an error code", () => {
    expect(getLoginError(undefined)).toBeNull();
    expect(getLoginError("")).toBeNull();
  });

  it("explains a Google account that is not registered as a tutor", () => {
    expect(getLoginError("not_tutor")).toEqual({
      tone: "warning",
      message: "บัญชีนี้ยังไม่ได้ลงทะเบียนเป็นครู กรุณาเข้าสู่ระบบด้วยอีเมลที่แจ้งกับทีมงาน หรือติดต่อแอดมิน",
    });
  });

  it("maps the OAuth callback errors that used to be silent", () => {
    expect(getLoginError("invalid_state")?.message).toBe("การเข้าสู่ระบบหมดเวลา กรุณากดเข้าสู่ระบบด้วย Google อีกครั้ง");
    expect(getLoginError("missing_code")?.message).toBe("เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    expect(getLoginError("server_error")).toEqual({ tone: "danger", message: "ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง" });
    expect(getLoginError("account_suspended")?.tone).toBe("danger");
  });

  it("explains an unverified Google email that cannot claim an account", () => {
    expect(getLoginError("email_not_verified")).toEqual({
      tone: "warning",
      message: "อีเมลของบัญชี Google นี้ยังไม่ได้ยืนยัน กรุณายืนยันอีเมลกับ Google ก่อน หรือติดต่อแอดมิน",
    });
  });

  it("picks the callback error code from the identity-service rejection", () => {
    expect(
      identityCallbackErrorCode({ error: { code: "UNAUTHORIZED", details: "EMAIL_NOT_VERIFIED" } }),
    ).toBe("email_not_verified");
    expect(identityCallbackErrorCode({ error: { code: "UNAUTHORIZED", details: "invalid_grant" } })).toBe(
      "identity_service_error",
    );
    expect(identityCallbackErrorCode({})).toBe("identity_service_error");
    expect(identityCallbackErrorCode(null)).toBe("identity_service_error");
  });

  it("falls back to a generic message for other codes", () => {
    expect(getLoginError("identity_service_error")?.message).toBe("เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่ หรือติดต่อแอดมิน");
    expect(getLoginError(["something_else", "not_tutor"])?.message).toBe("เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่ หรือติดต่อแอดมิน");
  });
});
