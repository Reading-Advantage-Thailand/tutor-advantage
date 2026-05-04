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
        io.to(sessionId).emit("phase_changed", { phase });
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
        // Confirm submission to the student
        socket.emit("answer_received", { success: true });

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

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
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
