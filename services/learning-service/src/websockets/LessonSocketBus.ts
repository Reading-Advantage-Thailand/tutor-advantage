import { Client } from "pg";
import { Server } from "socket.io";
import { logger } from "@tutor-advantage/shared-config";

const CHANNEL = "tutor_advantage_lesson_events";
const MAX_NOTIFY_BYTES = 7_500;
const RECONNECT_DELAY_MS = 2_000;

export type LessonBusEvent = {
  sourceInstanceId: string;
  sessionId: string;
  event: string;
  payload: unknown;
  targetUserId?: string;
  // Set by revisions whose rosters carry score change times (scoreAt).
  scoreClock?: boolean;
};

let client: Client | null = null;
let instanceId = "";
let busRunning = false;
let busGeneration = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let scheduleReconnect: (() => void) | null = null;

/**
 * PostgreSQL LISTEN/NOTIFY is used as the lightweight cross-instance adapter
 * when Redis is not available. The database-backed session lease/state makes
 * reconnects safe; this bus mirrors room events to sockets on other instances.
 */
/**
 * `onRemoteEvent` applies an event from another instance. When it returns a
 * value, that payload goes to this instance's sockets instead of the one sent,
 * for state this instance merges rather than copies. Returning null drops a
 * stale event: nothing is sent to this instance's sockets.
 */
export async function startLessonSocketBus(
  io: Server,
  sourceInstanceId: string,
  onRemoteEvent?: (event: LessonBusEvent) => unknown,
) {
  if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) return;

  busRunning = true;
  instanceId = sourceInstanceId;
  const generation = ++busGeneration;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const connect = async (): Promise<void> => {
    if (!busRunning || generation !== busGeneration) return;

    const nextClient = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await nextClient.connect();
      await nextClient.query(`LISTEN ${CHANNEL}`);
      if (!busRunning || generation !== busGeneration) {
        await nextClient.end().catch(() => undefined);
        return;
      }

      nextClient.on("notification", (message) => {
        if (!message.payload) return;
        try {
          const event = JSON.parse(message.payload) as LessonBusEvent;
          if (!event.sessionId || event.sourceInstanceId === instanceId) return;
          let outgoing: unknown = event.payload;
          try {
            const merged = onRemoteEvent?.(event);
            if (merged === null) return;
            if (merged !== undefined) outgoing = merged;
          } catch (error) {
            logger.warn("[LessonBus] Failed to apply remote lesson state:", error);
          }
          if (event.targetUserId) {
            for (const socket of io.sockets.sockets.values()) {
              if (socket.data.actor?.userId === event.targetUserId) {
                socket.emit(event.event, outgoing);
              }
            }
          } else {
            io.to(event.sessionId).emit(event.event, outgoing);
          }
        } catch (error) {
          logger.warn("[LessonBus] Ignoring malformed cross-instance event:", error);
        }
      });
      nextClient.on("error", (error) => {
        logger.warn("[LessonBus] PostgreSQL event bus error:", error);
        if (client === nextClient) client = null;
        scheduleReconnect?.();
      });
      client = nextClient;
      logger.info("[LessonBus] Cross-instance lesson event bus connected");
    } catch (error) {
      await nextClient.end().catch(() => undefined);
      logger.warn("[LessonBus] Cross-instance event bus unavailable; retrying:", error);
      scheduleReconnect?.();
    }
  };

  scheduleReconnect = () => {
    if (!busRunning || generation !== busGeneration || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, RECONNECT_DELAY_MS);
    if (typeof reconnectTimer.unref === "function") reconnectTimer.unref();
  };

  await connect();
}

type BusPayload = Record<string, unknown>;

const isRecord = (value: unknown): value is BusPayload =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Splits a payload that is too big for one NOTIFY into several that fit. A
 * roster splits by student and a game state by result; receivers merge each
 * part into what they hold (rosters are upserted, results of one round are
 * unioned), so the parts add up to the whole. Returns [] when even one student
 * or one result does not fit.
 */
