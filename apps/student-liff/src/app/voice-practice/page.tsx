"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Mic, MicOff, PhoneOff, Sparkles, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { studentApi } from "@/lib/api";

type Entitlement = {
  enabled: boolean;
  totalSeconds: number;
  unlockedSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
  completedArticles: number;
  eligibleArticles: Array<{ articleId: string; title: string }>;
  activeSession?: { sessionId: string; expiresAt: string } | null;
};

type StartResult = {
  sessionId: string;
  answerSdp: string;
  expiresAt: string;
  reservedSeconds: number;
  remainingSeconds: number;
};

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

async function waitForIceGathering(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 3_000);
    const listener = () => {
      if (pc.iceGatheringState !== "complete") return;
      window.clearTimeout(timeout);
      pc.removeEventListener("icegatheringstatechange", listener);
      resolve();
    };
    pc.addEventListener("icegatheringstatechange", listener);
  });
}

function VoicePracticeContent() {
  const params = useSearchParams();
  const cycleId = params.get("cycleId") || "";
  const articleId = params.get("articleId") || "";
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [ending, setEnding] = useState(false);
  const [muted, setMuted] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [caption, setCaption] = useState("พร้อมเริ่มฝึกสนทนา");
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ summary?: unknown; scores?: unknown } | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionRef = useRef<StartResult | null>(null);
  const transcriptRef = useRef<string[]>([]);
  const endingRef = useRef(false);
  const analyserFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const selectedArticle = entitlement?.eligibleArticles.find((article) => article.articleId === articleId);

  const loadEntitlement = useCallback(async () => {
    if (!cycleId) {
      setError("ไม่พบข้อมูลสิทธิ์ของหนังสือ");
      setLoading(false);
      return;
    }
    try {
      const data = await studentApi.getVoiceEntitlement(cycleId) as Entitlement;
      setEntitlement(data);
      setRemaining(data.remainingSeconds);
    } catch {
      setError("โหลดสิทธิ์ฝึกสนทนาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  useEffect(() => { void loadEntitlement(); }, [loadEntitlement]);

  const cleanupMedia = useCallback(() => {
    if (analyserFrameRef.current !== null) cancelAnimationFrame(analyserFrameRef.current);
    analyserFrameRef.current = null;
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    channelRef.current?.close();
    channelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    setConnected(false);
    setVolume(0);
  }, []);

  const endSession = useCallback(async (reason = "USER_ENDED") => {
    if (endingRef.current) return;
    endingRef.current = true;
    setEnding(true);
    const active = sessionRef.current;
    const channel = channelRef.current;
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = false; });
    if (active && channel?.readyState === "open") {
      channel.send(JSON.stringify({
        type: "response.create",
        response: {
          output_modalities: ["text"],
          instructions: "End the practice now. Call submit_practice_summary exactly once with a concise Thai summary, strengths, improvements, practiced topics, and fair 0-5 scores.",
          tool_choice: { type: "function", name: "submit_practice_summary" },
        },
      }));
      await new Promise((resolve) => window.setTimeout(resolve, 2_500));
    }
    cleanupMedia();
    if (active) {
      try {
        const ended = await studentApi.endVoiceSession(active.sessionId, {
          transcript: transcriptRef.current.join("\n").slice(0, 20_000),
        }) as { summary?: unknown; scores?: unknown };
        setResult({ summary: ended.summary, scores: ended.scores });
        setCaption(reason === "QUOTA_REACHED" ? "ครบเวลาฝึกของรอบนี้แล้ว" : "จบการฝึกแล้ว");
        await loadEntitlement();
      } catch {
        setCaption("จบการเชื่อมต่อแล้ว ระบบจะปรับยอดเวลาให้อัตโนมัติ");
      }
    }
    sessionRef.current = null;
    setEnding(false);
  }, [cleanupMedia, loadEntitlement]);

  useEffect(() => {
    if (!connected || !sessionRef.current) return;
    const warningShown = new Set<number>();
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((new Date(sessionRef.current?.expiresAt || 0).getTime() - Date.now()) / 1000));
      setRemaining(seconds);
      if ((seconds === 60 || seconds === 15) && !warningShown.has(seconds)) {
        warningShown.add(seconds);
        toast.warning(`เหลือเวลาฝึก ${seconds} วินาที`);
      }
      if (seconds <= 0) {
        window.clearInterval(timer);
        void endSession("QUOTA_REACHED");
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [connected, endSession]);

  useEffect(() => () => {
    cleanupMedia();
    const active = sessionRef.current;
    if (active && !endingRef.current) void studentApi.endVoiceSession(active.sessionId);
  }, [cleanupMedia]);

  const startVolumeMeter = (stream: MediaStream) => {
    const context = new AudioContext();
    audioContextRef.current = context;
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    context.createMediaStreamSource(stream).connect(analyser);
    const values = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(values);
      setVolume(values.reduce((sum, value) => sum + value, 0) / values.length / 255);
      analyserFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const onRealtimeEvent = (event: MessageEvent<string>) => {
    try {
      const data = JSON.parse(event.data) as Record<string, unknown>;
      const type = String(data.type || "");
      if (type === "input_audio_buffer.speech_started") setCaption("กำลังฟังคุณพูด…");
      if (type === "input_audio_buffer.speech_stopped") setCaption("AI กำลังคิด…");
      if (type === "conversation.item.input_audio_transcription.completed" && typeof data.transcript === "string") {
        const text = data.transcript.trim();
        if (text) {
          transcriptRef.current.push(`Student: ${text}`);
          setCaption(text);
        }
      }
      if (type === "response.output_audio_transcript.done" && typeof data.transcript === "string") {
        const text = data.transcript.trim();
        if (text) {
          transcriptRef.current.push(`AI: ${text}`);
          setCaption(text);
        }
      }
      if (type === "error") setCaption("การสนทนาสะดุด กรุณาลองพูดอีกครั้ง");
    } catch {
      // Ignore malformed provider events; media can continue independently.
    }
  };

  const startSession = async () => {
    if (!cycleId || !articleId || starting || connected) return;
    setStarting(true);
    setError(null);
    setResult(null);
    transcriptRef.current = [];
    endingRef.current = false;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
        throw new Error("เบราว์เซอร์นี้ไม่รองรับการสนทนาด้วยเสียง");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      streamRef.current = stream;
      startVolumeMeter(stream);
      const pc = new RTCPeerConnection();
      peerRef.current = pc;
      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));
      pc.ontrack = (event) => {
        if (!audioRef.current) return;
        audioRef.current.srcObject = event.streams[0];
        void audioRef.current.play().catch(() => undefined);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          const active = sessionRef.current;
          if (active) {
            void studentApi.connectVoiceSession(active.sessionId).then((value) => {
              const connectedSession = value as { expiresAt: string };
              sessionRef.current = { ...active, expiresAt: connectedSession.expiresAt };
              setRemaining(Math.max(0, Math.ceil((new Date(connectedSession.expiresAt).getTime() - Date.now()) / 1000)));
              setConnected(true);
              setCaption("เริ่มพูดกับ AI ได้เลย");
            }).catch(() => void endSession("CONNECTION_LOST"));
          }
        }
        if (["failed", "closed"].includes(pc.connectionState) && sessionRef.current && !endingRef.current) {
          void endSession("CONNECTION_LOST");
        }
      };
      const channel = pc.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.onmessage = onRealtimeEvent;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc);
      const localSdp = pc.localDescription?.sdp;
      if (!localSdp) throw new Error("สร้างการเชื่อมต่อเสียงไม่สำเร็จ");
      const created = await studentApi.createVoiceSession(cycleId, { articleId, sdp: localSdp }) as StartResult;
      sessionRef.current = created;
      setRemaining(created.reservedSeconds);
      await pc.setRemoteDescription({ type: "answer", sdp: created.answerSdp });
    } catch (cause) {
      const active = sessionRef.current;
      cleanupMedia();
      if (active) {
        void studentApi.endVoiceSession(active.sessionId);
        sessionRef.current = null;
      }
      const domError = cause instanceof DOMException ? cause.name : "";
      setError(domError === "NotAllowedError"
        ? "ยังไม่ได้อนุญาตไมโครโฟน กรุณาเปิดสิทธิ์ไมโครโฟนของ LINE หรือเบราว์เซอร์แล้วลองใหม่"
        : cause instanceof Error ? cause.message : "เริ่มสนทนาไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setStarting(false);
    }
  };

  const toggleMute = () => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  };

  if (loading) return <main className="min-h-dvh grid place-items-center"><div className="size-10 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" /></main>;
  if (error && !entitlement) return <main className="min-h-dvh grid place-items-center p-6 text-center"><AlertCircle className="size-12 text-red-500" /><p>{error}</p><Link href="/progress" className="btn btn-primary">กลับหน้าความคืบหน้า</Link></main>;

  const canStart = Boolean(selectedArticle && entitlement?.enabled && entitlement.remainingSeconds > 0 && !entitlement.activeSession);
  const summary = result?.summary as { summaryTh?: string; strengths?: string[]; improvements?: string[] } | undefined;
  const scores = result?.scores as Record<string, number | null> | undefined;

  return (
    <main className="min-h-dvh bg-gradient-to-b from-emerald-950 via-slate-950 to-slate-900 text-white p-5 flex flex-col">
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      <header className="flex items-center justify-between gap-3">
        <Link href="/progress" className="text-sm text-white/70">← กลับ</Link>
        <div className="rounded-full bg-white/10 px-4 py-2 font-black tabular-nums">{formatTime(connected ? remaining : entitlement?.remainingSeconds || 0)}</div>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center text-center gap-6 max-w-md w-full mx-auto">
        <div>
          <p className="text-emerald-300 text-xs font-black uppercase tracking-[0.25em]">AI Speaking Coach</p>
          <h1 className="mt-2 text-2xl font-black">{selectedArticle?.title || "ฝึกสนทนากับ AI"}</h1>
          <p className="mt-2 text-white/60 text-sm">พูดภาษาอังกฤษได้เลย AI จะช่วยแก้ประโยคและฝึกต่อจากบทเรียน</p>
        </div>

        <div className={`relative grid place-items-center size-48 rounded-full transition-all ${connected ? "bg-emerald-400/20 shadow-[0_0_70px_rgba(52,211,153,0.28)]" : "bg-white/10"}`}>
          {connected && Array.from({ length: 12 }).map((_, index) => (
            <span key={index} className="absolute bottom-8 w-1 rounded-full bg-emerald-300 transition-all" style={{ left: `${27 + index * 4}%`, height: `${8 + volume * (18 + (index % 4) * 12)}px` }} />
          ))}
          {connected ? <Volume2 className="size-16 text-emerald-300" /> : <Sparkles className="size-16 text-white/70" />}
        </div>

        <div className="min-h-20 w-full rounded-2xl border border-white/10 bg-white/5 p-4 grid place-items-center">
          <p className="text-sm leading-relaxed text-white/85">{caption}</p>
        </div>

        {error && <div role="alert" className="rounded-xl bg-red-500/15 border border-red-400/30 p-3 text-sm text-red-100">{error}</div>}

        {!connected ? (
          <button disabled={!canStart || starting} onClick={startSession} className="w-full rounded-2xl bg-emerald-500 py-4 font-black shadow-xl disabled:opacity-40">
            {starting ? "กำลังเชื่อมต่อ…" : !entitlement?.enabled ? "ระบบกำลังเตรียมเปิดให้บริการ" : entitlement?.activeSession ? "มีการสนทนาเปิดอยู่ในอุปกรณ์อื่น" : "🎙️ เริ่มสนทนา"}
          </button>
        ) : (
          <div className="flex gap-4">
            <button onClick={toggleMute} aria-label={muted ? "เปิดไมโครโฟน" : "ปิดไมโครโฟน"} className="grid place-items-center size-16 rounded-full bg-white/10 border border-white/15">
              {muted ? <MicOff /> : <Mic />}
            </button>
            <button disabled={ending} onClick={() => void endSession()} aria-label="จบการสนทนา" className="grid place-items-center size-16 rounded-full bg-red-500 shadow-lg disabled:opacity-50">
              <PhoneOff />
            </button>
          </div>
        )}

        {summary?.summaryTh && (
          <div className="w-full text-left rounded-2xl bg-white text-slate-900 p-5">
            <h2 className="font-black text-lg">สรุปการฝึก</h2>
            <p className="mt-2 text-sm text-slate-600">{summary.summaryTh}</p>
            {scores && <div className="mt-4 grid grid-cols-2 gap-2 text-xs">{Object.entries(scores).map(([key, value]) => <div key={key} className="rounded-lg bg-slate-100 p-2"><span className="capitalize">{key}</span><strong className="float-right">{value ?? "–"}/5</strong></div>)}</div>}
          </div>
        )}
      </section>
    </main>
  );
}

export default function VoicePracticePage() {
  return <Suspense fallback={<main className="min-h-dvh grid place-items-center">กำลังโหลด…</main>}><VoicePracticeContent /></Suspense>;
}
