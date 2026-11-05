import winston from "winston";
import { postDiscordEmbeds, type DiscordEmbed } from "../discord";
import { redactExternalText } from "./redact";

/**
 * Winston transport that mirrors error-level logs to a Discord channel.
 *
 * It receives entries after the logger's formats ran, so message, metadata and
 * stack_trace are already redacted for Cloud Logging. Discord is a third party,
 * so the embed carries less: only the first line of the message (<= 200 chars)
 * and, from the stack, the error class name plus its "at ..." frames; never a
 * multi-line message body (e.g. a Prisma invocation dump with user data).
 * Both pass through redactExternalText. Posting is fire-and-forget: log() returns
 * before any network I/O so a slow webhook never holds up a request. Entries
 * logged with `{ alert: false }` are skipped.
 *
 * Throttling (per instance):
 * - the same fingerprint (service + message with numbers/ids normalised) is
 *   posted at most once per dedupe window; repeats are counted and reported as
 *   "(+N similar suppressed)" on the next post of that fingerprint;
 * - at most `globalLimit` posts per `globalWindowMs`; beyond that alerts are
 *   dropped with a single console.warn per saturated window.
 */

const DEFAULT_DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_GLOBAL_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_GLOBAL_LIMIT = 10;
const STACK_LINES = 10;
const MAX_SUMMARY_CHARS = 200;
const STACK_FRAME_PATTERN = /^\s*at\s/;
const STACK_HEADER_NAME_PATTERN = /^\s*([A-Za-z_$][\w$.]*)(?::|\s*$)/;
const MAX_FINGERPRINTS = 500;
const ALERT_COLOR = 0xe74c3c;

// winston exposes the base class at runtime as `Transport` but types it as
// `transport`; read it this way rather than depend on winston-transport directly.
type TransportConstructor = new (opts?: winston.transport.TransportStreamOptions) => winston.transport;
const TransportBase = (winston as unknown as { Transport: TransportConstructor }).Transport;

export interface DiscordAlertTransportOptions extends winston.transport.TransportStreamOptions {
  post?: typeof postDiscordEmbeds;
  now?: () => number;
  dedupeWindowMs?: number;
  globalWindowMs?: number;
  globalLimit?: number;
}

interface FingerprintState {
  lastSentAt?: number;
  suppressed: number;
}

const instances = new Set<DiscordAlertTransport>();

