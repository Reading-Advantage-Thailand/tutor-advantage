"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { AssessmentControl, LiveAssessmentState } from "@tutor-advantage/shared-config";

export function useLiveAssessment(socket: Socket | null, sessionId?: string, phase = 0) {
  const [state, setState] = useState<LiveAssessmentState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const revision = useRef(-1);
  const requestId = useRef(0);
  const appliedId = useRef(0);
  const mutationInFlight = useRef(false);
  const currentSession = useRef(sessionId);
  currentSession.current = sessionId;
  const request = useCallback((event: string, payload = {}): Promise<boolean> => new Promise(resolve => {
    if (event === "assessment_get" && mutationInFlight.current) { resolve(false); return; }
    const id = ++requestId.current;
    if (!socket?.connected || !sessionId) { setError("กำลังเชื่อมต่อห้องเรียน กรุณารอสักครู่"); resolve(false); return; }
    socket.timeout(8000).emit(event, { sessionId, ...payload }, (timeout: Error | null, result?: { ok: boolean; state?: LiveAssessmentState; message?: string }) => {
      if (currentSession.current !== sessionId) { resolve(false); return; }
      if (timeout || !result?.ok) { setError(result?.message || "การเชื่อมต่อสะดุด กรุณาลองอีกครั้ง"); resolve(false); return; }
      if (result.state && id >= appliedId.current && result.state.revision >= revision.current) { appliedId.current = id; revision.current = result.state.revision; setState(result.state); }
      setError(""); resolve(true);
    });
  }), [socket, sessionId]);
  useEffect(() => {
    revision.current = -1; setState(null); setError("");
    if (!socket || !sessionId || phase > 0) return;
    const refresh = () => { void request("assessment_get"); };
    refresh();
    socket.on("assessment_updated", refresh);
    // Reconcile missed notifications after transient disconnects / bus outages.
    const timer = setInterval(refresh, 5000);
    return () => { socket.off("assessment_updated", refresh); clearInterval(timer); };
  }, [socket, sessionId, phase, request]);
  const control = async (command: AssessmentControl) => {
    if (mutationInFlight.current) return false;
    mutationInFlight.current = true;
    setBusy(true);
    try { return await request("assessment_control", { control: command }); } finally { mutationInFlight.current = false; setBusy(false); }
  };
  const answer = async (questionId: string, choice: number) => {
    if (mutationInFlight.current) return false;
    mutationInFlight.current = true;
    setBusy(true);
    try { return await request("assessment_answer", { answer: { revision: state?.revision, questionId, choice } }); } finally { mutationInFlight.current = false; setBusy(false); }
  };
  return { state, error, busy, control, answer };
}
