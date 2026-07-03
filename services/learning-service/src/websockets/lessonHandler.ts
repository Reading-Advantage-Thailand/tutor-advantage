import { getJwtSecret, logger } from "@tutor-advantage/shared-config";
import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { lessonSessionService } from "../services/LessonSessionService";
import { evaluateShortAnswer, evaluateWriting, answerLanguageQuestion } from "../services/AIEvaluator";
import { getArticleDetails } from "../services/ReadingAdvantageDB";
import { getDemoArticle } from "../services/demoLessons";
import * as dbWriter from "../services/SessionDBWriter";
import { LineNotificationService } from "../services/LineNotificationService";
import { checkAndUnlockBadges } from "../services/BadgeService";
import { prisma } from "@tutor-advantage/database";
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
  // Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }
    
    try {
      socket.data.actor = verifySocketActor(String(token), getJwtSecret());
      next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid or expired token"));
    }
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
      try {
        const ownedClass = classId
          ? await prisma.class.findFirst({
              where: { classId, tutorUserId: tutorId },
              select: {
                classId: true,
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
            articleData: demoSession.articleData,
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

        if (classId && (!resolvedCycleId || !resolvedBookId)) {
          const cycle = resolvedCycleId
            ? await prisma.classBookCycle.findFirst({
                where: { classBookCycleId: resolvedCycleId, classId },
              })
            : await prisma.classBookCycle.findFirst({
                where: { classId, status: "OPEN" },
                orderBy: { sequence: "desc" },
              });

          resolvedCycleId = cycle?.classBookCycleId || resolvedCycleId;
          resolvedBookId = cycle?.bookId || resolvedBookId;
        }

        const articleData = await getArticleDetails(resolvedArticleId);
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
        );
        // Keep currentDbSessionId undefined initially, so the first cycle defaults to the standard sessionId!
        socket.join(session.sessionId);

        // PERSIST START OF SESSION TO DB (This creates initial Cycle 1 record)
        dbWriter.persistSessionStart(session.sessionId, tutorId, resolvedArticleId, classId, resolvedCycleId, resolvedBookId);

        socket.emit("session_created", {
          sessionId: session.sessionId,
          currentPhase: session.currentPhase,
          articleData: session.articleData
        });
        logger.info(`[Socket] Session created: ${session.sessionId} for class ${classId}`);
      } catch (error_err) {
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

      const activeSession = lessonSessionService.getSessionByClassId(classId);
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
          currentPhase: session.currentPhase,
          articleData: session.articleData,
          phaseSelectedIndices: session.phaseSelectedIndices,
          // Reconnecting mid Pair Conversation still shows the student's pair
          pairs: session.currentPhase === 15 ? lessonSessionService.getPairsPayload(session) : null,
        });
        
        io.to(session.sessionId).emit("participants_updated", {
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
        io.to(session.sessionId).emit("participants_updated", {
          participants: Array.from(session.participants.values())
        });
      }
    });

    // Tutor changes phase
    socket.on("change_phase", ({ sessionId, phase }) => {
      const authorizedSession = lessonSessionService.getSession(sessionId);
      if (!isTutorSessionOwner(actor, socket.id, authorizedSession)) {
        rejectForbidden("change_phase");
        return;
      }

      const session = lessonSessionService.setPhase(sessionId, phase);
      if (session) {
        // --- CRITICAL: DYNAMIC RESTART RECORDING ---
        // If starting a new instructional cycle (Phase 0 -> Phase 1), determine if we need a FRESH DB identity.
        // Demo sessions skip all persistence — they only loop the in-memory phase state.
        if (phase === 1 && !session.isDemo) {
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
            dbWriter.persistSessionStart(
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
               dbWriter.persistSessionParticipant(newDbId, pId);
            }
          }
        }

        // Broadcast new phase to everyone in the room.
        // Phase 15 (Pair Conversation) carries the freshly generated pairs.
        io.to(sessionId).emit("phase_changed", {
          phase,
          phaseSelectedIndices: session.phaseSelectedIndices,
          pairs: phase === 15 ? lessonSessionService.getPairsPayload(session) : null,
        });
        io.to(sessionId).emit("participants_updated", {
          participants: Array.from(session.participants.values())
        });
        logger.info(`Session ${sessionId} changed to phase ${phase}`);

        // If changing to phase 16 (Wrap-up Leaderboard), mark ACTIVE DB ROUND as FINISHED
        // Demo sessions have no DB round, no badges to unlock, and no students to notify.
        if (phase === 16 && !session.isDemo) {
          dbWriter.updateSessionStatus(session.currentDbSessionId || sessionId, "FINISHED");

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
        io.to(sessionId).emit("active_sentence_synced", {
          activeSentenceIndex: index,
        });
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
      // AI-evaluated phases: 8=Guided Response (short answer), 12=Guided Writing
      let evaluatedAnswer = answer;
      const session = lessonSessionService.getSession(sessionId);
      if (session && (session.currentPhase === 8 || session.currentPhase === 12)) {
         const aiResult = session.currentPhase === 12
           ? await evaluateWriting(question, answer)
           : await evaluateShortAnswer(question, expectedAnswer, answer);
         evaluatedAnswer = {
           text: answer,
           aiScore: aiResult.score,
           aiFeedback: aiResult.feedback
         };
         // send personal result immediately back to student
         socket.emit("ai_evaluation_result", evaluatedAnswer);
      } else if (session && session.currentPhase === 13) {
         // Language Questions (Step 12): teacher-mediated AI answer.
         // Empty answer = student skipped (no question) — count as answered, no AI call.
         const text = typeof answer === 'string' ? answer.trim() : '';
         if (!text) {
           evaluatedAnswer = { text: '', languageAnswer: '' };
         } else {
           const articleContext = [session.articleData?.title, session.articleData?.passage]
             .filter(Boolean)
             .join("\n\n");
           const ai = await answerLanguageQuestion(text, articleContext);
           evaluatedAnswer = { text: answer, languageAnswer: ai.answer };
           socket.emit("language_answer_result", { question: answer, answer: ai.answer });
         }
      }

      const result = lessonSessionService.submitAnswer(sessionId, studentId, evaluatedAnswer);
      if (result) {
        // Update participant's total score
        const participant = result.session.participants.get(studentId);
        if (participant) {
          if (result.session.currentPhase === 8 || result.session.currentPhase === 12) {
            // Guided Response (8) / Guided Writing (12) with AI score
            participant.score = (participant.score || 0) + (evaluatedAnswer.aiScore || 0);

            // --- PERSIST DB ANSWER (AI-SCORED) ---
            dbWriter.persistAnswer({
              sessionId: result.session.currentDbSessionId || sessionId,
              studentId,
              phase: result.session.currentPhase,
              answerText: String(answer),
              isCorrect: true, // Considered valid submission
              score: evaluatedAnswer.aiScore || 0,
              aiFeedback: evaluatedAnswer.aiFeedback,
              questionText: question,
              correctAnswer: expectedAnswer
            });
          } else if (result.session.currentPhase === 13) {
            // Language Questions (Step 12): participation point, store question + AI answer
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
          } else if (result.session.currentPhase === 14) {
            // Lesson Reflection (Step 13): store ratings, no competitive score
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

            if (result.session.currentPhase === 7) {
              // Comprehension Check / MCQ (Step 7)
              const idx = result.session.phaseSelectedIndices?.[7] || 0;
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
                const shuffledOptions = seededShuffle(rawOptions, sessionId + "_phase7_" + mcqQuestion.question);
                
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
            } else if (result.session.currentPhase === 9) {
              // Vocabulary Practice (Step 9)
              const words = result.session.articleData?.words || [];
              const idx = result.session.phaseSelectedIndices?.[9] || 0;
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
            } else if (result.session.currentPhase === 10) {
              // Sentence Practice — fill in the blank (Step 10a)
              const sentences = result.session.articleData?.sentences || [];
              const idx = result.session.phaseSelectedIndices?.[10] || 0;
              const targetSentence = typeof sentences[idx] === 'object' ? sentences[idx].sentences : sentences[idx];
              if (targetSentence) {
                const words = String(targetSentence).split(' ');
                const correctWord = words[words.length - 1].replace(/[.,!?]/g, '');
                const vocabWords = result.session.articleData?.words?.map((w: any) => w.vocabulary || w.word || w.text) || ["Apple", "Banana", "Cat"];
                const distractors = vocabWords.filter((w: string) => w.toLowerCase() !== correctWord.toLowerCase());
                
                const optionsArray = [correctWord, distractors[0] || "Word A", distractors[1] || "Word B", distractors[2] || "Word C"];
                
                const shuffledOptions = seededShuffle(optionsArray, sessionId + "_phase11_" + targetSentence);
                
                const newCorrectIdx = shuffledOptions.indexOf(correctWord);
                if (newCorrectIdx !== -1) {
                  correctLabel = String.fromCharCode(65 + newCorrectIdx);
                }

                // Resolve chosen text value
                if (choiceIdx >= 0 && choiceIdx < shuffledOptions.length) {
                  resolvedAnswerText = shuffledOptions[choiceIdx];
                }
              }
            } else if (result.session.currentPhase === 11) {
              // Sentence Practice — put words in order (Step 10b)
              const sentences = result.session.articleData?.sentences || [];
              const idx = result.session.phaseSelectedIndices?.[11] || 0;
              const targetSentence = typeof sentences[idx] === 'object' ? sentences[idx].sentences : sentences[idx];
              if (targetSentence) {
                const words = String(targetSentence).split(' ').filter((w: any) => String(w).trim().length > 0);
                const optA = [...words]; optA.push(optA.shift()!);
                const optB = [...words]; optB.unshift(optB.pop()!);
                const optC = [...words].reverse();
                
                const optionsArray = [targetSentence, optA.join(' '), optB.join(' '), optC.join(' ')];
                
                const shuffledOptions = seededShuffle(optionsArray, sessionId + "_phase12b_" + targetSentence);
                
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

            const isCorrect = String(answer).trim().toUpperCase() === correctLabel.trim().toUpperCase();
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
        io.to(result.session.sessionId).emit("participants_updated", {
          participants: Array.from(result.session.participants.values())
        });

        // Update Tutor with the answer
        const tutorSocketId = result.session.tutorSocketId;
        io.to(tutorSocketId).emit("participant_answered", {
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
          io.to(tutorSocketId).emit("all_answered", { answers });

          // Notify Everyone that "All Answered"
          io.to(sessionId).emit("all_answered_broadcast", { 
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
        io.to(result.session.sessionId).emit("flags_updated", { flagCounts });
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
          io.to(sessionId).emit("participants_updated", {
            participants: Array.from(session.participants.values())
          });
          logger.info(`Tutor kicked student ${studentId}`);
        }
      }
    });

    // Tutor deletes session
    socket.on("delete_session", ({ sessionId }) => {
      const session = lessonSessionService.getSession(sessionId);
      if (!isTutorSessionOwner(actor, socket.id, session)) {
        rejectForbidden("delete_session");
        return;
      }

      if (session) {
        io.to(sessionId).emit("session_deleted", { message: "เซสชันถูกยกเลิกโดยคุณครู" });
        lessonSessionService.deleteSession(sessionId);
        logger.info(`[Socket] Session ${sessionId} deleted by tutor`);
      }
    });

    socket.on("disconnect", () => {
      const tutorSession = lessonSessionService.getSessionByTutorSocketId(socket.id);

      if (tutorSession) {
        const { sessionId } = tutorSession;
        logger.info(`[Socket] Tutor disconnect detected for: ${socket.id}. Session ${sessionId} will close if tutor does not reconnect.`);

        setTimeout(() => {
          const latestSession = lessonSessionService.getSession(sessionId);
          if (latestSession?.tutorSocketId !== socket.id) {
            return;
          }

          io.to(sessionId).emit("session_deleted", { message: "à¹€à¸‹à¸ªà¸Šà¸±à¸™à¸–à¸¹à¸à¸¢à¸à¹€à¸¥à¸´à¸à¹‚à¸”à¸¢à¸„à¸¸à¸“à¸„à¸£à¸¹" });
          lessonSessionService.deleteSession(sessionId);
          logger.info(`[Socket] Session ${sessionId} deleted after tutor disconnect grace period`);
        }, 15000);

        return;
      }

      logger.info(`[Socket] Disconnect detected for: ${socket.id}. Session state is preserved for auto-recovery.`);
    });
  });
};