/** Collapses volatile parts (UUIDs, hex ids, numbers) so similar errors group together. */
export function alertFingerprint(service: string, message: string): string {
  const normalised = message
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>")
    .replace(/\b(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{8,}\b/gi, "<hex>")
    .replace(/\d+/g, "#");
  return `${service}|${normalised}`;
}

function asText(value: unknown): string | undefined {
  if (typeof value === "string" && value) return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

/** First line of a message, redacted for off-platform use and capped at 200 chars. */
export function alertSummary(message: string): string {
  const firstLine = redactExternalText(message.split(/\r?\n/, 1)[0] ?? "").trim();
  if (!firstLine) return "(no message)";
  return firstLine.length > MAX_SUMMARY_CHARS ? `${firstLine.slice(0, MAX_SUMMARY_CHARS - 1)}…` : firstLine;
}

/**
 * Reduces a stack trace to the error class name and its "at ..." frames, so
 * the message text V8 repeats in the stack (and any multi-line body) never
 * reaches Discord.
 */
export function alertStackLines(stack: string, maxLines = STACK_LINES): string[] {
  const lines = stack.split(/\r?\n/);
  const out: string[] = [];
  const first = lines[0] ?? "";
  const header = STACK_FRAME_PATTERN.test(first) ? null : STACK_HEADER_NAME_PATTERN.exec(first);
  if (header) out.push(header[1]);
  for (const line of lines) {
    if (out.length >= maxLines) break;
    if (STACK_FRAME_PATTERN.test(line)) out.push(redactExternalText(line.trimEnd()));
  }
  return out;
}

export class DiscordAlertTransport extends TransportBase {
  private readonly post: typeof postDiscordEmbeds;
  private readonly now: () => number;
  private readonly dedupeWindowMs: number;
  private readonly globalWindowMs: number;
  private readonly globalLimit: number;
  private readonly fingerprints = new Map<string, FingerprintState>();
  private sentAt: number[] = [];
  private capWarned = false;
  private readonly pending = new Set<Promise<unknown>>();

  constructor(opts: DiscordAlertTransportOptions = {}) {
    super({ ...opts, level: opts.level ?? "error" });
    this.post = opts.post ?? postDiscordEmbeds;
    this.now = opts.now ?? Date.now;
    this.dedupeWindowMs = opts.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS;
    this.globalWindowMs = opts.globalWindowMs ?? DEFAULT_GLOBAL_WINDOW_MS;
    this.globalLimit = opts.globalLimit ?? DEFAULT_GLOBAL_LIMIT;
    instances.add(this);
  }

  override log(info: Record<string, unknown>, callback: () => void): void {
    try {
      this.handle(info);
    } catch (error) {
      console.warn(`[discord-alert] failed to build alert (${error instanceof Error ? error.name : "UnknownError"})`);
    }
    callback();
  }

  /** Waits for in-flight posts, up to timeoutMs. Never rejects. */
  async flush(timeoutMs = 2000): Promise<void> {
    if (this.pending.size === 0) return;
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      Promise.allSettled([...this.pending]),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
    if (timer) clearTimeout(timer);
  }

  override close(): void {
    instances.delete(this);
  }

  private handle(info: Record<string, unknown>) {
    if (info.level !== "error" || info.alert === false) return;

    const serviceContext = (info.serviceContext ?? {}) as { service?: string; version?: string };
    const service = serviceContext.service || process.env.K_SERVICE || "unknown-service";
    const revision = serviceContext.version || process.env.K_REVISION || "local";
    const message = asText(info.message) ?? "(no message)";
    const now = this.now();

    const key = alertFingerprint(service, message);
    const state = this.fingerprints.get(key) ?? { suppressed: 0 };
    if (state.lastSentAt !== undefined && now - state.lastSentAt < this.dedupeWindowMs) {
      state.suppressed += 1;
      this.fingerprints.set(key, state);
      return;
    }

    this.sentAt = this.sentAt.filter((at) => now - at < this.globalWindowMs);
    if (this.sentAt.length >= this.globalLimit) {
      state.suppressed += 1;
      this.fingerprints.set(key, state);
      if (!this.capWarned) {
        this.capWarned = true;
        console.warn(
          `[discord-alert] more than ${this.globalLimit} alerts in ${Math.round(this.globalWindowMs / 1000)}s; dropping until the window clears`,
        );
      }
      return;
    }
    this.capWarned = false;

    const suppressed = state.suppressed;
    this.fingerprints.set(key, { lastSentAt: now, suppressed: 0 });
    this.sentAt.push(now);
    this.pruneFingerprints(now);

    const embed = this.buildEmbed(info, { service, revision, message, suppressed });
    const request = Promise.resolve()
      .then(() => this.post([embed]))
      .catch(() => undefined)
      .finally(() => this.pending.delete(request));
    this.pending.add(request);
  }

  private buildEmbed(
    info: Record<string, unknown>,
    ctx: { service: string; revision: string; message: string; suppressed: number },
  ): DiscordEmbed {
    let description = alertSummary(ctx.message);
    if (ctx.suppressed > 0) description += `\n(+${ctx.suppressed} similar suppressed)`;

    const stack = asText(info.stack_trace);
    if (stack) {
      const lines = alertStackLines(stack).join("\n").replace(/```/g, "'''");
      if (lines) description +=`\n\`\`\`\n${lines}\n\`\`\``;
    }

    const fields: NonNullable<DiscordEmbed["fields"]> = [
      { name: "service", value: ctx.service, inline: true },
      { name: "revision", value: ctx.revision, inline: true },
    ];
    const requestId = asText(info.requestId);
    if (requestId) fields.push({ name: "requestId", value: requestId, inline: true });
    const path = asText(info.path) ?? asText(info.url);
    if (path) fields.push({ name: "path", value: path, inline: false });

    return {
      title: `🚨 ${ctx.service} error`,
      description,
      color: ALERT_COLOR,
      fields,
      timestamp: asText(info.timestamp) ?? new Date().toISOString(),
    };
  }

  private pruneFingerprints(now: number) {
    if (this.fingerprints.size <= MAX_FINGERPRINTS) return;
    for (const [key, state] of this.fingerprints) {
      if (state.lastSentAt === undefined || now - state.lastSentAt >= this.dedupeWindowMs) {
        this.fingerprints.delete(key);
      }
    }
  }
}

/** Waits (bounded) for every live Discord alert transport to finish posting. */
export async function flushDiscordAlerts(timeoutMs = 2000): Promise<void> {
  await Promise.all([...instances].map((transport) => transport.flush(timeoutMs)));
}
