import { logger } from "@tutor-advantage/shared-config";
import { prisma } from "@tutor-advantage/database";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_SESSION_LOCK_STALE_MS = 45_000;

export type ActiveSessionLockResult =
  | { acquired: true }
  | { acquired: false; existingSessionId: string };

/** Atomically claim the one live lesson slot for a class. */
export const claimActiveSession = async (
  classId: string | undefined,
  sessionId: string,
  tutorUserId: string,
): Promise<ActiveSessionLockResult> => {
  if (!classId || !UUID_RE.test(classId) || !UUID_RE.test(sessionId) || !UUID_RE.test(tutorUserId)) {
    // Demo/legacy identifiers are not persisted, so retain their in-memory
    // behavior while real classes always use the database lease below.
    return { acquired: true };
  }

  const tryCreate = async (): Promise<ActiveSessionLockResult> => {
    try {
      await prisma.activeLessonSessionLock.create({
        data: { classId, sessionId, tutorUserId },
      });
      return { acquired: true };
    } catch {
      const existing = await prisma.activeLessonSessionLock.findUnique({ where: { classId } });
      if (!existing) return { acquired: false, existingSessionId: "" };

      const stale = Date.now() - existing.lastHeartbeatAt.getTime() > ACTIVE_SESSION_LOCK_STALE_MS;
      if (stale) {
        const removed = await prisma.activeLessonSessionLock.deleteMany({
          where: {
            classId,
            sessionId: existing.sessionId,
            lastHeartbeatAt: existing.lastHeartbeatAt,
          },
        });
        if (removed.count === 1) return tryCreate();
      }
      return { acquired: false, existingSessionId: existing.sessionId };
    }
  };

  return tryCreate();
};

export const heartbeatActiveSession = async (classId: string | undefined, sessionId: string) => {
  if (!classId || !UUID_RE.test(classId) || !UUID_RE.test(sessionId)) return;
  try {
    await prisma.activeLessonSessionLock.updateMany({
      where: { classId, sessionId },
      data: { lastHeartbeatAt: new Date() },
    });
  } catch (error) {
    logger.warn(`[SessionDB] Failed to heartbeat active lesson ${sessionId}:`, error);
  }
};

export const releaseActiveSession = async (classId: string | undefined, sessionId: string) => {
  if (!classId || !UUID_RE.test(classId) || !UUID_RE.test(sessionId)) return;
  try {
    await prisma.activeLessonSessionLock.deleteMany({ where: { classId, sessionId } });
  } catch (error) {
    logger.warn(`[SessionDB] Failed to release active lesson lock ${sessionId}:`, error);
  }
};

export const persistLiveSessionState = async (
  sessionId: string,
  state: {
    currentPhase: number;
    phaseVersion: number;
    expectedPhaseVersion?: number;
    expectedMirrorPhaseVersion?: number;
    activeSentenceIndex?: number;
    phaseSelectedIndices?: Record<number, number>;
    currentDbSessionId?: string;
  },
  mirrorSessionId?: string,
): Promise<boolean> => {
  const sessionIds = Array.from(new Set([sessionId, mirrorSessionId].filter(Boolean))) as string[];

  try {
    const results = await prisma.$transaction(
      sessionIds.map((id) => {
        const expectedPhaseVersion = id === sessionId
          ? state.expectedPhaseVersion
          : state.expectedMirrorPhaseVersion ?? state.expectedPhaseVersion;

        return prisma.interactiveSession.updateMany({
          // A stale service instance must never overwrite a newer phase that
          // was already committed by the active tutor instance. For a phase
          // transition use an exact compare-and-swap value; the only exception
          // is a newly created cycle mirror, whose initial version is zero.
          where: {
            sessionId: id,
            ...(state.currentPhase > 0 ? { assessmentMode: "LESSON" } : {}),
            phaseVersion: expectedPhaseVersion === undefined
              ? { lte: state.phaseVersion }
              : expectedPhaseVersion,
          },
          data: {
            currentPhase: state.currentPhase,
            phaseVersion: state.phaseVersion,
            activeSentenceIndex: state.activeSentenceIndex ?? null,
            phaseSelectedIndices: state.phaseSelectedIndices ?? undefined,
            currentDbSessionId: state.currentDbSessionId ?? null,
            updatedAt: new Date(),
          },
        });
      }),
    );

    const success = results.length === sessionIds.length && results.every((result) => result.count === 1);
    if (!success) {
      logger.warn(
        `[SessionDB] Refused to persist live lesson state ${sessionId}: ` +
        `one or more rows were missing or already had a newer phase version.`,
      );
    }
    return success;
  } catch (error) {
    logger.warn(`[SessionDB] Failed to persist live lesson state ${sessionId}:`, error);
    return false;
  }
};

export const getActiveSessionLock = async (classId: string) => {
  if (!UUID_RE.test(classId)) return null;
  try {
    return await prisma.activeLessonSessionLock.findUnique({ where: { classId } });
  } catch (error) {
    logger.warn(`[SessionDB] Failed to read active lesson lock for ${classId}:`, error);
    return null;
  }
};

export const resolveUserId = async (inputId: string): Promise<string | null> => {
  if (!inputId || inputId === "anonymous") return null;

  // 1. Check if it's already a valid UUID in the User table
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(inputId);
  if (isUuid) {
    const user = await prisma.user.findUnique({ where: { userId: inputId } });
    if (user) return user.userId;
  }

  // 2. Try resolving via OAuthIdentity (Line / external provider subjects)
  // Often LINE IDs aren't UUIDs.
  const identity = await prisma.oAuthIdentity.findFirst({
    where: { providerSubject: inputId },
    select: { userId: true }
  });
  
  if (identity) {
    return identity.userId;
  }

  // 3. If not found, we cannot create constraints safely. Fallback to null.
  return null;
};

