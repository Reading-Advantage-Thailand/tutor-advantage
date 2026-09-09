import { Socket } from "socket.io";
import { logger } from "@tutor-advantage/shared-config";
import { lessonSessionService } from "../services/LessonSessionService";
import { assessmentSnapshot, controlAssessment, LiveAssessmentError, saveAssessmentAnswer } from "../services/LiveAssessmentService";
import { isStudentSessionParticipant, isTutorSessionOwner, SocketActor } from "./lessonAuthorization";

export function setupAssessmentSocket(socket: Socket, actor: SocketActor, broadcast: (sessionId: string, event: string, data: unknown) => void) {
  for (const event of ["assessment_get", "assessment_control", "assessment_answer"] as const) {
    socket.on(event, async (input: any, acknowledge?: (result: unknown) => void) => {
      if (typeof acknowledge !== "function") return;
      try {
        const session = lessonSessionService.getSession(input?.sessionId);
        const teacher = isTutorSessionOwner(actor, socket.id, session);
        const student = isStudentSessionParticipant(actor, session) && session?.participants.get(actor.userId)?.socketId === socket.id;
        if (!socket.connected || !session || (!teacher && !student) || (event === "assessment_control" && !teacher) || (event === "assessment_answer" && !student)) {
          acknowledge({ ok: false, message: "ไม่มีสิทธิ์ทำรายการในห้องนี้" }); return;
        }
        if (event === "assessment_control") await controlAssessment(session, input.control);
        if (event === "assessment_answer") await saveAssessmentAnswer(session, actor.userId, input.answer);
        const state = await assessmentSnapshot(session, student ? actor.userId : undefined);
        acknowledge({ ok: true, state });
        if (event !== "assessment_get") broadcast(session.sessionId, "assessment_updated", { sessionId: session.sessionId });
      } catch (error) {
        if (!(error instanceof LiveAssessmentError)) logger.error("Live assessment failed", error);
        acknowledge({ ok: false, message: error instanceof LiveAssessmentError ? error.message : "ระบบประเมินขัดข้อง กรุณาลองอีกครั้ง" });
      }
    });
  }
}
