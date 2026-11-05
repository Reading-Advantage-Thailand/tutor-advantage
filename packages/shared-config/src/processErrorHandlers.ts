import type { EventEmitter } from "events";
import { enableDiscordAlerts, logger, setLogServiceName } from "./middlewares/logger";
import { flushDiscordAlerts } from "./middlewares/discordAlertTransport";

const DEFAULT_FLUSH_TIMEOUT_MS = 2000;
const MAX_REASON_CHARS = 200;

type ProcessLike = EventEmitter & { exit(code?: number): unknown };

export interface ProcessErrorHandlerOptions {
  /** Injected for tests; defaults to the real process. */
  proc?: ProcessLike;
  log?: Pick<typeof logger, "error">;
  flush?: (timeoutMs: number) => Promise<void>;
  flushTimeoutMs?: number;
}

const installedOn = new WeakSet<object>();

/**
 * One-line description of a rejection reason / thrown value, e.g.
 * "TypeError: x is undefined" or "timeout". It goes into the log message so
 * distinct failures get distinct Discord fingerprints and Error Reporting
 * groups, and so non-Error reasons are visible in the alert at all.
 */
export function describeThrown(value: unknown): string {
  let text: string;
  if (value instanceof Error) {
    text = value.message ? `${value.name}: ${value.message}` : value.name;
  } else {
    try {
      text = String(value);
    } catch {
      text = typeof value;
    }
  }
  const firstLine = (text.split(/\r?\n/, 1)[0] ?? "").trim() || "(empty)";
  return firstLine.length > MAX_REASON_CHARS ? `${firstLine.slice(0, MAX_REASON_CHARS - 1)}…` : firstLine;
}

/**
 * Logs unhandled promise rejections and uncaught exceptions at error level
 * (so they reach Error Reporting and the Discord alert channel). An uncaught
 * exception leaves the process in an unknown state, so after giving the alert
 * up to ~2s to send, the process exits with code 1 and Cloud Run restarts it.
 * Safe to call more than once.
 */
export function installProcessErrorHandlers(
  serviceName: string,
  opts: ProcessErrorHandlerOptions = {},
): boolean {
  const proc = opts.proc ?? process;
  if (installedOn.has(proc)) return false;
  installedOn.add(proc);

  const log = opts.log ?? logger;
  const flush = opts.flush ?? flushDiscordAlerts;
  const flushTimeoutMs = opts.flushTimeoutMs ?? DEFAULT_FLUSH_TIMEOUT_MS;

  if (!opts.proc) {
    setLogServiceName(serviceName);
    // Services load .env after importing shared-config; pick up a local webhook.
    enableDiscordAlerts();
  }

  proc.on("unhandledRejection", (reason: unknown) => {
    try {
      log.error(`Unhandled promise rejection: ${describeThrown(reason)}`, {
        service: serviceName,
        ...(reason instanceof Error ? { error: reason } : { reason: String(reason) }),
      });
    } catch {
      // Logging must never turn a rejection into a crash.
    }
  });

  let exiting = false;
  proc.on("uncaughtException", (error: unknown, origin?: unknown) => {
    if (exiting) return;
    exiting = true;
    try {
      log.error(`Uncaught exception: ${describeThrown(error)}`, {
        service: serviceName,
        origin: typeof origin === "string" ? origin : undefined,
        ...(error instanceof Error ? { error } : { reason: String(error) }),
      });
    } catch {
      // Fall through to exit.
    }
    Promise.resolve()
      .then(() => flush(flushTimeoutMs))
      .catch(() => undefined)
      .finally(() => proc.exit(1));
  });

  return true;
}
