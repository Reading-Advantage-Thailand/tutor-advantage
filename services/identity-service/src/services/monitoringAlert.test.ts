import { describe, expect, it } from "vitest";
import {
  ALERT_COLOR_CLOSED,
  ALERT_COLOR_OPEN,
  buildMonitoringEmbed,
  formatBangkok,
  toDate,
} from "./monitoringAlert";

// 2026-11-05 07:03:00 UTC = 14:03 in Bangkok
const STARTED = Date.UTC(2026, 10, 5, 7, 3) / 1000;
const ENDED = Date.UTC(2026, 10, 5, 7, 48) / 1000;

const incident = (overrides: Record<string, unknown> = {}) => ({
  version: "1.2",
  incident: {
    incident_id: "0.abc123",
    scoping_project_id: "reading-advantage",
    url: "https://console.cloud.google.com/monitoring/alerting/incidents/0.abc123?project=reading-advantage",
    state: "open",
    started_at: STARTED,
    ended_at: null,
    summary: "5xx count for identity-service is above the threshold of 10.",
    policy_name: "TA: 5xx spike",
    condition_name: "5xx > 10 in 5 min",
    resource: { type: "cloud_run_revision", labels: { service_name: "identity-service" } },
    resource_display_name: "identity-service",
    metric: { type: "run.googleapis.com/request_count", displayName: "Request Count" },
    observed_value: "23",
    threshold_value: "10",
    documentation: { content: "ตรวจ log ของ service นี้ / Check the service logs.", mime_type: "text/markdown" },
    ...overrides,
  },
});

describe("formatBangkok", () => {
  it("formats in Asia/Bangkok with Thai month abbreviations and Gregorian year", () => {
    expect(formatBangkok(new Date(STARTED * 1000))).toBe("5 พ.ย. 2026 14:03");
    // crosses midnight in Bangkok
    expect(formatBangkok(new Date(Date.UTC(2026, 11, 31, 17, 5)))).toBe("1 ม.ค. 2027 00:05");
  });

  it("treats 0, null and garbage as no date", () => {
    expect(toDate(0)).toBeUndefined();
    expect(toDate(null)).toBeUndefined();
    expect(toDate("nope")).toBeUndefined();
    expect(toDate(String(STARTED))?.getTime()).toBe(STARTED * 1000);
  });
});

describe("buildMonitoringEmbed", () => {
  it("renders an open incident as a red ALERT", () => {
    const embed = buildMonitoringEmbed(incident())!;
    expect(embed.title).toBe("🔴 ALERT: TA: 5xx spike");
    expect(embed.color).toBe(ALERT_COLOR_OPEN);
    expect(embed.url).toContain("console.cloud.google.com");
    expect(embed.timestamp).toBe(new Date(STARTED * 1000).toISOString());
    expect(embed.description).toContain("above the threshold");
    expect(embed.description).toContain("Check the service logs.");
    expect(embed.footer?.text).toBe("reading-advantage · incident 0.abc123");
    expect(embed.fields).toEqual([
      { name: "Condition", value: "5xx > 10 in 5 min", inline: false },
      { name: "Resource", value: "identity-service (cloud_run_revision)", inline: false },
      { name: "Observed / Threshold", value: "23 / 10", inline: false },
      { name: "Started (ICT)", value: "5 พ.ย. 2026 14:03", inline: true },
      { name: "Link", value: expect.stringContaining("[Open in Cloud Console](https://console.cloud.google.com/"), inline: false },
    ]);
  });

  it("renders a closed incident as a green RESOLVED with the end time", () => {
    const embed = buildMonitoringEmbed(incident({ state: "closed", ended_at: ENDED }))!;
    expect(embed.title).toBe("✅ RESOLVED: TA: 5xx spike");
    expect(embed.color).toBe(ALERT_COLOR_CLOSED);
    expect(embed.timestamp).toBe(new Date(ENDED * 1000).toISOString());
    expect(embed.fields).toContainEqual({ name: "Ended (ICT)", value: "5 พ.ย. 2026 14:48", inline: true });
  });

  it("tolerates a near-empty incident", () => {
    const embed = buildMonitoringEmbed({ incident: { state: "open" } })!;
    expect(embed.title).toBe("🔴 ALERT: Unknown alert policy");
    expect(embed.fields).toEqual([]);
    expect(embed.description).toBeUndefined();
    expect(embed.url).toBeUndefined();
    expect(embed.timestamp).toBeUndefined();
    expect(embed.footer).toBeUndefined();
  });

  it("falls back to resource labels when there is no display name", () => {
    const embed = buildMonitoringEmbed(
      incident({ resource_display_name: undefined, resource: { type: "cloud_scheduler_job", labels: { job_id: "ta-book-payment-reminders" } } }),
    )!;
    expect(embed.fields).toContainEqual({ name: "Resource", value: "ta-book-payment-reminders (cloud_scheduler_job)", inline: false });
  });

  it("omits the observed/threshold field when neither is present (log-match policies)", () => {
    const embed = buildMonitoringEmbed(incident({ observed_value: undefined, threshold_value: undefined }))!;
    expect(embed.fields?.some((f) => f.name === "Observed / Threshold")).toBe(false);
  });

  it("drops a non-http url so Discord does not reject the message", () => {
    const embed = buildMonitoringEmbed(incident({ url: "javascript:alert(1)" }))!;
    expect(embed.url).toBeUndefined();
    expect(embed.fields?.some((f) => f.name === "Link")).toBe(false);
  });

  it("truncates long titles, documentation and field values", () => {
    const embed = buildMonitoringEmbed(
      incident({
        policy_name: "P".repeat(400),
        condition_name: "C".repeat(3000),
        documentation: { content: "D".repeat(10_000) },
        summary: "S".repeat(5000),
      }),
    )!;
    expect(embed.title.length).toBeLessThanOrEqual(256);
    expect(embed.title.endsWith("…")).toBe(true);
    expect(embed.fields?.[0].value.length).toBeLessThanOrEqual(1024);
    expect(embed.description!.length).toBeLessThanOrEqual(4096);
    expect(embed.description!.length).toBeLessThan(2600);
  });

  it("returns null when there is no incident", () => {
    expect(buildMonitoringEmbed(undefined)).toBeNull();
    expect(buildMonitoringEmbed({ version: "1.2" })).toBeNull();
    expect(buildMonitoringEmbed("x" as never)).toBeNull();
  });
});