export function splitBusPayload(payload: unknown, fits: (part: unknown) => boolean): unknown[] {
  if (fits(payload)) return [payload];
  if (isRecord(payload) && Array.isArray(payload.participants) && payload.participants.length > 1) {
    const half = Math.ceil(payload.participants.length / 2);
    return [
      ...splitBusPayload({ ...payload, participants: payload.participants.slice(0, half) }, fits),
      ...splitBusPayload({ ...payload, participants: payload.participants.slice(half) }, fits),
    ];
  }
  const gameState = isRecord(payload) ? payload.gameState : undefined;
  if (isRecord(payload) && isRecord(gameState) && isRecord(gameState.results)) {
    const entries = Object.entries(gameState.results);
    if (entries.length > 1) {
      const half = Math.ceil(entries.length / 2);
      const withResults = (part: Array<[string, unknown]>) => ({
        ...payload,
        gameState: { ...gameState, results: Object.fromEntries(part) },
      });
      return [
        ...splitBusPayload(withResults(entries.slice(0, half)), fits),
        ...splitBusPayload(withResults(entries.slice(half)), fits),
      ];
    }
  }
  return [];
}

// Events whose receivers merge parts (rosters are upserted, one round's results
// are unioned). Anything else is sent whole or not at all.
const MERGEABLE_EVENTS = new Set([
  "participants_updated",
  "participant_joined",
  "participant_left",
  "game_state_changed",
  "game_votes_updated",
  "game_results_updated",
]);

/**
 * The bus messages for one event, in send order, each within the size limit.
 * `fits(event, payload)` says whether one message fits. Empty means nothing fits.
 */
export function planBusMessages(
  event: string,
  payload: unknown,
  fits: (event: string, payload: unknown) => boolean,
): Array<{ event: string; payload: unknown }> {
  const gameState = isRecord(payload) ? payload.gameState : undefined;
  if (
    event === "phase_changed" && !fits(event, payload) &&
    isRecord(gameState) && isRecord(gameState.results) && Object.keys(gameState.results).length > 0
  ) {
    // A phase change is applied once, so it cannot arrive in parts. Send it
    // without the results, then the results as a game update, which receivers
    // merge into the round the phase change just set.
    return [
      ...planBusMessages(event, { ...(payload as BusPayload), gameState: { ...gameState, results: {} } }, fits),
      ...planBusMessages("game_results_updated", { gameState }, fits),
    ];
  }
  const parts = MERGEABLE_EVENTS.has(event)
    ? splitBusPayload(payload, (part) => fits(event, part))
    : fits(event, payload) ? [payload] : [];
  return parts.map((part) => ({ event, payload: part }));
}

export function publishLessonEvent(sessionId: string, event: string, payload: unknown, targetUserId?: string) {
  const activeClient = client;
  if (!activeClient || !instanceId) return;
  const toMessage = (name: string, part: unknown) =>
    JSON.stringify({ sourceInstanceId: instanceId, sessionId, event: name, payload: part, targetUserId, scoreClock: true });
  const messages = planBusMessages(
    event,
    payload,
    (name, part) => Buffer.byteLength(toMessage(name, part), "utf8") <= MAX_NOTIFY_BYTES,
  );
  if (!messages.length) {
    logger.warn(`[LessonBus] Skipping oversized event ${event} for session ${sessionId}`);
    return;
  }
  // One client runs its queries in order, so the parts arrive in this order.
  for (const message of messages) {
    void activeClient.query("SELECT pg_notify($1, $2)", [CHANNEL, toMessage(message.event, message.payload)]).catch((error) => {
      if (client === activeClient) {
        client = null;
        scheduleReconnect?.();
      }
      logger.warn("[LessonBus] Failed to publish lesson event:", error);
    });
  }
}

export async function stopLessonSocketBus() {
  busRunning = false;
  busGeneration += 1;
  scheduleReconnect = null;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  const activeClient = client;
  client = null;
  if (activeClient) await activeClient.end().catch(() => undefined);
}