export const persistSessionStart = async (
  sessionId: string,
  tutorId: string,
  articleId: string,
  classId?: string,
  classBookCycleId?: string,
  bookId?: string,
) => {
  try {
    let resolvedTutorId = await resolveUserId(tutorId);
    
    // If placeholder ID (like tutor-123) fails, try to resolve via Class owner!
    if (!resolvedTutorId && classId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(classId);
      if (isUuid) {
        const cls = await prisma.class.findUnique({ where: { classId }, select: { tutorUserId: true } });
        if (cls) {
          resolvedTutorId = cls.tutorUserId;
          logger.info(`[SessionDB] Resolved tutor ID ${resolvedTutorId} from Class ${classId}`);
        }
      }
    }

    // Final dev fallback: pick any Tutor if all else fails, rather than crashing
    if (!resolvedTutorId) {
      const fallback = await prisma.user.findFirst({ where: { role: "TUTOR" }, select: { userId: true } });
      if (fallback) {
        resolvedTutorId = fallback.userId;
        logger.info(`[SessionDB] Fallback: Using general Tutor ${resolvedTutorId}`);
      }
    }

    if (!resolvedTutorId) {
      logger.warn(`[SessionDB] Cannot create session entry: Tutor ID not found & could not resolve via Class/Role.`);
      return false;
    }

    // Validate classId format before inserting into DB (must be UUID)
    const dbClassId = (classId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(classId)) ? classId : null;
    const dbClassBookCycleId = (classBookCycleId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(classBookCycleId)) ? classBookCycleId : null;
    const dbBookId = (bookId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookId)) ? bookId : null;

    // Ensure InteractiveSession entry exists
    await prisma.interactiveSession.upsert({
      where: { sessionId },
      create: {
        sessionId,
        tutorUserId: resolvedTutorId,
        articleId,
        classId: dbClassId,
        classBookCycleId: dbClassBookCycleId,
        bookId: dbBookId,
        status: "ACTIVE"
      },
      update: {
        status: "ACTIVE", // reopen if needed
        classBookCycleId: dbClassBookCycleId,
        bookId: dbBookId,
      }
    });
    return true;
  } catch (error) {
    logger.error(`[SessionDB] Error persisting session start:`, error);
    return false;
  }
};

export const persistSessionParticipant = async (sessionId: string, studentId: string) => {
  try {
    let resolvedStudentId = await resolveUserId(studentId);
    
    if (!resolvedStudentId) {
      // Dev fallback: if student not found, try fallback to any existing student user
      const fallback = await prisma.user.findFirst({ where: { role: "STUDENT" }, select: { userId: true } });
      if (fallback) {
        resolvedStudentId = fallback.userId;
        logger.info(`[SessionDB] Resolved student via Fallback: ${resolvedStudentId}`);
      }
    }

    if (!resolvedStudentId) return;

    await prisma.sessionParticipant.upsert({
      where: {
        sessionId_studentUserId: {
          sessionId,
          studentUserId: resolvedStudentId
        }
      },
      create: {
        sessionId,
        studentUserId: resolvedStudentId,
        score: 0
      },
      update: {} // already exists
    });
  } catch (error) {
    logger.error(`[SessionDB] Error persisting session participant:`, error);
  }
};

export const persistAnswer = async (params: {
  sessionId: string;
  studentId: string;
  phase: number;
  answerText: string;
  isCorrect: boolean | null;
  score: number;
  aiFeedback?: string;
  questionText?: string;
  correctAnswer?: string;
  options?: any;
}) => {
  try {
    let resolvedStudentId = await resolveUserId(params.studentId);

    if (!resolvedStudentId) {
      const fallback = await prisma.user.findFirst({ where: { role: "STUDENT" }, select: { userId: true } });
      if (fallback) {
        resolvedStudentId = fallback.userId;
        logger.info(`[SessionDB] Resolved student for answer via Fallback: ${resolvedStudentId}`);
      }
    }

    if (!resolvedStudentId) return;

    // 1. Ensure both session and participant records exist just in case
    // Upserting dynamically ensures robustness
    await prisma.sessionParticipant.upsert({
      where: { sessionId_studentUserId: { sessionId: params.sessionId, studentUserId: resolvedStudentId } },
      create: { sessionId: params.sessionId, studentUserId: resolvedStudentId, score: 0 },
      update: {}
    });

    // 2. Create Answer log
    await prisma.sessionAnswer.create({
      data: {
        sessionId: params.sessionId,
        studentUserId: resolvedStudentId,
        phase: params.phase,
        answerText: params.answerText,
        isCorrect: params.isCorrect,
        score: params.score,
        aiFeedback: params.aiFeedback,
        questionText: params.questionText,
        correctAnswer: params.correctAnswer,
        options: params.options || undefined
      }
    });

    // 3. Update running total on participant tally in the DB
    await prisma.sessionParticipant.update({
      where: { sessionId_studentUserId: { sessionId: params.sessionId, studentUserId: resolvedStudentId } },
      data: {
        score: { increment: params.score }
      }
    });
  } catch (error) {
    logger.error(`[SessionDB] Error saving answer:`, error);
  }
};

export const updateSessionStatus = async (sessionId: string, status: string) => {
  try {
    await prisma.interactiveSession.updateMany({
      where: { sessionId },
      data: { status }
    });
  } catch (error) {
     logger.error(`[SessionDB] Error updating session status:`, error);
  }
};
