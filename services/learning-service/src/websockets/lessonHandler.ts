import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import { lessonSessionService } from "../services/LessonSessionService";
import { evaluateShortAnswer } from "../services/AIEvaluator";
import { getArticleDetails } from "../services/ReadingAdvantageDB";
import * as dbWriter from "../services/SessionDBWriter";
import { LineNotificationService } from "../services/LineNotificationService";

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
      const secret = process.env.JWT_SECRET || "fallback_dev_secret";
      // Explicitly ignore verification in local dev if you want, but for security audit we MUST verify
      jwt.verify(token, secret);
      next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid or expired token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Tutor creates a new session
    socket.on("create_session", async ({ tutorId, articleId, classId }) => {
      console.log(`[Socket] Tutor ${tutorId} creating session for class: ${classId}`);
      try {
        const articleData = await getArticleDetails(articleId);
        console.log(`================= QUESTIONS LIST =================`);
        console.log(`Available MCQ questions:`, articleData?.multipleChoiceQuestions?.map((q: any) => q.question));
        console.log(`Available SAQ questions:`, articleData?.shortAnswerQuestions?.map((q: any) => q.question));
        console.log(`==================================================`);
        const session = lessonSessionService.createSession(tutorId, socket.id, articleId, articleData, classId);
        // Keep currentDbSessionId undefined initially, so the first cycle defaults to the standard sessionId!
        socket.join(session.sessionId);

        // PERSIST START OF SESSION TO DB (This creates initial Cycle 1 record)
        dbWriter.persistSessionStart(session.sessionId, tutorId, articleId, classId, session.pin);

        socket.emit("session_created", {
          sessionId: session.sessionId,
          pin: session.pin,
          currentPhase: session.currentPhase,
          articleData: session.articleData
        });
        console.log(`[Socket] Session created: ${session.sessionId} (PIN: ${session.pin}) for class ${classId}`);
      } catch (error: any) {
        console.error("[Socket] Error creating session:", error);
        socket.emit("error", { message: "Failed to create session. Please check database connection." });
      }
    });

    // Student joins a session using classId (No PIN needed)
    socket.on("join_class", ({ classId, studentId, name, pictureUrl }) => {
      console.log(`[Socket] Student ${name} (${studentId}) attempting to join class: ${classId}`);
      const session = lessonSessionService.joinSessionByClassId(classId, studentId, name, socket.id, pictureUrl);
      if (session) {
        socket.join(session.sessionId);
        socket.emit("join_success", {
          sessionId: session.sessionId,
          currentPhase: session.currentPhase,
          articleData: session.articleData
        });
        
        io.to(session.sessionId).emit("participants_updated", {
          participants: Array.from(session.participants.values())
        });
        console.log(`[Socket] Student ${name} joined class ${classId} successfully (Pic: ${!!pictureUrl})`);
        
        // PERSIST PARTICIPANT JOIN
        dbWriter.persistSessionParticipant(session.currentDbSessionId || session.sessionId, studentId);
      } else {
        console.warn(`[Socket] Join failed: No active session for class ${classId}`);
        socket.emit("error", { message: "ยังไม่มีคลาสที่เปิดสอนในขณะนี้ หรือคุณครูยังไม่ได้เริ่มเซสชัน" });
      }
    });

    // Toggle Ready status
    socket.on("toggle_ready", ({ sessionId, studentId }) => {
      console.log(`[Socket] Student ${studentId} toggled ready for session ${sessionId}`);
      const session = lessonSessionService.toggleReady(sessionId, studentId);
      if (session) {
        io.to(session.sessionId).emit("participants_updated", {
          participants: Array.from(session.participants.values())
        });
      }
    });

    // Student joins a session using PIN (Keep as fallback)
    socket.on("join_session", ({ pin, studentId, name, pictureUrl }) => {
      const session = lessonSessionService.joinSession(pin, studentId, name, socket.id, pictureUrl);
      if (session) {
        socket.join(session.sessionId);
        socket.emit("join_success", {
          sessionId: session.sessionId,
          currentPhase: session.currentPhase,
          articleData: session.articleData
        });
        
        io.to(session.sessionId).emit("participants_updated", {
          participants: Array.from(session.participants.values())
        });
        console.log(`Student ${name} joined session ${session.sessionId} (Pic: ${!!pictureUrl})`);
        
        // PERSIST PARTICIPANT JOIN
        dbWriter.persistSessionParticipant(session.currentDbSessionId || session.sessionId, studentId);
      } else {
        socket.emit("error", { message: "Invalid PIN or session not found" });
      }
    });

    // Tutor changes phase
    socket.on("change_phase", ({ sessionId, phase }) => {
      const session = lessonSessionService.setPhase(sessionId, phase);
      if (session) {
        // --- CRITICAL: DYNAMIC RESTART RECORDING ---
        // If starting a new instructional cycle (Phase 0 -> Phase 1), determine if we need a FRESH DB identity.
        if (phase === 1) {
          if (!session.currentDbSessionId) {
            // --- FIRST CYCLE ---
            // Set explicit key to lock current cycle, but reuse original initialized DB record to avoid double logging!
            session.currentDbSessionId = sessionId; 
            console.log(`[Socket] CYCLE 1: Initializing first loop using original session ${sessionId}`);
          } else {
            // --- RESTART CYCLES (2, 3+) ---
            // This generates a TOTALLY distinct row in student dashboard history while keeping same socket room!
            const newDbId = uuidv4();
            session.currentDbSessionId = newDbId; // Set explicit new key for this cycle
            console.log(`[Socket] RECYCLE: Starting fresh learning loop for room ${sessionId}. New DB Session: ${newDbId}`);
            
            // 1. Create NEW DB header record
            dbWriter.persistSessionStart(newDbId, session.tutorId, session.articleId, session.classId, session.pin);
            
            // 2. Automatically enroll all existing students in the NEW round immediately
            const activePeers = Array.from(session.participants.keys());
            for (const pId of activePeers) {
               dbWriter.persistSessionParticipant(newDbId, pId);
            }
          }
        }

        // Broadcast new phase to everyone in the room
        io.to(sessionId).emit("phase_changed", { phase, phaseSelectedIndices: session.phaseSelectedIndices });
        io.to(sessionId).emit("participants_updated", {
          participants: Array.from(session.participants.values())
        });
        console.log(`Session ${sessionId} changed to phase ${phase}`);

        // If changing to phase 14 (Finish/Leaderboard), mark ACTIVE DB ROUND as FINISHED
        if (phase === 14) {
          dbWriter.updateSessionStatus(session.currentDbSessionId || sessionId, "FINISHED");
          
          // Trigger LINE Notifications for final score
          (async () => {
            try {
              const articleTitle = session.articleData?.title || "บทเรียน";
              const studentList = Array.from(session.participants.values());
              
              for (const p of studentList) {
                 // Get final score in current context
                 const finalScore = p.score || 0;
                 const pushMsg = `🎉 จบคาบเรียนแล้ว!\n\nคุณได้คะแนนรวม ${finalScore} คะแนน จากบทเรียน "${articleTitle}" \n\nเข้าเช็คประวัติการเรียนและเฉลยคำตอบได้ที่ Student LIFF ครับ`;
                 
                 await LineNotificationService.sendToUser(p.studentId, pushMsg, { type: "notifyScoreUpdates" });
              }
            } catch (e) {
              console.error("[Socket] Failed to trigger score notification:", e);
            }
          })();
        }
      }
    });

    // Student submits answer
    socket.on("submit_answer", async ({ sessionId, studentId, answer, question, expectedAnswer }) => {
      // If it's a short answer, evaluate it
      let evaluatedAnswer = answer;
      const session = lessonSessionService.getSession(sessionId);
      if (session && (session.currentPhase === 8 || session.currentPhase === 13)) {
         // evaluate with AI
         const aiResult = await evaluateShortAnswer(question, expectedAnswer, answer);
         evaluatedAnswer = {
           text: answer,
           aiScore: aiResult.score,
           aiFeedback: aiResult.feedback
         };
         // send personal result immediately back to student
         socket.emit("ai_evaluation_result", evaluatedAnswer);
      }

      const result = lessonSessionService.submitAnswer(sessionId, studentId, evaluatedAnswer);
      if (result) {
        // Update participant's total score
        const participant = result.session.participants.get(studentId);
        if (participant) {
          if (result.session.currentPhase === 8 || result.session.currentPhase === 13) {
            participant.score = (participant.score || 0) + (evaluatedAnswer.aiScore || 0);
            
            // --- PERSIST DB ANSWER (SHORT ANSWER WITH AI) ---
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
          } else {
            let correctLabel = "";
            let resolvedAnswerText = String(answer);
            const choiceIdx = String(answer).trim().toUpperCase().charCodeAt(0) - 65; // A=0, B=1, C=2, D=3

            if (result.session.currentPhase === 7) {
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
            } else if (result.session.currentPhase === 10) {
              const words = result.session.articleData?.words || [];
              const idx = result.session.phaseSelectedIndices?.[10] || 0;
              const targetWord = words[idx] || words[0];
              if (targetWord) {
                const correctTranslation = targetWord.definition?.th || targetWord.translation || "ความหมายที่ถูกต้อง";
                const distractorWords = words.filter((w: any, i: number) => i !== idx);

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
            } else if (result.session.currentPhase === 11) {
              const sentences = result.session.articleData?.sentences || [];
              const idx = result.session.phaseSelectedIndices?.[11] || 0;
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
            } else if (result.session.currentPhase === 12) {
              const sentences = result.session.articleData?.sentences || [];
              const idx = result.session.phaseSelectedIndices?.[12] || 0;
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

          console.log(`[Socket] All participants answered in session ${sessionId} phase ${result.session.currentPhase}`);
        }
      }
    });

    // Tutor nudges a student to get ready
    socket.on("nudge_student", ({ sessionId, studentId }) => {
      const session = lessonSessionService.getSession(sessionId);
      if (session) {
        const participant = session.participants.get(studentId);
        if (participant) {
          io.to(participant.socketId).emit("nudge_received", { message: "คุณครูกำลังรอคุณอยู่... กด Ready หน่อยครับ!" });
          console.log(`Tutor nudged student ${studentId}`);
        }
      }
    });

    // Tutor kicks a student
    socket.on("kick_student", ({ sessionId, studentId }) => {
      const session = lessonSessionService.getSession(sessionId);
      if (session) {
        const participant = session.participants.get(studentId);
        if (participant) {
          io.to(participant.socketId).emit("kicked", { message: "คุณถูกเชิญออกจากห้องเรียนโดยติวเตอร์" });
          session.participants.delete(studentId);
          io.to(sessionId).emit("participants_updated", {
            participants: Array.from(session.participants.values())
          });
          console.log(`Tutor kicked student ${studentId}`);
        }
      }
    });

    // Tutor deletes session
    socket.on("delete_session", ({ sessionId }) => {
      const session = lessonSessionService.getSession(sessionId);
      if (session) {
        io.to(sessionId).emit("session_deleted", { message: "เซสชันถูกยกเลิกโดยคุณครู" });
        lessonSessionService.deleteSession(sessionId);
        console.log(`[Socket] Session ${sessionId} deleted by tutor`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Disconnect detected for: ${socket.id}. Session state is preserved for auto-recovery.`);
      
      // Inform other clients that a connection changed? Optional, but don't delete!
      // We skip automatic garbage collection on raw disconnects to maximize UX resilience.
      // Tutor can still manually 'Kick' a student if they are truly gone.
    });
  });
};
