import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const shared = vi.hoisted(() => ({
  postDiscordEmbeds: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@tutor-advantage/shared-config", async () => {
  const internalAuth = await import("../../../../packages/shared-config/src/internalAuth");
  return { isValidInternalKey: internalAuth.isValidInternalKey, ...shared };
});

import { parseBasicAuth, relayMonitoringAlert } from "./monitoringAlertController";

const KEY = "internal-test-key";
const basic = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

const body = {
  version: "1.2",
  incident: { incident_id: "0.abc", state: "open", policy_name: "TA: 5xx spike", started_at: 1793948580 },
};

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

function request(authorization: string | undefined, payload: unknown = body) {
  return { headers: authorization === undefined ? {} : { authorization }, body: payload } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("INTERNAL_API_KEY", KEY);
  shared.postDiscordEmbeds.mockResolvedValue({ ok: true, status: 204 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseBasicAuth", () => {
  it("decodes user and password, keeping colons in the password", () => {
    expect(parseBasicAuth(basic("monitoring", "a:b:c"))).toEqual({ user: "monitoring", password: "a:b:c" });
  });

  it.each([undefined, "", "Bearer abc", "Basic", "Basic !!!", `Basic ${Buffer.from("nocolon").toString("base64")}`])(
    "rejects %j",
    (header) => {
      expect(parseBasicAuth(header)).toBeNull();
    },
  );

  it("rejects a repeated header", () => {
    expect(parseBasicAuth([basic("monitoring", KEY), basic("monitoring", KEY)])).toBeNull();
  });
});

describe("relayMonitoringAlert", () => {
  it.each([
    ["no header", undefined],
    ["wrong user", basic("admin", KEY)],
    ["wrong password", basic("monitoring", "wrong-key")],
    ["empty password", basic("monitoring", "")],
    ["bearer scheme", `Bearer ${KEY}`],
  ])("rejects %s with 401", async (_label, header) => {
    const res = response();
    await relayMonitoringAlert(request(header), res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "UNAUTHORIZED", message: "Invalid monitoring credentials" },
    });
    expect(shared.postDiscordEmbeds).not.toHaveBeenCalled();
  });

  it("rejects every caller when INTERNAL_API_KEY is not configured", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "");
    const res = response();
    await relayMonitoringAlert(request(basic("monitoring", "")), res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(shared.postDiscordEmbeds).not.toHaveBeenCalled();
  });

  it("forwards one embed to Discord and answers 200", async () => {
    const res = response();
    await relayMonitoringAlert(request(basic("monitoring", KEY)), res as never);

    expect(shared.postDiscordEmbeds).toHaveBeenCalledTimes(1);
    const [embeds] = shared.postDiscordEmbeds.mock.calls[0];
    expect(embeds).toHaveLength(1);
    expect(embeds[0].title).toBe("🔴 ALERT: TA: 5xx spike");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ forwarded: true });
  });

  it("still answers 200 when Discord fails, and logs a non-alerting warning", async () => {
    shared.postDiscordEmbeds.mockResolvedValue({ ok: false, status: 429, reason: "HTTP_ERROR" });
    const res = response();
    await relayMonitoringAlert(request(basic("monitoring", KEY)), res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ forwarded: false, reason: "HTTP_ERROR" });
    expect(shared.logger.warn).toHaveBeenCalledWith(
      "[MonitoringRelay] Discord delivery failed",
      expect.objectContaining({ alert: false, status: 429, incidentId: "0.abc" }),
    );
    expect(shared.logger.error).not.toHaveBeenCalled();
  });

  it("answers 200 without posting when the webhook is not configured", async () => {
    shared.postDiscordEmbeds.mockResolvedValue({ ok: false, reason: "NOT_CONFIGURED" });
    const res = response();
    await relayMonitoringAlert(request(basic("monitoring", KEY)), res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ forwarded: false, reason: "NOT_CONFIGURED" });
  });

  it("answers 200 without posting when the body has no incident", async () => {
    const res = response();
    await relayMonitoringAlert(request(basic("monitoring", KEY), {}), res as never);

    expect(shared.postDiscordEmbeds).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ forwarded: false, reason: "NO_INCIDENT" });
  });

  it("answers 200 even if posting throws unexpectedly", async () => {
    shared.postDiscordEmbeds.mockRejectedValue(new Error("boom"));
    const res = response();
    await relayMonitoringAlert(request(basic("monitoring", KEY)), res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ forwarded: false, reason: "RELAY_ERROR" });
  });
});
