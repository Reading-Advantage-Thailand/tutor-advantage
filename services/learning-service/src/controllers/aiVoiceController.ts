import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import {
  AiVoiceError,
  finalizeVoiceSession,
  getTutorVoiceSummary,
  getVoiceEntitlement,
  listStudentVoiceSessions,
  markVoiceSessionConnected,
  sendReadingIntent,
  startVoiceSession,
} from "../services/AiVoiceService";

function handleError(res: Response, error: unknown) {
  if (error instanceof AiVoiceError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Voice practice request failed" } });
}

export async function getEntitlement(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user?.userId || req.user.role !== "STUDENT") throw new AiVoiceError("FORBIDDEN", 403, "Student access required");
    res.status(200).json(await getVoiceEntitlement(req.user.userId, req.params.cycleId));
  } catch (error) { handleError(res, error); }
}

export async function createVoiceSession(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user?.userId || req.user.role !== "STUDENT") throw new AiVoiceError("FORBIDDEN", 403, "Student access required");
    const { articleId, sdp } = req.body as { articleId?: string; sdp?: string };
    if (!articleId || !sdp || sdp.length > 100_000 || !sdp.startsWith("v=0")) {
      res.status(400).json({ error: { code: "INVALID_VOICE_SESSION", message: "A valid articleId and WebRTC SDP are required" } });
      return;
    }
    res.status(201).json(await startVoiceSession(req.user.userId, req.params.cycleId, articleId, sdp));
  } catch (error) { handleError(res, error); }
}

export async function connectVoiceSession(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user?.userId || req.user.role !== "STUDENT") throw new AiVoiceError("FORBIDDEN", 403, "Student access required");
    res.status(200).json(await markVoiceSessionConnected(req.params.sessionId, req.user.userId));
  } catch (error) { handleError(res, error); }
}

export async function endVoiceSession(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user?.userId || req.user.role !== "STUDENT") throw new AiVoiceError("FORBIDDEN", 403, "Student access required");
    const session = await finalizeVoiceSession(req.params.sessionId, "USER_ENDED", {
      studentUserId: req.user.userId,
    });
    res.status(200).json({
      sessionId: session.voiceSessionId,
      status: session.status,
      consumedSeconds: session.consumedSeconds,
      summaryStatus: session.summary ? "READY" : "UNAVAILABLE",
      summary: session.summary,
      scores: session.scores,
    });
  } catch (error) { handleError(res, error); }
}

export async function submitReadingIntent(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user?.userId || req.user.role !== "STUDENT") throw new AiVoiceError("FORBIDDEN", 403, "Student access required");
    const action = (req.body as { action?: unknown })?.action;
    if (action !== "accept" && action !== "decline" && action !== "close") {
      res.status(400).json({ error: { code: "INVALID_READING_INTENT", message: "A supported reading action is required" } });
      return;
    }
    await sendReadingIntent(req.params.sessionId, req.user.userId, action);
    res.status(202).json({ accepted: true });
  } catch (error) { handleError(res, error); }
}

export async function getVoiceSessions(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user?.userId || req.user.role !== "STUDENT") throw new AiVoiceError("FORBIDDEN", 403, "Student access required");
    res.status(200).json({ sessions: await listStudentVoiceSessions(req.user.userId, req.params.cycleId) });
  } catch (error) { handleError(res, error); }
}

export async function getClassVoiceSummary(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user?.userId || req.user.role !== "TUTOR") throw new AiVoiceError("FORBIDDEN", 403, "Tutor access required");
    res.status(200).json({ sessions: await getTutorVoiceSummary(req.user.userId, req.params.classId) });
  } catch (error) { handleError(res, error); }
}
