import type { DiscordEmbed } from "@tutor-advantage/shared-config";

/**
 * Cloud Monitoring webhook notification payload (schema version 1.2).
 * Every field is optional here: test notifications and older policies omit
 * some of them, and a relay must never fail on a missing field.
 */
export interface MonitoringIncident {
  incident_id?: string;
  scoping_project_id?: string;
  url?: string;
  state?: string;
  started_at?: number | string | null;
  ended_at?: number | string | null;
  summary?: string;
  policy_name?: string;
  condition_name?: string;
  resource?: { type?: string; labels?: Record<string, string | undefined> } | null;
  resource_display_name?: string;
  metric?: { type?: string; displayName?: string } | null;
  observed_value?: string | number | null;
  threshold_value?: string | number | null;
  documentation?: { content?: string; mime_type?: string } | null;
}

export interface MonitoringNotification {
  version?: string;
  incident?: MonitoringIncident | null;
}

export const ALERT_COLOR_OPEN = 0xe74c3c;
export const ALERT_COLOR_CLOSED = 0x2ecc71;
export const ALERT_COLOR_OTHER = 0xf39c12;

const TITLE_MAX = 256;
const FIELD_MAX = 1024;
const DOCUMENTATION_MAX = 1500;
const SUMMARY_MAX = 1000;

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Bangkok has no DST

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function str(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

/** Monitoring sends epoch seconds; 0 / null means "not yet". */
export function toDate(value: unknown): Date | undefined {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return undefined;
  const d = new Date(n * 1000);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** "5 พ.ย. 2026 14:03" in Asia/Bangkok (Gregorian year, as ops reads it). */
export function formatBangkok(date: Date): string {
  const b = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  const hh = String(b.getUTCHours()).padStart(2, "0");
  const mm = String(b.getUTCMinutes()).padStart(2, "0");
  return `${b.getUTCDate()} ${THAI_MONTHS[b.getUTCMonth()]} ${b.getUTCFullYear()} ${hh}:${mm}`;
}

function describeResource(incident: MonitoringIncident): string | undefined {
  const labels = incident.resource?.labels ?? {};
  const name = str(incident.resource_display_name);
  const type = str(incident.resource?.type);
  const specific =
    str(labels.service_name) ?? str(labels.job_id) ?? str(labels.job_name) ?? str(labels.host) ?? str(labels.check_id);
  const head = name ?? specific;
  if (head && type) return head === type ? head : `${head} (${type})`;
  return head ?? type;
}

/**
 * Turns one Cloud Monitoring incident into one Discord embed. Pure: no I/O,
 * no clock, so the relay controller stays trivial and this stays testable.
 */
export function buildMonitoringEmbed(payload: MonitoringNotification | null | undefined): DiscordEmbed | null {
  const incident = payload && typeof payload === "object" ? payload.incident : undefined;
  if (!incident || typeof incident !== "object") return null;

  const state = str(incident.state)?.toLowerCase();
  const policy = str(incident.policy_name) ?? "Unknown alert policy";
  let title: string;
  let color: number;
  if (state === "closed") {
    title = `✅ RESOLVED: ${policy}`;
    color = ALERT_COLOR_CLOSED;
  } else if (state === "open") {
    title = `🔴 ALERT: ${policy}`;
    color = ALERT_COLOR_OPEN;
  } else {
    title = `⚠️ ${state ? state.toUpperCase() : "NOTICE"}: ${policy}`;
    color = ALERT_COLOR_OTHER;
  }

  const fields: NonNullable<DiscordEmbed["fields"]> = [];
  const add = (name: string, value: string | undefined, inline = false) => {
    if (value) fields.push({ name, value: truncate(value, FIELD_MAX), inline });
  };

  add("Condition", str(incident.condition_name) ?? str(incident.metric?.displayName));
  add("Resource", describeResource(incident));

  const observed = str(incident.observed_value);
  const threshold = str(incident.threshold_value);
  if (observed || threshold) {
    add("Observed / Threshold", `${observed ?? "–"} / ${threshold ?? "–"}`);
  }

  const started = toDate(incident.started_at);
  const ended = toDate(incident.ended_at);
  add("Started (ICT)", started && formatBangkok(started), true);
  add("Ended (ICT)", ended && formatBangkok(ended), true);

  // Discord rejects the whole message when an embed url is not http(s).
  const rawUrl = str(incident.url);
  const url = rawUrl && /^https?:\/\//i.test(rawUrl) ? rawUrl : undefined;
  add("Link", url && `[Open in Cloud Console](${url})`);

  const summary = str(incident.summary);
  const documentation = str(incident.documentation?.content);
  const description = [summary && truncate(summary, SUMMARY_MAX), documentation && truncate(documentation, DOCUMENTATION_MAX)]
    .filter(Boolean)
    .join("\n\n");

  const when = state === "closed" ? (ended ?? started) : started;
  const footer = [str(incident.scoping_project_id), str(incident.incident_id) && `incident ${str(incident.incident_id)}`]
    .filter(Boolean)
    .join(" · ");

  return {
    title: truncate(title, TITLE_MAX),
    ...(description ? { description } : {}),
    color,
    fields,
    ...(url ? { url } : {}),
    ...(when ? { timestamp: when.toISOString() } : {}),
    ...(footer ? { footer: { text: truncate(footer, 2048) } } : {}),
  };
}
