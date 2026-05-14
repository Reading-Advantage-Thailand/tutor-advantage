import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleOAuthCallback } from "./authController";

const {
  verifyGoogleToken,
  verifyFacebookToken,
  verifyLineToken,
  processOAuthLogin,
} = vi.hoisted(() => ({
  verifyGoogleToken: vi.fn(),
  verifyFacebookToken: vi.fn(),
  verifyLineToken: vi.fn(),
  processOAuthLogin: vi.fn(),
}));

vi.mock("../services/oauth/googleAuth", () => ({ verifyGoogleToken }));
vi.mock("../services/oauth/facebookAuth", () => ({ verifyFacebookToken }));
vi.mock("../services/oauth/lineAuth", () => ({ verifyLineToken }));
vi.mock("../services/authService", () => ({ processOAuthLogin }));

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("handleOAuthCallback", () => {
  beforeEach(() => {
    verifyGoogleToken.mockReset();
    verifyFacebookToken.mockReset();
    verifyLineToken.mockReset();
    processOAuthLogin.mockReset();
  });

  it("rejects requests missing provider or authorization code", async () => {
    const req = { id: "req-1", body: { provider: "google" } };
    const res = createResponse();

    await handleOAuthCallback(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "BAD_REQUEST",
        message: "Missing provider or authorization code",
        requestId: "req-1",
      },
    });
  });

  it("rejects unsupported providers", async () => {
    const req = { id: "req-1", body: { provider: "github", code: "code-1" } };
    const res = createResponse();

    await handleOAuthCallback(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "UNSUPPORTED_PROVIDER",
        message: "Provider 'github' is not supported yet",
        requestId: "req-1",
      },
    });
  });

  it("verifies Google profiles and returns the login result", async () => {
    verifyGoogleToken.mockResolvedValue({
      id: "google-subject",
      email: "ada@example.com",
      name: "Ada",
      picture: "avatar.png",
    });
    processOAuthLogin.mockResolvedValue({
      sessionToken: "session-token",
      user: { id: "user-1", name: "Ada", role: "STUDENT", requiresGuardian: false },
    });
    const req = {
      id: "req-1",
      body: {
        provider: "google",
        code: "code-1",
        redirectUri: "https://app.example.com/callback",
        sponsorTutorId: "tutor-1",
      },
    };
    const res = createResponse();

    await handleOAuthCallback(req as never, res as never);

    expect(verifyGoogleToken).toHaveBeenCalledWith("code-1", "https://app.example.com/callback");
    expect(processOAuthLogin).toHaveBeenCalledWith(
      "google",
      "google-subject",
      "ada@example.com",
      "Ada",
      "avatar.png",
      "tutor-1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ sessionToken: "session-token" }));
  });

  it("maps OAuth verifier failures to unauthorized responses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    verifyLineToken.mockRejectedValue(new Error("bad token"));
    const req = { id: "req-1", body: { provider: "line", code: "bad-code" } };
    const res = createResponse();

    await handleOAuthCallback(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid authorization code or provider error",
        details: "bad token",
        requestId: "req-1",
      },
    });
  });
});
