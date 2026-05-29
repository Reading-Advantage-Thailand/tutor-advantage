import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("tutor invite route", () => {
  it("redirects to the forwarded public host on Cloud Run", async () => {
    const response = await GET(
      new Request("https://0.0.0.0:8080/invite/sponsor-123", {
        headers: {
          "x-forwarded-host": "tutor-pwa-1090865515742.asia-southeast1.run.app",
          "x-forwarded-proto": "https",
        },
      }),
      { params: Promise.resolve({ sponsorTutorId: "sponsor-123" }) },
    );

    expect(response.headers.get("location")).toBe(
      "https://tutor-pwa-1090865515742.asia-southeast1.run.app/?sponsor=sponsor-123",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "tutor_invite_sponsor=sponsor-123",
    );
  });
});
