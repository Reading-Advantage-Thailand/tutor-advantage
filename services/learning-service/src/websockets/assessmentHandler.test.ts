import { beforeEach, describe, expect, it, vi } from "vitest";
const { getSession, snapshot, control, save } = vi.hoisted(() => ({ getSession: vi.fn(), snapshot: vi.fn(), control: vi.fn(), save: vi.fn() }));
vi.mock("../services/LessonSessionService", () => ({ lessonSessionService: { getSession } }));
vi.mock("../services/LiveAssessmentService", () => ({ assessmentSnapshot: snapshot, controlAssessment: control, saveAssessmentAnswer: save, LiveAssessmentError: class extends Error {} }));
import { setupAssessmentSocket } from "./assessmentHandler";
const session = { sessionId: "room", tutorId: "tutor", tutorSocketId: "tutor-socket", participants: new Map([["student", { socketId: "student-socket" }]]) };
function client(role: string, userId: string, socketId: string) {
  const handlers = new Map<string, (...args: any[]) => Promise<void>>();
  const socket = { id: socketId, connected: true, on: (event: string, fn: (...args: any[]) => Promise<void>) => handlers.set(event, fn) };
  const broadcast = vi.fn();
  setupAssessmentSocket(socket as never, { userId, role }, broadcast);
  return { broadcast, async send(event: string, input: unknown) { const ack = vi.fn(); await handlers.get(event)!(input, ack); return ack.mock.calls[0][0]; } };
}
describe("assessment room authorization", () => {
  beforeEach(() => { vi.resetAllMocks(); getSession.mockReturnValue(session); snapshot.mockResolvedValue({ revision: 1 }); });
  it("only the active owning tutor can start or finish", async () => {
    for (const peer of [client("STUDENT", "student", "student-socket"), client("TUTOR", "other", "other-socket"), client("TUTOR", "tutor", "old-socket")]) expect((await peer.send("assessment_control", { sessionId: "room", control: { action: "start" } })).ok).toBe(false);
    expect(control).not.toHaveBeenCalled();
    expect((await client("TUTOR", "tutor", "tutor-socket").send("assessment_control", { sessionId: "room", control: { action: "start" } })).ok).toBe(true);
  });
  it("rejects outsiders and disconnected/replaced student sockets", async () => {
    expect((await client("STUDENT", "other", "other-socket").send("assessment_get", { sessionId: "room" })).ok).toBe(false);
    expect((await client("STUDENT", "student", "old-socket").send("assessment_answer", { sessionId: "room" })).ok).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });
  it("derives answer ownership from the authenticated socket, not the payload", async () => {
    const peer = client("STUDENT", "student", "student-socket");
    await peer.send("assessment_answer", { sessionId: "room", studentId: "forged", answer: { questionId: "a-v1", choice: 0, revision: 1 } });
    expect(save).toHaveBeenCalledWith(session, "student", expect.anything());
    expect(snapshot).toHaveBeenCalledWith(session, "student");
    expect(peer.broadcast).toHaveBeenCalledWith("room", "assessment_updated", { sessionId: "room" });
  });
  it("does not broadcast private snapshots or accept teacher answers", async () => {
    const peer = client("TUTOR", "tutor", "tutor-socket");
    await peer.send("assessment_get", { sessionId: "room" });
    expect(snapshot).toHaveBeenCalledWith(session, undefined);
    expect(peer.broadcast).not.toHaveBeenCalled();
    expect((await peer.send("assessment_answer", { sessionId: "room" })).ok).toBe(false);
  });
});
