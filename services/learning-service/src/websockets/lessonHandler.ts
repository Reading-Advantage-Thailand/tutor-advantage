import { Server, Socket } from "socket.io";
import { lessonSessionService } from "../services/LessonSessionService";
import { evaluateShortAnswer } from "../services/AIEvaluator";
import { getArticleDetails } from "../services/ReadingAdvantageDB";

export const setupLessonSocket = (io: Server) => {
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
        socket.join(session.sessionId);
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
      } else {
        socket.emit("error", { message: "Invalid PIN or session not found" });
      }
    });

    // Tutor changes phase
    socket.on("change_phase", ({ sessionId, phase }) => {
      const session = lessonSessionService.setPhase(sessionId, phase);
      if (session) {
        // Broadcast new phase to everyone in the room
        io.to(sessionId).emit("phase_changed", { phase, phaseSelectedIndices: session.phaseSelectedIndices });
        io.to(sessionId).emit("participants_updated", {
          participants: Array.from(session.participants.values())
        });
        console.log(`Session ${sessionId} changed to phase ${phase}`);
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
          } else {
            let correctLabel = "B"; // fallback
            if (result.session.currentPhase === 7) {
              const idx = result.session.phaseSelectedIndices?.[7] || 0;
              const mcqQuestion = result.session.articleData?.multipleChoiceQuestions?.[idx];
              if (mcqQuestion) {
                const rawAnswer = mcqQuestion.answer;
                const optionKeys = ['option1', 'option2', 'option3', 'option4'];
                const answerIdx = optionKeys.findIndex(k => mcqQuestion[k] === rawAnswer);
                if (answerIdx !== -1) {
                  correctLabel = String.fromCharCode(65 + answerIdx);
                } else if (['A','B','C','D'].includes(String(rawAnswer).toUpperCase())) {
                  correctLabel = String(rawAnswer).toUpperCase();
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

                const shuffledOptions = [...optionsArray];
                for (let i = shuffledOptions.length - 1; i > 0; i--) {
                  const j = Math.floor((i + 1) * 0.47) % (i + 1);
                  [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
                }

                const newCorrectIdx = shuffledOptions.indexOf(correctTranslation);
                if (newCorrectIdx !== -1) {
                  correctLabel = String.fromCharCode(65 + newCorrectIdx);
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
                const shuffledOptions = [...optionsArray];
                for (let i = shuffledOptions.length - 1; i > 0; i--) {
                  const j = Math.floor((i + 1) * 0.47) % (i + 1);
                  [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
                }
                const newCorrectIdx = shuffledOptions.indexOf(correctWord);
                if (newCorrectIdx !== -1) {
                  correctLabel = String.fromCharCode(65 + newCorrectIdx);
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
                const shuffledOptions = [...optionsArray];
                for (let i = shuffledOptions.length - 1; i > 0; i--) {
                  const j = Math.floor((i + 1) * 0.47) % (i + 1);
                  [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
                }
                const newCorrectIdx = shuffledOptions.indexOf(targetSentence);
                if (newCorrectIdx !== -1) {
                  correctLabel = String.fromCharCode(65 + newCorrectIdx);
                }
              }
            }

            const isCorrect = String(answer).trim().toUpperCase() === correctLabel.trim().toUpperCase();
            if (isCorrect) {
              participant.score = (participant.score || 0) + 1;
            }
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
      console.log(`Socket disconnected: ${socket.id}`);
      
      // 1. Check if the disconnected socket is a Tutor
      const tutorSession = lessonSessionService.getSessionByTutorSocketId(socket.id);
      if (tutorSession) {
        console.log(`[Socket] Tutor disconnected. Deleting session: ${tutorSession.sessionId}`);
        io.to(tutorSession.sessionId).emit("session_deleted", { message: "คุณครูได้ออกจากหน้าห้องเรียน คลาสเรียนถูกปิดแล้ว" });
        lessonSessionService.deleteSession(tutorSession.sessionId);
        return;
      }

      // 2. Otherwise, check if it is a student
      const left = lessonSessionService.removeParticipantBySocketId(socket.id);
      if (left) {
        const session = lessonSessionService.getSession(left.sessionId);
        if (session) {
          io.to(left.sessionId).emit("participants_updated", {
            participants: Array.from(session.participants.values())
          });
        }
      }
    });
  });
};
