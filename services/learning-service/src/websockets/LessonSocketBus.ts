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
export async function startLessonSocketBus(
  io: Server,
  sourceInstanceId: string,
  onRemoteEvent?: (event: LessonBusEvent) => void,
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
          try {
            onRemoteEvent?.(event);
          } catch (error) {
            logger.warn("[LessonBus] Failed to apply remote lesson state:", error);
          }
          if (event.targetUserId) {
            for (const socket of io.sockets.sockets.values()) {
              if (socket.data.actor?.userId === event.targetUserId) {
                socket.emit(event.event, event.payload);
              }
            }
          } else {
            io.to(event.sessionId).emit(event.event, event.payload);
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

export function publishLessonEvent(sessionId: string, event: string, payload: unknown, targetUserId?: string) {
  const activeClient = client;
  if (!activeClient || !instanceId) return;
  const message = JSON.stringify({ sourceInstanceId: instanceId, sessionId, event, payload, targetUserId });
  if (Buffer.byteLength(message, "utf8") > MAX_NOTIFY_BYTES) {
    logger.warn(`[LessonBus] Skipping oversized event ${event} for session ${sessionId}`);
    return;
  }
  void activeClient.query("SELECT pg_notify($1, $2)", [CHANNEL, message]).catch((error) => {
    if (client === activeClient) {
      client = null;
      scheduleReconnect?.();
    }
    logger.warn("[LessonBus] Failed to publish lesson event:", error);
  });
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
