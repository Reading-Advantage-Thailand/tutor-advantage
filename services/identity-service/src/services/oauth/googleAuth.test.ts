import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyGoogleToken } from "./googleAuth";

const axios = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
}));

vi.mock("axios", () => ({ default: axios }));

function mockUserinfo(profile: Record<string, unknown>) {
  axios.get.mockResolvedValue({
    data: {
      id: "google-subject",
      email: "ada@example.com",
      name: "Ada",
      picture: "avatar.png",
      ...profile,
    },
  });
}

describe("verifyGoogleToken", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_GOOGLE_ID", "client-id");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "client-secret");
    axios.post.mockReset().mockResolvedValue({ data: { access_token: "access-token" } });
    axios.get.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("returns the profile with Google's verified_email as emailVerified", async () => {
    mockUserinfo({ verified_email: true });

    const profile = await verifyGoogleToken("code-1", "https://app.example.com/callback", "verifier");

    expect(axios.post).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ code: "code-1", code_verifier: "verifier" }),
    );
    expect(axios.get).toHaveBeenCalledWith("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: "Bearer access-token" },
    });
    expect(profile).toEqual({
      id: "google-subject",
      email: "ada@example.com",
      emailVerified: true,
      name: "Ada",
      picture: "avatar.png",
    });
  });

  it.each([
    ["false", { verified_email: false }],
    ["missing", {}],
    ["not a boolean", { verified_email: "true" }],
  ])("treats a verified_email that is %s as unverified", async (_case, profile) => {
    mockUserinfo(profile);

    const result = await verifyGoogleToken("code-1", "https://app.example.com/callback");

    expect(result.emailVerified).toBe(false);
  });
});
