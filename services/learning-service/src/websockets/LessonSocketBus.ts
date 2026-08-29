import { Client } from "pg";
import { Server } from "socket.io";
import { logger } from "@tutor-advantage/shared-config";

const CHANNEL = "tutor_advantage_lesson_events";
const MAX_NOTIFY_BYTES = 7_500;

export type LessonBusEvent = {
  sourceInstanceId: string;
  sessionId: string;
  event: string;
  payload: unknown;
  targetUserId?: string;
};

let client: Client | null = null;
let instanceId = "";

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
  instanceId = sourceInstanceId;
  const nextClient = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await nextClient.connect();
    await nextClient.query(`LISTEN ${CHANNEL}`);
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
    });
    client = nextClient;
    logger.info("[LessonBus] Cross-instance lesson event bus connected");
  } catch (error) {
    await nextClient.end().catch(() => undefined);
    logger.warn("[LessonBus] Cross-instance event bus unavailable; local events remain active:", error);
  }
}

export function publishLessonEvent(sessionId: string, event: string, payload: unknown, targetUserId?: string) {
  if (!client || !instanceId) return;
  const message = JSON.stringify({ sourceInstanceId: instanceId, sessionId, event, payload, targetUserId });
  if (Buffer.byteLength(message, "utf8") > MAX_NOTIFY_BYTES) {
    logger.warn(`[LessonBus] Skipping oversized event ${event} for session ${sessionId}`);
    return;
  }
  void client.query("SELECT pg_notify($1, $2)", [CHANNEL, message]).catch((error) => {
    logger.warn("[LessonBus] Failed to publish lesson event:", error);
  });
}

export async function stopLessonSocketBus() {
  const activeClient = client;
  client = null;
  if (activeClient) await activeClient.end().catch(() => undefined);
}
