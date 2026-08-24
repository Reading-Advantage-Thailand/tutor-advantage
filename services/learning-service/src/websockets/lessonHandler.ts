import { getJwtSecret, logger } from "@tutor-advantage/shared-config";
import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import {
  FINAL_LEADERBOARD_PHASE,
  PAIR_CONVERSATION_PHASE,
  lessonSessionService,
} from "../services/LessonSessionService";
import { evaluateShortAnswer, evaluateWriting, answerLanguageQuestion } from "../services/AIEvaluator";
import { getArticleDetails } from "../services/ReadingAdvantageDB";
import { getDemoArticle } from "../services/demoLessons";
import * as dbWriter from "../services/SessionDBWriter";
import { LineNotificationService } from "../services/LineNotificationService";
import { checkAndUnlockBadges } from "../services/BadgeService";
import { prisma } from "@tutor-advantage/database";
import { publishLessonEvent, startLessonSocketBus } from "./LessonSocketBus";
import {
  isStudentSessionParticipant,
  isTutorSessionOwner,
  SocketActor,
  verifySocketActor,
} from "./lessonAuthorization";

export {
  isStudentSessionParticipant,
  isTutorSessionOwner,
  verifySocketActor,
} from "./lessonAuthorization";

function seededShuffle<T>(array: T[], seedInput: string): T[] {
  const result = [...array];
  if (!seedInput) return result;
  
  let seed = 0;
  for (let i = 0; i < seedInput.length; i++) {
    seed += seedInput.charCodeAt(i);
  }

  for (let i = result.length - 1; i > 0; i--) {
    const x = Math.sin(seed + i) * 10000;
    const rand = x - Math.floor(x);
    const j = Math.floor(rand * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const setupLessonSocket = (io: Server) => {
  const instanceId = uuidv4();
  void startLessonSocketBus(io, instanceId);
  const broadcastSession = (sessionId: string, event: string, payload: unknown) => {
    io.to(sessionId).emit(event, payload);
    publishLessonEvent(sessionId, event, payload);
  };
  const broadcastToTutor = (
    session: { sessionId: string; tutorSocketId: string; tutorId: string },
    event: string,
    payload: unknown,
  ) => {
    io.to(session.tutorSocketId).emit(event, payload);
    publishLessonEvent(session.sessionId, event, payload, session.tutorId);
  };
  const persistLiveState = async (session: { sessionId: string; currentDbSessionId?: string; currentPhase: number; activeSentenceIndex?: number; phaseSelectedIndices?: Record<number, number> }) => {
    await dbWriter.persistLiveSessionState(session.sessionId, session);
    if (session.currentDbSessionId && session.currentDbSessionId !== session.sessionId) {
      await dbWriter.persistLiveSessionState(session.currentDbSessionId, session);
    }
  };

  const AI_RATE_WINDOW_MS = 60_000;
  const AI_MAX_REQUESTS_PER_WINDOW = 20;
  const AI_MAX_CONCURRENT_PER_USER = 2;
  const aiRateByUser = new Map<string, { windowStartedAt: number; count: number }>();
  const aiInFlightByUser = new Map<string, number>();
  const aiReservations = new Set<string>();
  const sessionHeartbeats = new Map<string, NodeJS.Timeout>();

  const startSessionHeartbeat = (classId: string | undefined, sessionId: string) => {
    if (!classId || sessionHeartbeats.has(sessionId)) return;
    const timer = setInterval(() => {
      void dbWriter.heartbeatActiveSession(classId, sessionId);
    }, 15_000);
    if (typeof timer.unref === "function") timer.unref();
    sessionHeartbeats.set(sessionId, timer);
  };

  const stopSessionHeartbeat = (sessionId: string) => {
    const timer = sessionHeartbeats.get(sessionId);
    if (!timer) return;
    clearInterval(timer);
    sessionHeartbeats.delete(sessionId);
  };

  const acquireAiSlot = (userId: string, requestKey: string) => {
    if (aiReservations.has(requestKey)) {
      return { ok: false, code: "AI_REQUEST_ALREADY_IN_PROGRESS" } as const;
    }

    const now = Date.now();
    const current = aiRateByUser.get(userId);
    const rate = !current || now - current.windowStartedAt >= AI_RATE_WINDOW_MS
      ? { windowStartedAt: now, count: 0 }
      : current;
    if (rate.count >= AI_MAX_REQUESTS_PER_WINDOW) {
      aiRateByUser.set(userId, rate);
      return { ok: false, code: "AI_QUOTA_EXCEEDED" } as const;
    }

    const inFlight = aiInFlightByUser.get(userId) || 0;
    if (inFlight >= AI_MAX_CONCURRENT_PER_USER) {
      return { ok: false, code: "AI_CONCURRENCY_LIMIT" } as const;
    }

    rate.count += 1;
    aiRateByUser.set(userId, rate);
    aiInFlightByUser.set(userId, inFlight + 1);
    aiReservations.add(requestKey);
    return { ok: true } as const;
  };

  const releaseAiSlot = (userId: string, requestKey: string) => {
    aiReservations.delete(requestKey);
    const inFlight = aiInFlightByUser.get(userId) || 0;
    if (inFlight <= 1) aiInFlightByUser.delete(userId);
    else aiInFlightByUser.set(userId, inFlight - 1);
  };

  const restoreSharedSession = async (classId: string, tutorSocketId: string) => {
    const lock = await dbWriter.getActiveSessionLock(classId);
    if (!lock) return undefined;

    const sharedSession = await prisma.interactiveSession.findUnique({
      where: { sessionId: lock.sessionId },
    });
    if (
      !sharedSession ||
      sharedSession.classId !== classId ||
      (sharedSession.status !== "ACTIVE" && sharedSession.status !== "FINISHED")
    ) {
      return undefined;
    }

    const articleData = await getArticleDetails(sharedSession.articleId, sharedSession.bookId || undefined);
    if (!articleData) return undefined;

    const restoredSession = lessonSessionService.createSession(
      sharedSession.tutorUserId,
      tutorSocketId,
      sharedSession.articleId,
      articleData,
      classId,
      sharedSession.classBookCycleId || undefined,
      sharedSession.bookId || undefined,
      false,
      sharedSession.sessionId,
      {
        currentPhase: sharedSession.currentPhase,
                activeSentenceIndex: sharedSession.activeSentenceIndex,
                phaseSelectedIndices: (sharedSession.phaseSelectedIndices as Record<number, number> | null) || null,
                currentDbSessionId: sharedSession.currentDbSessionId,
                status: sharedSession.currentPhase > 0 ? "ACTIVE" : "LOBBY",
      },
    );

    const participants = await prisma.sessionParticipant.findMany({
      where: { sessionId: sharedSession.sessionId },
      include: { student: { select: { displayName: true, profilePictureUrl: true } } },
    });
    for (const participant of participants) {
      lessonSessionService.joinSessionByClassId(
        classId,
        participant.studentUserId,
        participant.student.displayName || "Student",
        `restored:${participant.studentUserId}`,
        participant.student.profilePictureUrl || undefined,
        participant.studentUserId,
      );
      const localParticipant = restoredSession.participants.get(participant.studentUserId);
      if (localParticipant) localParticipant.score = participant.score;
    }
    startSessionHeartbeat(classId, restoredSession.sessionId);
    return restoredSession;
  };

  // Authentication Middleware
  io.use((socket, next) => {
    // Never accept credentials in the Socket.IO URL query string: URLs are
    // routinely logged by proxies and browser tooling.  Clients must use the
    // short-lived audience-bound auth token in the handshake body.
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }
    
    void (async () => {
      try {
        const tokenActor = verifySocketActor(String(token), getJwtSecret());
        const currentUser = await prisma.user.findUnique({
          where: { userId: tokenActor.userId },
          select: { userId: true, role: true, isActive: true },
        });

        if (!currentUser || !currentUser.isActive) {
          return next(new Error("Authentication error: Invalid or suspended account"));
        }

        // Use current database state so role changes and suspensions take
        // effect even while the original session token remains unexpired.
        socket.data.actor = {
          userId: currentUser.userId,
          role: currentUser.role,
        } satisfies SocketActor;
        return next();
      } catch {
        return next(new Error("Authentication error: Invalid or expired token"));
      }
    })();
  });

  io.on("connection", (socket: Socket) => {
    const actor = socket.data.actor as SocketActor;
    const rejectForbidden = (action: string) => {
      logger.warn(
        `[Socket] Forbidden ${action} by ${actor.role} ${actor.userId} (${socket.id})`,
      );
      socket.emit("error", { message: "You are not allowed to perform this action." });
    };

    logger.info(`Socket connected: ${socket.id}`);

    // Tutor creates a new session
    socket.on("create_session", async ({ articleId, classId, classBookCycleId, bookId, demo }) => {
      if (actor.role !== "TUTOR") {
        rejectForbidden("create_session");
        return;
      }

      const tutorId = actor.userId;
      const isDemo = demo === true;
      logger.info(`[Socket] Tutor ${tutorId} creating ${isDemo ? "DEMO " : ""}session for class: ${classId}`);
      let claimedLock: { classId: string; sessionId: string } | undefined;
      try {
        const ownedClass = classId
          ? await prisma.class.findFirst({
              where: { classId, tutorUserId: tutorId },
              select: {
                classId: true,
                tutorUserId: true,
                isDemo: true,
                expiresAt: true,
                bookId: true,
              },
            })
          : null;

        if (classId && !ownedClass) {
          rejectForbidden("create_session for unowned class");
          return;
        }

        // Demo mode: zero-cost preview. Fixed bundled content, no class/cycle,
        // no DB persistence, no AI scoring (solo tutor, no student answers).
        if (isDemo) {
          const demoArticle = getDemoArticle(articleId);
          if (!demoArticle) {
            socket.emit("error", { message: "Demo lesson not found." });
            return;
          }
          const demoSession = lessonSessionService.createSession(
            tutorId,
            socket.id,
            articleId,
            demoArticle,
            undefined,
            undefined,
            undefined,
            true,
          );
          socket.join(demoSession.sessionId);
          socket.emit("session_created", {
          sessionId: demoSession.sessionId,
          currentPhase: demoSession.currentPhase,
          phaseRestored: demoSession.phaseRestored ?? false,
          resumePhase: demoSession.resumePhase,
          articleData: demoSession.articleData,
          activeSentenceIndex: demoSession.activeSentenceIndex,
          flagCounts: lessonSessionService.getFlagCounts(demoSession),
            gameState: lessonSessionService.getGameStatePayload(demoSession),
          });
          logger.info(`[Socket] DEMO session created: ${demoSession.sessionId}`);
          return;
        }

        let resolvedCycleId = classBookCycleId;
        let resolvedBookId = bookId;
        let resolvedArticleId = articleId;

        // Demo classes are locked to one fixed lesson: the first article of the
        // class book. They also stop accepting sessions once expired.
        if (ownedClass) {
          const cls = ownedClass;
          if (cls?.isDemo) {
            if (cls.expiresAt && cls.expiresAt.getTime() < Date.now()) {
              socket.emit("error", { message: "ห้องเรียน Demo นี้หมดอายุแล้ว ไม่สามารถเริ่มสอนได้" });
              return;
            }
            const firstArticle = await prisma.article.findFirst({
              where: { bookId: cls.bookId },
              orderBy: [
                { createdAt: "asc" },
                { articleId: "asc" }
              ],
            });
            if (!firstArticle) {
              socket.emit("error", { message: "หนังสือของห้อง Demo นี้ยังไม่มีบทเรียน" });
              return;
            }
            resolvedArticleId = firstArticle.articleId;
          }
        }

        // Non-demo classes must name the article to teach.
        if (!resolvedArticleId) {
          socket.emit("error", { message: "กรุณาเลือกบทเรียนก่อนเริ่มสอน (missing articleId)" });
          return;
        }

        if (classId) {
          // A caller may send all three IDs, so validate them all.  Previously
          // supplying both cycleId and bookId skipped this block entirely and
          // allowed an article from an unrelated book to enter the session.
          const cycle = resolvedCycleId
            ? await prisma.classBookCycle.findFirst({
                where: { classBookCycleId: resolvedCycleId, classId },
              })
            : await prisma.classBookCycle.findFirst({
                where: { classId, status: "OPEN" },
                orderBy: { sequence: "desc" },
              });

          if (resolvedCycleId && !cycle) {
            socket.emit("error", { message: "วงรอบหนังสือไม่ตรงกับห้องเรียนนี้" });
            return;
          }

          const classBookId = ownedClass?.bookId;
          const derivedBookId = cycle?.bookId || classBookId;
          if (resolvedBookId && derivedBookId && resolvedBookId !== derivedBookId) {
            socket.emit("error", { message: "หนังสือไม่ตรงกับวงรอบหรือห้องเรียนนี้" });
            return;
          }

          resolvedCycleId = cycle?.classBookCycleId;
          resolvedBookId = derivedBookId;

          if (resolvedBookId) {
            const articleBinding = await prisma.article.findFirst({
              where: { articleId: resolvedArticleId, bookId: resolvedBookId },
              select: { articleId: true },
            });
            if (!articleBinding) {
              socket.emit("error", { message: "บทเรียนไม่อยู่ในหนังสือของห้องเรียนนี้" });
              return;
            }
          }
        } else if (resolvedBookId) {
          const articleBinding = await prisma.article.findFirst({
            where: { articleId: resolvedArticleId, bookId: resolvedBookId },
            select: { articleId: true },
          });
          if (!articleBinding) {
            socket.emit("error", { message: "บทเรียนไม่อยู่ในหนังสือที่เลือก" });
            return;
          }
        }

        const articleData = await getArticleDetails(resolvedArticleId, resolvedBookId);
        if (!articleData) {
          socket.emit("error", { message: "ไม่พบบทเรียนที่เลือก" });
          return;
        }

        const localSession = classId ? lessonSessionService.getSessionByClassId(classId) : undefined;
        const proposedSessionId = localSession?.sessionId || uuidv4();
        if (classId && ownedClass && !localSession) {
          const lock = await dbWriter.claimActiveSession(classId, proposedSessionId, ownedClass.tutorUserId);
          if (!lock.acquired) {
            // Another instance may own the socket room.  Rehydrate the
            // persisted session header/state locally instead of creating a
            // second room or dropping a reconnecting tutor on the floor.
            const sharedSession = lock.existingSessionId
              ? await prisma.interactiveSession.findUnique({
                  where: { sessionId: lock.existingSessionId },
                })
              : null;
            if (
              sharedSession &&
              sharedSession.classId === classId &&
              sharedSession.tutorUserId === ownedClass.tutorUserId &&
              (sharedSession.status === "ACTIVE" || sharedSession.status === "FINISHED")
            ) {
              const restoredSession = lessonSessionService.createSession(
                tutorId,
                socket.id,
                sharedSession.articleId,
                articleData,
                classId,
                sharedSession.classBookCycleId || resolvedCycleId,
                sharedSession.bookId || resolvedBookId,
                false,
                sharedSession.sessionId,
                {
                  currentPhase: sharedSession.currentPhase,
                  activeSentenceIndex: sharedSession.activeSentenceIndex,
                  phaseSelectedIndices: (sharedSession.phaseSelectedIndices as Record<number, number> | null) || null,
                  currentDbSessionId: sharedSession.currentDbSessionId,
                  status: sharedSession.currentPhase > 0 ? "ACTIVE" : "LOBBY",
                },
              );
              const restoredParticipants = await prisma.sessionParticipant.findMany({
                where: { sessionId: sharedSession.sessionId },
                include: { student: { select: { displayName: true, profilePictureUrl: true } } },
              });
              for (const participant of restoredParticipants) {
                lessonSessionService.joinSessionByClassId(
                  classId,
                  participant.studentUserId,
                  participant.student.displayName || "Student",
                  `restored:${participant.studentUserId}`,
                  participant.student.profilePictureUrl || undefined,
                  participant.studentUserId,
                );
                const localParticipant = restoredSession.participants.get(participant.studentUserId);
                if (localParticipant) localParticipant.score = participant.score;
              }
              socket.join(restoredSession.sessionId);
              startSessionHeartbeat(classId, restoredSession.sessionId);
              socket.emit("session_created", {
                sessionId: restoredSession.sessionId,
                currentPhase: restoredSession.currentPhase,
                phaseRestored: restoredSession.phaseRestored ?? false,
                resumePhase: restoredSession.resumePhase,
                articleData: restoredSession.articleData,
                phaseSelectedIndices: restoredSession.phaseSelectedIndices,
                activeSentenceIndex: restoredSession.activeSentenceIndex,
                flagCounts: lessonSessionService.getFlagCounts(restoredSession),
                pairs: restoredSession.currentPhase === PAIR_CONVERSATION_PHASE
                  ? lessonSessionService.getPairsPayload(restoredSession)
                  : null,
                gameState: lessonSessionService.getGameStatePayload(restoredSession),
              });
              logger.info(`[Socket] Rehydrated shared session ${restoredSession.sessionId} for class ${classId}`);
              return;
            }
            socket.emit("error", {
              message: "ห้องเรียนนี้มีเซสชันกำลังสอนอยู่แล้ว กรุณาเชื่อมต่อเซสชันเดิม",
              code: "ACTIVE_SESSION_EXISTS",
              sessionId: lock.existingSessionId,
            });
            return;
          }
          claimedLock = { classId, sessionId: proposedSessionId };
        }

        logger.info(`================= QUESTIONS LIST =================`);
        logger.info(`Available MCQ questions:`, articleData?.multipleChoiceQuestions?.map((q: any) => q.question));
        logger.info(`Available SAQ questions:`, articleData?.shortAnswerQuestions?.map((q: any) => q.question));
        logger.info(`==================================================`);
        const session = lessonSessionService.createSession(
          tutorId,
          socket.id,
          resolvedArticleId,
          articleData,
          classId,
          resolvedCycleId,
          resolvedBookId,
          false,
          proposedSessionId,
        );
        if (claimedLock && session.sessionId !== claimedLock.sessionId) {
          await dbWriter.releaseActiveSession(claimedLock.classId, claimedLock.sessionId);
          claimedLock = undefined;
        }
        startSessionHeartbeat(classId, session.sessionId);
        // Keep currentDbSessionId undefined initially, so the first cycle defaults to the standard sessionId!
        socket.join(session.sessionId);

        // PERSIST START OF SESSION TO DB (This creates initial Cycle 1 record)
        await dbWriter.persistSessionStart(session.sessionId, tutorId, resolvedArticleId, classId, resolvedCycleId, resolvedBookId);
        await persistLiveState(session);

        socket.emit("session_created", {
          sessionId: session.sessionId,
          currentPhase: session.currentPhase,
          phaseRestored: session.phaseRestored ?? false,
          resumePhase: session.resumePhase,
          articleData: session.articleData,
          phaseSelectedIndices: session.phaseSelectedIndices,
          activeSentenceIndex: session.activeSentenceIndex,
          flagCounts: lessonSessionService.getFlagCounts(session),
          pairs: session.currentPhase === PAIR_CONVERSATION_PHASE ? lessonSessionService.getPairsPayload(session) : null,
          gameState: lessonSessionService.getGameStatePayload(session),
        });
        logger.info(`[Socket] Session created: ${session.sessionId} for class ${classId}`);
      } catch (error_err) {
        if (claimedLock) {
          await dbWriter.releaseActiveSession(claimedLock.classId, claimedLock.sessionId);
        }
        const error = error_err as Error & { code?: string; details?: string; };
        logger.error("[Socket] Error creating session:", error);
        socket.emit("error", { message: "Failed to create session. Please check database connection." });
      }
    });

    // Student joins a session using classId.
    socket.on("join_class", async ({ classId, name, pictureUrl }) => {
      if (actor.role !== "STUDENT") {
        rejectForbidden("join_class");
        return;
      }

      const studentId = actor.userId;
      logger.info(`[Socket] Student ${name} (${studentId}) attempting to join class: ${classId}`);
      const resolvedStudentId = studentId;

      if (!resolvedStudentId) {
        logger.warn(`[Socket] Join denied: could not resolve student ${studentId}`);
        socket.emit("error", { message: "Please sign in before joining class." });
        return;
      }

      const activeEnrollment = await prisma.enrollment.findFirst({
        where: { classId, studentUserId: resolvedStudentId, status: "ACTIVE" },
      });

      if (!activeEnrollment) {
        logger.warn(`[Socket] Join denied: student ${studentId} has no ACTIVE enrollment for class ${classId}`);
        socket.emit("error", { message: "Please complete payment before joining class." });
        return;
      }

      let activeSession = lessonSessionService.getSessionByClassId(classId);
      if (!activeSession) {
        try {
          activeSession = await restoreSharedSession(classId, `shared-tutor:${classId}`);
        } catch (error) {
          logger.warn(`[Socket] Could not restore shared session for class ${classId}:`, error);
        }
      }
      if (activeSession?.classBookCycleId) {
        let activeAccess = await prisma.enrollmentPackage.findFirst({
          where: {
            enrollmentId: activeEnrollment.enrollmentId,
            classBookCycleId: activeSession.classBookCycleId,
            status: "ACTIVE",
          },
        });
        let cycle: {
          sequence: number;
          bookId: string;
          packagePriceMinor: bigint | number | null;
          book?: { title: string; bookCode: string } | null;
          class: { bookId: string };
        } | null = null;

        if (!activeAccess) {
          cycle = await prisma.classBookCycle.findUnique({
            where: { classBookCycleId: activeSession.classBookCycleId },
            include: { book: true, class: true },
          });

          if (cycle?.sequence === 1 && cycle.bookId === cycle.class.bookId) {
            activeAccess = await prisma.enrollmentPackage.upsert({
              where: {
                enrollmentId_classBookCycleId: {
                  enrollmentId: activeEnrollment.enrollmentId,
                  classBookCycleId: activeSession.classBookCycleId,
                },
              },
              create: {
                enrollmentId: activeEnrollment.enrollmentId,
                classBookCycleId: activeSession.classBookCycleId,
                studentUserId: resolvedStudentId,
                status: "ACTIVE",
              },
              update: {
                status: "ACTIVE",
              },
            });
          }
        }

        if (!activeAccess) {
          logger.warn(`[Socket] Join denied: student ${studentId} has no ACTIVE access for cycle ${activeSession.classBookCycleId}`);
          const paymentUrl = `/payment?classId=${classId}&cycleId=${activeSession.classBookCycleId}`;
          socket.emit("payment_required", {
            classId,
            cycleId: activeSession.classBookCycleId,
            bookId: activeSession.bookId,
            bookTitle: cycle?.book?.title || "this book",
            bookCode: cycle?.book?.bookCode || null,
            packagePriceSatang:
              cycle?.packagePriceMinor === undefined || cycle?.packagePriceMinor === null
                ? null
                : Number(cycle.packagePriceMinor),
            paymentUrl,
            message: "Please complete payment before joining this book.",
          });
          return;
        }
      }

      const session = lessonSessionService.joinSessionByClassId(classId, studentId, name, socket.id, pictureUrl, resolvedStudentId);
      if (session) {
        socket.join(session.sessionId);
        socket.emit("join_success", {
          sessionId: session.sessionId,
          currentStudentId: studentId,
          currentPhase: session.currentPhase,
          articleData: session.articleData,
          phaseSelectedIndices: session.phaseSelectedIndices,
          phaseRestored: session.phaseRestored ?? false,
          resumePhase: session.resumePhase,
          activeSentenceIndex: session.activeSentenceIndex,
          flagCounts: lessonSessionService.getFlagCounts(session),
          // Reconnecting mid Pair Conversation still shows the student's pair
          pairs: session.currentPhase === PAIR_CONVERSATION_PHASE ? lessonSessionService.getPairsPayload(session) : null,
          gameState: lessonSessionService.getGameStatePayload(session),
        });
        
        broadcastSession(session.sessionId, "participants_updated", {
          participants: Array.from(session.participants.values())
        });
        logger.info(`[Socket] Student ${name} joined class ${classId} successfully (Pic: ${!!pictureUrl})`);
        
        // PERSIST PARTICIPANT JOIN
        dbWriter.persistSessionParticipant(session.currentDbSessionId || session.sessionId, studentId);
      } else {
        logger.warn(`[Socket] Join failed: No active session for class ${classId}`);
        socket.emit("error", { message: "ยังไม่มีคลาสที่เปิดสอนในขณะนี้ หรือคุณครูยังไม่ได้เริ่มเซสชัน" });
      }
    });

    // Toggle Ready status
    socket.on("toggle_ready", ({ sessionId }) => {
      const activeSession = lessonSessionService.getSession(sessionId);
      if (!isStudentSessionParticipant(actor, activeSession)) {
        rejectForbidden("toggle_ready");
        return;
      }

      const studentId = actor.userId;
      logger.info(`[Socket] Student ${studentId} toggled ready for session ${sessionId}`);
      const session = lessonSessionService.toggleReady(sessionId, studentId);
      if (session) {
        broadcastSession(session.sessionId, "participants_updated", {
          participants: Array.from(session.participants.values())
        });
      }
    });

    // Tutor changes phase
    socket.on("change_phase", async ({ sessionId, phase }) => {
      const authorizedSession = lessonSessionService.getSession(sessionId);
      if (!isTutorSessionOwner(actor, socket.id, authorizedSession)) {
        rejectForbidden("change_phase");
        return;
      }

      const previousPhase = authorizedSession?.currentPhase ?? 0;
      const shouldRewind = phase > 0 && phase < previousPhase;
      const session = shouldRewind
        ? lessonSessionService.rewindPhase(sessionId, phase)
        : lessonSessionService.setPhase(sessionId, phase);
      if (session) {
        // --- CRITICAL: DYNAMIC RESTART RECORDING ---
        // If starting a new instructional cycle (Phase 0 -> Phase 1), determine if we need a FRESH DB identity.
        // Demo sessions skip all persistence — they only loop the in-memory phase state.
        if (phase === 1 && !session.isDemo && !session.phaseRestored) {
          if (!session.currentDbSessionId) {
            // --- FIRST CYCLE ---
            // Set explicit key to lock current cycle, but reuse original initialized DB record to avoid double logging!
            session.currentDbSessionId = sessionId; 
            logger.info(`[Socket] CYCLE 1: Initializing first loop using original session ${sessionId}`);
          } else {
            // --- RESTART CYCLES (2, 3+) ---
            // This generates a TOTALLY distinct row in student dashboard history while keeping same socket room!
            const newDbId = uuidv4();
            session.currentDbSessionId = newDbId; // Set explicit new key for this cycle
            logger.info(`[Socket] RECYCLE: Starting fresh learning loop for room ${sessionId}. New DB Session: ${newDbId}`);
            
            // 1. Create NEW DB header record
            await dbWriter.persistSessionStart(
              newDbId,
              session.tutorId,
              session.articleId,
              session.classId,
              session.classBookCycleId,
              session.bookId,
            );
            
            // 2. Automatically enroll all existing students in the NEW round immediately
            const activePeers = Array.from(session.participants.keys());
            for (const pId of activePeers) {
               await dbWriter.persistSessionParticipant(newDbId, pId);
            }
          }
        }

        // Broadcast new phase to everyone in the room.
        // Pair Conversation carries the freshly generated pairs.
        broadcastSession(sessionId, "phase_changed", {
          phase,
          phaseSelectedIndices: session.phaseSelectedIndices,
          pairs: phase === PAIR_CONVERSATION_PHASE ? lessonSessionService.getPairsPayload(session) : null,
          gameState: lessonSessionService.getGameStatePayload(session),
          phaseRestored: session.phaseRestored ?? false,
          resumePhase: session.resumePhase,
          activeSentenceIndex: session.activeSentenceIndex,
          flagCounts: lessonSessionService.getFlagCounts(session),
        });
        broadcastSession(sessionId, "participants_updated", {
          participants: Array.from(session.participants.values())
        });
        logger.info(`Session ${sessionId} changed to phase ${phase}`);

        // Returning to the lobby closes the current DB round while keeping the
        // in-memory room available for a fresh cycle. Phase 1 will create a
        // new DB identity when the tutor starts again.
        if (phase === 0 && previousPhase > 0 && !session.isDemo) {
          await dbWriter.updateSessionStatus(session.currentDbSessionId || sessionId, "FINISHED");
        }

        // If changing to final leaderboard, mark ACTIVE DB ROUND as FINISHED
        // Demo sessions have no DB round, no badges to unlock, and no students to notify.
        if (phase === FINAL_LEADERBOARD_PHASE && !session.isDemo && !session.phaseRestored) {
          dbWriter.updateSessionStatus(session.currentDbSessionId || sessionId, "FINISHED");
          void persistLiveState(session);

          if (session.finalNotificationSent) {
            // The round may have been rewound from the final leaderboard.
            // Re-open the DB status above, but do not notify students twice.
            return;
          }
          session.finalNotificationSent = true;

          // Non-blocking badge unlock check for the tutor
          if (session.tutorId) {
            checkAndUnlockBadges(session.tutorId).catch((e) =>
              logger.error("[Socket] Badge check failed:", e),
            );
          }

          // Trigger LINE Notifications for final score
          (async () => {
            try {
              const articleTitle = session.articleData?.title || "บทเรียน";
              const studentList = Array.from(session.participants.values());
              
              for (const p of studentList) {
                 // Get final score in current context
                 const finalScore = p.score || 0;
                 const historyDeepLink = LineNotificationService.buildLiffDeepLink("/lesson/history");
                 const deepLinkSuffix = historyDeepLink ? `\n\n${historyDeepLink}` : "\n\nเข้าเช็คประวัติการเรียนและเฉลยคำตอบได้ที่ Student LIFF ครับ";
                 const pushMsg = `🎉 จบคาบเรียนแล้ว!\n\nคุณได้คะแนนรวม ${finalScore} คะแนน จากบทเรียน "${articleTitle}"${deepLinkSuffix}`;

                 if (p.resolvedUserId) {
                   await LineNotificationService.sendToUser(p.resolvedUserId, pushMsg, { type: "notifyScoreUpdates" });
                 }
              }
            } catch (e) {
              logger.error("[Socket] Failed to trigger score notification:", e);
            }
          })();
        }

        if (shouldRewind && !session.isDemo) {
          // A rewind re-opens the current DB round so the Tutor can continue
          // the lesson after reviewing the restored phase.
          dbWriter.updateSessionStatus(session.currentDbSessionId || sessionId, "ACTIVE");
        }
        if (!session.isDemo) {
          void persistLiveState(session);
        }
      } else if (shouldRewind) {
        socket.emit("error", {
          message: "This phase cannot be rewound because its saved state is no longer available.",
        });
      }
    });

    socket.on("start_game_vote", ({ sessionId, phase }) => {
      const activeSession = lessonSessionService.getSession(sessionId);
      if (!isTutorSessionOwner(actor, socket.id, activeSession)) {
        rejectForbidden("start_game_vote");
        return;
      }
      const gameState = lessonSessionService.startGameVote(
        sessionId,
        Number(phase || activeSession?.currentPhase),
      );
      if (gameState) {
        broadcastSession(sessionId, "game_state_changed", { gameState });
      }
    });

    socket.on("submit_game_vote", ({ sessionId, gameId }) => {
      const activeSession = lessonSessionService.getSession(sessionId);
      if (!isStudentSessionParticipant(actor, activeSession)) {
        rejectForbidden("submit_game_vote");
        return;
      }
      const gameState = lessonSessionService.submitGameVote(
        sessionId,
        actor.userId,
        String(gameId || ""),
      );
      if (gameState) {
        broadcastSession(sessionId, "game_votes_updated", { gameState });
      }
    });

    socket.on("lock_game_vote", ({ sessionId }) => {
      const activeSession = lessonSessionService.getSession(sessionId);
      if (!isTutorSessionOwner(actor, socket.id, activeSession)) {
        rejectForbidden("lock_game_vote");
        return;
      }
      const gameState = lessonSessionService.lockGameVote(sessionId);
      if (gameState) {
        broadcastSession(sessionId, "game_state_changed", { gameState });
      }
    });

    const scheduleGameStart = (sessionId: string, countdownEndsAt?: number) => {
      const expectedCountdownEndsAt = countdownEndsAt || Date.now();
      const delay = Math.max(0, expectedCountdownEndsAt - Date.now());
      setTimeout(() => {
        const playingState = lessonSessionService.markGamePlaying(
          sessionId,
          expectedCountdownEndsAt,
        );
        if (playingState) {
          broadcastSession(sessionId, "game_state_changed", { gameState: playingState });
        }
      }, delay);
    };

    socket.on("start_game_intro", ({ sessionId, tutorialEnabled, teacherDemoEnabled }) => {
      const activeSession = lessonSessionService.getSession(sessionId);
      if (!isTutorSessionOwner(actor, socket.id, activeSession)) {
        rejectForbidden("start_game_intro");
        return;
      }
      const gameState = lessonSessionService.startGameIntro(sessionId, {
        tutorialEnabled: tutorialEnabled !== false,
        teacherDemoEnabled: teacherDemoEnabled === true,
      });
      if (gameState) {
        broadcastSession(sessionId, "game_state_changed", { gameState });
        if (gameState.status === "countdown") {
          scheduleGameStart(sessionId, gameState.countdownEndsAt);
        }
      }
    });

    socket.on("advance_game_intro", ({ sessionId, durationMs }) => {
      const activeSession = lessonSessionService.getSession(sessionId);
      if (!isTutorSessionOwner(actor, socket.id, activeSession)) {
        rejectForbidden("advance_game_intro");
        return;
      }
      const gameState = lessonSessionService.advanceGameIntro(
        sessionId,
        Number(durationMs || 5000),
      );
      if (gameState) {
        broadcastSession(sessionId, "game_state_changed", { gameState });
        if (gameState.status === "countdown") {
          scheduleGameStart(sessionId, gameState.countdownEndsAt);
        }
      }
    });

    socket.on("start_game_countdown", ({ sessionId, durationMs }) => {
      const activeSession = lessonSessionService.getSession(sessionId);
      if (!isTutorSessionOwner(actor, socket.id, activeSession)) {
        rejectForbidden("start_game_countdown");
        return;
      }
      const gameState = lessonSessionService.startGameCountdown(
        sessionId,
        Number(durationMs || 5000),
      );
      if (gameState) {
        broadcastSession(sessionId, "game_state_changed", { gameState });
        scheduleGameStart(sessionId, gameState.countdownEndsAt);
      }
    });

    socket.on("submit_game_result", ({ sessionId, result }) => {
      const activeSession = lessonSessionService.getSession(sessionId);
      if (!isStudentSessionParticipant(actor, activeSession)) {
        rejectForbidden("submit_game_result");
        return;
      }
      const submitted = lessonSessionService.submitGameResult(
        sessionId,
        actor.userId,
        result || {},
      );
      if (!submitted) return;

      if (submitted.accepted && !submitted.session.isDemo) {
        dbWriter.persistAnswer({
          sessionId: submitted.session.currentDbSessionId || sessionId,
          studentId: actor.userId,
          phase: submitted.session.currentPhase,
          answerText: JSON.stringify(result || {}),
          // The score has already been bounded by LessonSessionService. Keep
          // the answer unverified, but persist the lesson points so the
          // student's history and final score match the live leaderboard.
          isCorrect: null,
          score: submitted.gameState.results[actor.userId]?.score || 0,
          questionText: submitted.gameState.selectedGameId || "Lesson game",
          correctAnswer: "",
        });
      }

      broadcastSession(sessionId, "game_results_updated", { gameState: submitted.gameState });
      broadcastSession(sessionId, "participants_updated", {
        participants: Array.from(submitted.session.participants.values()),
      });
      broadcastToTutor(submitted.session, "participant_answered", {
        studentId: actor.userId,
        totalAnswered: Object.keys(submitted.gameState.results).length,
        totalParticipants: submitted.session.participants.size,
      });
      if (submitted.allSubmitted) {
        broadcastSession(sessionId, "all_answered_broadcast", {
          totalParticipants: submitted.session.participants.size,
        });
      }
    });

    socket.on("sync_active_sentence", ({ sessionId, index }) => {
      const activeSession = lessonSessionService.getSession(sessionId);
      if (!isTutorSessionOwner(actor, socket.id, activeSession)) {
        rejectForbidden("sync_active_sentence");
        return;
      }

      const session = lessonSessionService.syncActiveSentence(sessionId, index);
      if (session) {
        broadcastSession(sessionId, "active_sentence_synced", {
          activeSentenceIndex: index,
        });
      }
    });

    socket.on("end_question", ({ sessionId }) => {
      const activeSession = lessonSessionService.getSession(sessionId);
      if (!isTutorSessionOwner(actor, socket.id, activeSession)) {
        rejectForbidden("end_question");
        return;
      }

      const result = lessonSessionService.endQuestion(sessionId);
      if (result) {
        broadcastToTutor(result.session, "question_ended", {
          answers: result.answers,
          totalAnswered: result.answers.length,
          totalParticipants: result.session.participants.size,
        });
        broadcastSession(sessionId, "all_answered_broadcast", {
          totalParticipants: result.session.participants.size,
        });
        logger.info(
          `[Socket] Tutor ended question in session ${sessionId} phase ${result.session.currentPhase} with ${result.answers.length}/${result.session.participants.size} answers`,
        );
      }
    });

    // Student submits answer
    socket.on("submit_answer", async ({ sessionId, answer, question, expectedAnswer }) => {
      const authorizedSession = lessonSessionService.getSession(sessionId);
      if (!isStudentSessionParticipant(actor, authorizedSession)) {
        rejectForbidden("submit_answer");
        return;
      }

      const studentId = actor.userId;
      if (authorizedSession?.participants.get(studentId)?.hasAnsweredCurrentPhase) {
        socket.emit("answer_received", {
          success: false,
          code: "ANSWER_ALREADY_SUBMITTED",
        });
        return;
      }
      const session = lessonSessionService.getSession(sessionId);
      if (!session) return;

      // AI-evaluated phases: 9=Guided Response, 14=Guided Writing,
      // 16=teacher-mediated language questions.  Validate and reserve the
      // answer before any provider call so duplicate socket events cannot fan
      // out into duplicate Gemini requests.
      const isAiPhase = session.currentPhase === 9 || session.currentPhase === 14 || session.currentPhase === 16;
      let evaluatedAnswer = answer;
      let result: ReturnType<typeof lessonSessionService.submitAnswer>;
      let aiRequestKey: string | undefined;

      if (isAiPhase) {
        if (typeof answer !== "string") {
          socket.emit("answer_received", { success: false, code: "INVALID_ANSWER" });
          return;
        }

        const maxAnswerLength = session.currentPhase === 14 ? 8000 : 4000;
        const questionText = typeof question === "string" ? question : "";
        const expectedText = typeof expectedAnswer === "string" ? expectedAnswer : "";
        if (
          answer.length > maxAnswerLength ||
          questionText.length > 4000 ||
          expectedText.length > 4000
        ) {
          socket.emit("answer_received", { success: false, code: "ANSWER_TOO_LONG" });
          return;
        }

        const shouldCallProvider = session.currentPhase !== 16 || answer.trim().length > 0;
        aiRequestKey = `${studentId}:${sessionId}:${session.currentPhase}`;
        if (shouldCallProvider) {
          const slot = acquireAiSlot(studentId, aiRequestKey);
          if (!slot.ok) {
            socket.emit("answer_received", { success: false, code: slot.code });
            return;
          }
        }

        const reservation = lessonSessionService.reserveAnswer(sessionId, studentId);
        if (!reservation || !reservation.accepted) {
          if (shouldCallProvider && aiRequestKey) releaseAiSlot(studentId, aiRequestKey);
          socket.emit("answer_received", {
            success: false,
            code: "ANSWER_ALREADY_SUBMITTED",
          });
          return;
        }

        try {
          if (session.currentPhase === 9 || session.currentPhase === 14) {
            const aiResult = session.currentPhase === 14
              ? await evaluateWriting(questionText, answer)
              : await evaluateShortAnswer(questionText, expectedText, answer);
            evaluatedAnswer = {
              text: answer,
              aiScore: aiResult.score,
              aiFeedback: aiResult.feedback,
              aiVerified: aiResult.verified,
            };
            socket.emit("ai_evaluation_result", evaluatedAnswer);
          } else {
            const text = answer.trim();
            if (!text) {
              evaluatedAnswer = { text: "", languageAnswer: "" };
            } else {
              const articleContext = [session.articleData?.title, session.articleData?.passage]
                .filter(Boolean)
                .join("\n\n");
              const ai = await answerLanguageQuestion(text, articleContext);
              evaluatedAnswer = { text: answer, languageAnswer: ai.answer };
              socket.emit("language_answer_result", { question: answer, answer: ai.answer });
            }
          }
        } catch (error) {
          // Provider wrappers normally fail closed themselves, but the socket
          // path must also preserve the reservation if a wrapper throws.
          logger.error("[Socket] AI answer evaluation failed:", error);
          evaluatedAnswer = {
            text: answer,
            aiScore: 0,
            aiFeedback: "ยังยืนยันคะแนนไม่ได้ เนื่องจากระบบตรวจอัตโนมัติขัดข้องชั่วคราว",
            aiVerified: false,
          };
        } finally {
          if (shouldCallProvider && aiRequestKey) releaseAiSlot(studentId, aiRequestKey);
        }

        result = lessonSessionService.completeReservedAnswer(sessionId, studentId, evaluatedAnswer);
      } else {
        result = lessonSessionService.submitAnswer(sessionId, studentId, evaluatedAnswer);
      }

      if (result) {
        if (!result.accepted) {
          socket.emit("answer_received", {
            success: false,
            code: "ANSWER_ALREADY_SUBMITTED",
          });
          return;
        }
        // Update participant's total score
        const participant = result.session.participants.get(studentId);
        if (participant) {
          if (result.session.currentPhase === 9 || result.session.currentPhase === 14) {
            // Guided Response (9) / Guided Writing (14) with AI score
            participant.score = (participant.score || 0) + (evaluatedAnswer.aiScore || 0);

            // --- PERSIST DB ANSWER (AI-SCORED) ---
            dbWriter.persistAnswer({
              sessionId: result.session.currentDbSessionId || sessionId,
              studentId,
              phase: result.session.currentPhase,
              answerText: String(answer),
              isCorrect: evaluatedAnswer.aiVerified === true && (evaluatedAnswer.aiScore || 0) > 0,
              score: evaluatedAnswer.aiScore || 0,
              aiFeedback: evaluatedAnswer.aiFeedback,
              questionText: question,
              correctAnswer: expectedAnswer
            });
          } else if (result.session.currentPhase === 16) {
            // Language Questions: participation point, store question + AI answer
            participant.score = (participant.score || 0) + 1;

            dbWriter.persistAnswer({
              sessionId: result.session.currentDbSessionId || sessionId,
              studentId,
              phase: result.session.currentPhase,
              answerText: String(answer),
              isCorrect: true,
              score: 1,
              aiFeedback: evaluatedAnswer.languageAnswer,
              questionText: "Language question",
              correctAnswer: ""
            });
          } else if (result.session.currentPhase === 17) {
            // Lesson Reflection: store ratings, no competitive score
            dbWriter.persistAnswer({
              sessionId: result.session.currentDbSessionId || sessionId,
              studentId,
              phase: result.session.currentPhase,
              answerText: String(answer),
              isCorrect: true,
              score: 0,
              questionText: "Lesson reflection",
              correctAnswer: ""
            });
          } else {
            let correctLabel = "";
            let resolvedAnswerText = String(answer);
            const choiceIdx = String(answer).trim().toUpperCase().charCodeAt(0) - 65; // A=0, B=1, C=2, D=3

            if (result.session.currentPhase === 3) {
              // Vocabulary Flashcards: the student submits after rating every card.
              const payload = typeof answer === "string" ? answer : JSON.stringify(answer);
              resolvedAnswerText = payload;
              correctLabel = "FLASHCARD_COMPLETE";
            } else if (result.session.currentPhase === 8) {
              // Comprehension Check / MCQ (Step 7)
              const idx = result.session.phaseSelectedIndices?.[8] || 0;
              const mcqQuestion = result.session.articleData?.multipleChoiceQuestions?.[idx];
              if (mcqQuestion) {
                const rawAnswer = mcqQuestion.answer || '';
                const optionsData = mcqQuestion.options || {};
                const optionKeys = Object.keys(optionsData).sort();
                
                let answerIdx = -1;
                // Match logic mirroring frontend precisely
                optionKeys.forEach((k, i) => {
                  if (String(optionsData[k]) === String(rawAnswer)) {
                    answerIdx = i;
                  }
                });

                // Fallback: match keys themselves or index strings
                if (answerIdx === -1) {
                  const i = optionKeys.indexOf(rawAnswer);
                  if (i !== -1) {
                    answerIdx = i;
                  } else {
                    const labelIdx = String(rawAnswer).charCodeAt(0) - 65;
                    if (labelIdx >= 0 && labelIdx < optionKeys.length) {
                      answerIdx = labelIdx;
                    }
                  }
                }

                const rawOptions = optionKeys.map(key => optionsData[key]);
                const correctOptionText = answerIdx !== -1 ? rawOptions[answerIdx] : rawAnswer;

                // Apply matching deterministic shuffle derived from session + question
                const shuffledOptions = seededShuffle(rawOptions, sessionId + "_phase8_" + mcqQuestion.question);
                
                const newCorrectIdx = shuffledOptions.indexOf(correctOptionText);
                if (newCorrectIdx !== -1) {
                  correctLabel = String.fromCharCode(65 + newCorrectIdx);
                } else if (['A','B','C','D'].includes(String(rawAnswer).toUpperCase())) {
                  correctLabel = String(rawAnswer).toUpperCase(); // fallback
                }
                
                // Resolve chosen text value based on user's submitted index
                if (choiceIdx >= 0 && choiceIdx < shuffledOptions.length) {
                  resolvedAnswerText = shuffledOptions[choiceIdx] || String(answer);
                }
              }
            } else if (result.session.currentPhase === 10) {
              // Vocabulary Practice (Step 9)
              const words = result.session.articleData?.words || [];
              const idx = result.session.phaseSelectedIndices?.[10] || 0;
              const targetWord = words[idx] || words[0];
              if (targetWord) {
                const correctTranslation = targetWord.definition?.th || targetWord.translation || "ความหมายที่ถูกต้อง";
                const distractorWords = words.filter((_w: any, i: number) => i !== idx);

                const usedTranslations = new Set<string>([correctTranslation]);
                const optionsArray: string[] = [correctTranslation];

                distractorWords.forEach((w: any) => {
                  const trans = w?.definition?.th || w?.translation;
                  if (trans && !usedTranslations.has(trans) && optionsArray.length < 4) {
                    usedTranslations.add(trans);
                    optionsArray.push(trans);
                  }
                });

                let fillCounter = 1;
                while (optionsArray.length < 4) {
                  const fb = `ความหมายอื่น ${String.fromCharCode(65 + fillCounter)}`;
                  if (!usedTranslations.has(fb)) {
                    usedTranslations.add(fb);
                    optionsArray.push(fb);
                  }
                  fillCounter++;
                }

                const shuffledOptions = seededShuffle(optionsArray, sessionId + "_phase10_" + (targetWord.vocabulary || targetWord.word));

                const newCorrectIdx = shuffledOptions.indexOf(correctTranslation);
                if (newCorrectIdx !== -1) {
                  correctLabel = String.fromCharCode(65 + newCorrectIdx);
                }

                // Resolve chosen text value
                if (choiceIdx >= 0 && choiceIdx < shuffledOptions.length) {
                  resolvedAnswerText = shuffledOptions[choiceIdx];
                }
              }
            } else if (result.session.currentPhase === 12) {
              // Sentence Practice — fill in the blank (Step 10a)
              const sentences = result.session.articleData?.sentences || [];
              const idx = result.session.phaseSelectedIndices?.[12] || 0;
              const targetSentence = typeof sentences[idx] === 'object' ? sentences[idx].sentences : sentences[idx];
              if (targetSentence) {
                const words = String(targetSentence).split(' ');
                const correctWord = words[words.length - 1].replace(/[.,!?]/g, '');
                const vocabWords = result.session.articleData?.words?.map((w: any) => w.vocabulary || w.word || w.text) || ["Apple", "Banana", "Cat"];
                const distractors = vocabWords.filter((w: string) => w.toLowerCase() !== correctWord.toLowerCase());
                
                const optionsArray = [correctWord, distractors[0] || "Word A", distractors[1] || "Word B", distractors[2] || "Word C"];
                
                const shuffledOptions = seededShuffle(optionsArray, sessionId + "_phase12_" + targetSentence);
                
                const newCorrectIdx = shuffledOptions.indexOf(correctWord);
                if (newCorrectIdx !== -1) {
                  correctLabel = String.fromCharCode(65 + newCorrectIdx);
                }

                // Resolve chosen text value
                if (choiceIdx >= 0 && choiceIdx < shuffledOptions.length) {
                  resolvedAnswerText = shuffledOptions[choiceIdx];
                }
              }
            } else if (result.session.currentPhase === 13) {
              // Sentence Practice — put words in order (Step 10b)
              const sentences = result.session.articleData?.sentences || [];
              const idx = result.session.phaseSelectedIndices?.[13] || 0;
              const targetSentence = typeof sentences[idx] === 'object' ? sentences[idx].sentences : sentences[idx];
              if (targetSentence) {
                const words = String(targetSentence).split(' ').filter((w: any) => String(w).trim().length > 0);
                const optA = [...words]; optA.push(optA.shift()!);
                const optB = [...words]; optB.unshift(optB.pop()!);
                const optC = [...words].reverse();
                
                const optionsArray = [targetSentence, optA.join(' '), optB.join(' '), optC.join(' ')];
                
                const shuffledOptions = seededShuffle(optionsArray, sessionId + "_phase13b_" + targetSentence);
                
                const newCorrectIdx = shuffledOptions.indexOf(targetSentence);
                if (newCorrectIdx !== -1) {
                  correctLabel = String.fromCharCode(65 + newCorrectIdx);
                }

                // Resolve chosen text value
                if (choiceIdx >= 0 && choiceIdx < shuffledOptions.length) {
                  resolvedAnswerText = shuffledOptions[choiceIdx];
                }
              }
            }

            const isCorrect = result.session.currentPhase === 3
              ? true
              : String(answer).trim().toUpperCase() === correctLabel.trim().toUpperCase();
            if (isCorrect) {
              participant.score = (participant.score || 0) + 1;
            }

            // Add visual prefix indicator
            const finalStoredAnswer = `ตัวเลือก ${String(answer).toUpperCase()}: ${resolvedAnswerText}`;

            // --- PERSIST DB ANSWER (NON-SHORT ANSWER) ---
            dbWriter.persistAnswer({
              sessionId: result.session.currentDbSessionId || sessionId,
              studentId,
              phase: result.session.currentPhase,
              answerText: finalStoredAnswer,
              isCorrect: isCorrect,
              score: isCorrect ? 1 : 0,
              questionText: question,
              correctAnswer: expectedAnswer // Received in event params
            });
          }
        }

        // Confirm submission to the student
        socket.emit("answer_received", { success: true });

        // Broadcast the participants' updated scores to everyone instantly
        broadcastSession(result.session.sessionId, "participants_updated", {
          participants: Array.from(result.session.participants.values())
        });

        // Update Tutor with the answer
        broadcastToTutor(result.session, "participant_answered", {
          studentId,
          totalAnswered: Array.from(result.session.participants.values()).filter(p => p.hasAnsweredCurrentPhase).length,
          totalParticipants: result.session.participants.size
        });

        // Check if all answered
        if (result.allAnswered) {
          const answers = Array.from(result.session.participants.values()).map(p => ({
            studentId: p.studentId,
            answer: p.latestAnswer
          }));

          // Notify Tutor with details
          broadcastToTutor(result.session, "all_answered", { answers });

          // Notify Everyone that "All Answered"
          broadcastSession(sessionId, "all_answered_broadcast", {
            totalParticipants: result.session.participants.size 
          });

          logger.info(`[Socket] All participants answered in session ${sessionId} phase ${result.session.currentPhase}`);
        }
      }
    });

    // Student toggles a sentence flag during Step 3 (Read the Article) to ask the tutor about pronunciation
    socket.on("flag_sentence", ({ sessionId, sentenceIndex }) => {
      const activeSession = lessonSessionService.getSession(sessionId);
      if (!isStudentSessionParticipant(actor, activeSession)) {
        rejectForbidden("flag_sentence");
        return;
      }

      const studentId = actor.userId;
      const result = lessonSessionService.toggleSentenceFlag(sessionId, studentId, sentenceIndex);
      if (result) {
        const flagCounts = lessonSessionService.getFlagCounts(result.session);
        // Broadcast updated counts to the whole room (tutor highlights, students sync their own state)
        broadcastSession(result.session.sessionId, "flags_updated", { flagCounts });
      }
    });

    // Tutor nudges a student to get ready
    socket.on("nudge_student", ({ sessionId, studentId }) => {
      const session = lessonSessionService.getSession(sessionId);
      if (!isTutorSessionOwner(actor, socket.id, session)) {
        rejectForbidden("nudge_student");
        return;
      }

      if (session) {
        const participant = session.participants.get(studentId);
        if (participant) {
          io.to(participant.socketId).emit("nudge_received", { message: "คุณครูกำลังรอคุณอยู่... กด Ready หน่อยครับ!" });
          logger.info(`Tutor nudged student ${studentId}`);
        }
      }
    });

    // Tutor kicks a student
    socket.on("kick_student", ({ sessionId, studentId }) => {
      const session = lessonSessionService.getSession(sessionId);
      if (!isTutorSessionOwner(actor, socket.id, session)) {
        rejectForbidden("kick_student");
        return;
      }

      if (session) {
        const participant = session.participants.get(studentId);
        if (participant) {
          io.to(participant.socketId).emit("kicked", { message: "คุณถูกเชิญออกจากห้องเรียนโดยติวเตอร์" });
          session.participants.delete(studentId);
          broadcastSession(sessionId, "participants_updated", {
            participants: Array.from(session.participants.values())
          });
          logger.info(`Tutor kicked student ${studentId}`);
        }
      }
    });

    // Tutor deletes session
    socket.on("delete_session", async ({ sessionId }) => {
      const session = lessonSessionService.getSession(sessionId);
      if (!isTutorSessionOwner(actor, socket.id, session)) {
        rejectForbidden("delete_session");
        return;
      }

      if (session) {
        broadcastSession(sessionId, "session_deleted", { message: "เซสชันถูกยกเลิกโดยคุณครู" });
        stopSessionHeartbeat(sessionId);
        await dbWriter.releaseActiveSession(session.classId, sessionId);
        if (!session.isDemo) {
          await dbWriter.updateSessionStatus(session.currentDbSessionId || sessionId, "CANCELLED");
        }
        lessonSessionService.deleteSession(sessionId);
        logger.info(`[Socket] Session ${sessionId} deleted by tutor`);
      }
    });

    // Tutor finishes the lesson and leaves the teaching screen. This is
    // intentionally separate from delete_session: closing/cancelling a room
    // must not mark its DB history as completed, while a completed lesson
    // should remain visible in student history even after the live session is
    // removed from memory.
    socket.on("finish_session", async ({ sessionId }, acknowledge?: (result: { ok: boolean }) => void) => {
      const session = lessonSessionService.getSession(sessionId);
      if (!isTutorSessionOwner(actor, socket.id, session)) {
        rejectForbidden("finish_session");
        acknowledge?.({ ok: false });
        return;
      }

      if (!session) {
        acknowledge?.({ ok: false });
        return;
      }

      if (!session.isDemo) {
        await dbWriter.updateSessionStatus(session.currentDbSessionId || sessionId, "FINISHED");
      }

      broadcastSession(sessionId, "session_deleted", { message: "บทเรียนจบแล้ว ขอบคุณที่เข้าร่วมเรียนครับ" });
      stopSessionHeartbeat(sessionId);
      await dbWriter.releaseActiveSession(session.classId, sessionId);
      lessonSessionService.deleteSession(sessionId);
      acknowledge?.({ ok: true });
      logger.info(`[Socket] Session ${sessionId} finished by tutor`);
    });

    socket.on("disconnect", () => {
      const tutorSession = lessonSessionService.getSessionByTutorSocketId(socket.id);

      if (tutorSession) {
        const { sessionId } = tutorSession;
        logger.info(`[Socket] Tutor disconnect detected for: ${socket.id}. Session ${sessionId} will close if tutor does not reconnect.`);

        setTimeout(async () => {
          const latestSession = lessonSessionService.getSession(sessionId);
          if (latestSession?.tutorSocketId !== socket.id) {
            return;
          }

          broadcastSession(sessionId, "session_deleted", { message: "à¹€à¸‹à¸ªà¸Šà¸±à¸™à¸–à¸¹à¸à¸¢à¸à¹€à¸¥à¸´à¸à¹‚à¸”à¸¢à¸„à¸¸à¸“à¸„à¸£à¸¹" });
          stopSessionHeartbeat(sessionId);
          await dbWriter.releaseActiveSession(latestSession.classId, sessionId);
          if (!latestSession.isDemo) {
            await dbWriter.updateSessionStatus(latestSession.currentDbSessionId || sessionId, "CANCELLED");
          }
          lessonSessionService.deleteSession(sessionId);
          logger.info(`[Socket] Session ${sessionId} deleted after tutor disconnect grace period`);
        }, 15000);

        return;
      }

      logger.info(`[Socket] Disconnect detected for: ${socket.id}. Session state is preserved for auto-recovery.`);
    });
  });
};
