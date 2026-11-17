import { afterEach, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => ({ oauth_state: { value: "state" }, pkce_verifier: { value: "verifier" } })[name],
  }),
}));

afterEach(() => vi.unstubAllGlobals());

it("registers a tutor after OAuth and enters the dashboard with the new session", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ sessionToken: "new-tutor-session", roleUpgraded: true }));
  vi.stubGlobal("fetch", fetchMock);
  const response = await GET(new Request("http://localhost:3000/api/auth/callback/google?code=code&state=state"), {
    params: Promise.resolve({ provider: "google" }),
  });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
    provider: "google", code: "code", signupIntent: "tutor", codeVerifier: "verifier",
  });
  expect(new URL(response.headers.get("location")!).pathname).toBe("/dashboard");
  expect(new URL(response.headers.get("location")!).searchParams.get("role_upgraded")).toBe("true");
  expect(response.cookies.get("tutor_session")?.value).toBe("new-tutor-session");
});
