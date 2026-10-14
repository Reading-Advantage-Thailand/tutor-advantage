// How the live lesson reacts to a socket error from useLessonSocket.
// - "ok": no error.
// - "reconnecting": the student already joined (session data exists). socket.io
//   reconnects on its own and `connect` clears the error, so keep the current
//   phase on screen and only show a small non-blocking banner.
// - "fatal": nothing to show yet (e.g. no socket token), or the server says
//   there is no open session (reconnecting cannot fix that) → full-screen /
//   notice state with "try again" (remount the socket) and "back home".

export type LessonConnectionState = "ok" | "reconnecting" | "fatal";

/**
 * What kind of error the socket reported, so the UI can explain it:
 * - "notStarted": the server's "no open class / the tutor has not started the
 *   session" reply to join_class. This is the normal state when a student opens
 *   the lobby before the tutor starts, so it must not read as a network failure.
 * - "server": another message the server wrote in Thai for students → show it.
 * - "network": transport/auth errors (raw English text) → generic friendly copy.
 */
export type LessonErrorKind = "notStarted" | "server" | "network";

// Server text (learning-service lessonHandler join_class):
// "ยังไม่มีคลาสที่เปิดสอนในขณะนี้ หรือคุณครูยังไม่ได้เริ่มเซสชัน"
const NOT_STARTED_PATTERN = /ยังไม่มีคลาสที่เปิดสอน|ยังไม่ได้เริ่มเซสชัน/;
const THAI_SCRIPT = /[฀-๿]/;

export function getLessonErrorKind(error: string | null | undefined): LessonErrorKind {
  if (error && NOT_STARTED_PATTERN.test(error)) return "notStarted";
  if (error && THAI_SCRIPT.test(error)) return "server";
  return "network";
}

export function getLessonConnectionState(error: string | null | undefined, hasSession: boolean): LessonConnectionState {
  if (!error) return "ok";
  // No open session: waiting on the reconnect strip would never end.
  if (getLessonErrorKind(error) === "notStarted") return "fatal";
  return hasSession ? "reconnecting" : "fatal";
}
