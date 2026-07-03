import jwt from "jsonwebtoken";

export type SocketActor = {
  userId: string;
  role: string;
};

type LessonSessionAuthorization = {
  tutorId?: string;
  tutorSocketId?: string;
  participants: Map<string, unknown>;
};

export function verifySocketActor(token: string, secret: string): SocketActor {
  const decoded = jwt.verify(token, secret);
  if (
    typeof decoded === "string" ||
    typeof decoded.userId !== "string" ||
    typeof decoded.role !== "string"
  ) {
    throw new Error("Invalid token claims");
  }

  return {
    userId: decoded.userId,
    role: decoded.role,
  };
}

export function isTutorSessionOwner(
  actor: SocketActor | undefined,
  socketId: string,
  session: LessonSessionAuthorization | undefined,
) {
  return Boolean(
    actor?.role === "TUTOR" &&
      session &&
      session.tutorId === actor.userId &&
      session.tutorSocketId === socketId,
  );
}

export function isStudentSessionParticipant(
  actor: SocketActor | undefined,
  session: LessonSessionAuthorization | undefined,
) {
  return Boolean(
    actor?.role === "STUDENT" &&
      session?.participants.has(actor.userId),
  );
}
