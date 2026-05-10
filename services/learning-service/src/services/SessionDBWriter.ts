import { prisma } from "@tutor-advantage/database";

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

export const persistSessionStart = async (sessionId: string, tutorId: string, articleId: string, classId?: string, pin?: string) => {
  try {
    let resolvedTutorId = await resolveUserId(tutorId);
    
    // If placeholder ID (like tutor-123) fails, try to resolve via Class owner!
    if (!resolvedTutorId && classId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(classId);
      if (isUuid) {
        const cls = await prisma.class.findUnique({ where: { classId }, select: { tutorUserId: true } });
        if (cls) {
          resolvedTutorId = cls.tutorUserId;
          console.log(`[SessionDB] Resolved tutor ID ${resolvedTutorId} from Class ${classId}`);
        }
      }
    }

    // Final dev fallback: pick any Tutor if all else fails, rather than crashing
    if (!resolvedTutorId) {
      const fallback = await prisma.user.findFirst({ where: { role: "TUTOR" }, select: { userId: true } });
      if (fallback) {
        resolvedTutorId = fallback.userId;
        console.log(`[SessionDB] Fallback: Using general Tutor ${resolvedTutorId}`);
      }
    }

    if (!resolvedTutorId) {
      console.warn(`[SessionDB] Cannot create session entry: Tutor ID not found & could not resolve via Class/Role.`);
      return;
    }

    // Validate classId format before inserting into DB (must be UUID)
    const dbClassId = (classId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(classId)) ? classId : null;

    // Ensure InteractiveSession entry exists
    await prisma.interactiveSession.upsert({
      where: { sessionId },
      create: {
        sessionId,
        tutorUserId: resolvedTutorId,
        articleId,
        classId: dbClassId,
        pin: pin || "000000",
        status: "ACTIVE"
      },
      update: {
        status: "ACTIVE" // reopen if needed
      }
    });
  } catch (error) {
    console.error(`[SessionDB] Error persisting session start:`, error);
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
        console.log(`[SessionDB] Resolved student via Fallback: ${resolvedStudentId}`);
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
    console.error(`[SessionDB] Error persisting session participant:`, error);
  }
};

export const persistAnswer = async (params: {
  sessionId: string;
  studentId: string;
  phase: number;
  answerText: string;
  isCorrect: boolean;
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
        console.log(`[SessionDB] Resolved student for answer via Fallback: ${resolvedStudentId}`);
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
    console.error(`[SessionDB] Error saving answer:`, error);
  }
};

export const updateSessionStatus = async (sessionId: string, status: string) => {
  try {
    await prisma.interactiveSession.updateMany({
      where: { sessionId },
      data: { status }
    });
  } catch (error) {
     console.error(`[SessionDB] Error updating session status:`, error);
  }
};
