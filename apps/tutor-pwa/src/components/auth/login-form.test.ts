import { describe, expect, it } from "vitest";
import { loginErrorMessageKey } from "./login-form";

describe("loginErrorMessageKey", () => {
  it("explains a missing tutor invite and falls back for other errors", () => {
    expect(loginErrorMessageKey("tutor_invite_required")).toBe("app.loginErrorTutorInviteRequired");
    expect(loginErrorMessageKey("invite_invalid")).toBe("app.loginErrorInviteInvalid");
    expect(loginErrorMessageKey("invalid_state")).toBe("app.loginErrorGeneric");
    expect(loginErrorMessageKey(null)).toBeNull();
  });
});
