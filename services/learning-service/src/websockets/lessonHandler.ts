import { Server, Socket } from "socket.io";
import { lessonSessionService } from "../services/LessonSessionService";
import { evaluateShortAnswer } from "../services/AIEvaluator";
import { getArticleDetails } from "../services/ReadingAdvantageDB";

export const setupLessonSocket = (io: Server) => {
  io.on("connection", (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Tutor creates a new session
    socket.on("create_session", async ({ tutorId, articleId }) => {
      try {
        const articleData = await getArticleDetails(articleId);
        const session = lessonSessionService.createSession(tutorId, socket.id, articleId, articleData);
        socket.join(session.sessionId);
        socket.emit("session_created", {
          sessionId: session.sessionId,
          pin: session.pin,
          currentPhase: session.currentPhase,
          articleData: session.articleData
        });
        console.log(`Session created: ${session.sessionId} with PIN: ${session.pin}`);
      } catch (error) {
        console.error("Error creating session:", error);
        socket.emit("error", { message: "Failed to fetch article details" });
      }
    });

    // Student joins a session using PIN
    socket.on("join_session", ({ pin, studentId, name }) => {
      const session = lessonSessionService.joinSession(pin, studentId, name, socket.id);
      if (session) {
        socket.join(session.sessionId);
        // Send success to student
        socket.emit("join_success", {
          sessionId: session.sessionId,
          currentPhase: session.currentPhase,
          articleData: session.articleData
        });
        
        // Notify tutor (and others) that someone joined
        io.to(session.sessionId).emit("participant_joined", {
          participants: Array.from(session.participants.values())
        });
        console.log(`Student ${name} (${studentId}) joined session ${session.sessionId}`);
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
        // E.g. Tutor PWA updates the answered counter
        const tutorSocketId = result.session.tutorSocketId;
        io.to(tutorSocketId).emit("participant_answered", {
          studentId,
          totalAnswered: Array.from(result.session.participants.values()).filter(p => p.hasAnsweredCurrentPhase).length,
          totalParticipants: result.session.participants.size
        });

        // Check if all answered
        if (result.allAnswered) {
          // Tell Tutor PWA that all students have answered
          io.to(tutorSocketId).emit("all_answered", {
            answers: Array.from(result.session.participants.values()).map(p => ({
              studentId: p.studentId,
              answer: p.latestAnswer
            }))
          });
          console.log(`All participants answered in session ${sessionId} phase ${result.session.currentPhase}`);
        }
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
      const left = lessonSessionService.removeParticipantBySocketId(socket.id);
      if (left) {
        const session = lessonSessionService.getSession(left.sessionId);
        if (session) {
          io.to(left.sessionId).emit("participant_left", {
            studentId: left.studentId,
            participants: Array.from(session.participants.values())
          });
        }
      }
    });
  });
};
