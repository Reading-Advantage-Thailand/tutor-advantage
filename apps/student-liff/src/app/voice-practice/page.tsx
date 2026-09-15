"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ChevronLeft, Clock3, Headphones, Lightbulb, Mic, MicOff, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { studentApi } from "@/lib/api";
import styles from "./voice-practice.module.css";

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

function CoachMascot({ state, level }: { state: "idle" | "connecting" | "listening" | "thinking" | "speaking" | "muted"; level: number }) {
  return (
    <div className={styles.mascotScene} data-state={state} style={{ "--voice-level": Math.max(.08, level) } as CSSProperties} aria-hidden="true">
      <span className={styles.sparkOne}>✦</span><span className={styles.sparkTwo}>●</span><span className={styles.sparkThree}>✦</span>
      <div className={styles.voiceRing} /><div className={styles.voiceRingTwo} />
      <div className={styles.mascotShadow} />
      <svg className={styles.mascot} viewBox="0 0 220 220" role="presentation">
        <defs>
          <linearGradient id="coachBody" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffb75e"/><stop offset="1" stopColor="#f47b35"/></linearGradient>
          <linearGradient id="coachShirt" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#22c98b"/><stop offset="1" stopColor="#079f70"/></linearGradient>
        </defs>
        <path d="M48 76 40 27l43 28M172 76l8-49-43 28" fill="url(#coachBody)" stroke="#c85d2a" strokeWidth="5" strokeLinejoin="round"/>
        <path d="m50 58-5-20 21 16m104 4 5-20-21 16" fill="#ffd6b1"/>
        <ellipse cx="110" cy="177" rx="65" ry="37" fill="url(#coachShirt)"/>
        <path d="M71 173c19 13 58 13 78 0" fill="none" stroke="#fff" strokeOpacity=".34" strokeWidth="4" strokeLinecap="round"/>
        <ellipse cx="110" cy="104" rx="72" ry="65" fill="url(#coachBody)" stroke="#c85d2a" strokeWidth="5"/>
        <path d="M50 108c20 2 32 14 40 33-23 2-40-9-47-24m127-9c-20 2-32 14-40 33 23 2 40-9 47-24" fill="#fff2df"/>
        <ellipse cx="110" cy="120" rx="41" ry="35" fill="#fff2df"/>
        <g className={styles.mascotEyes} fill="#24332f"><ellipse cx="83" cy="94" rx="7" ry="9"/><ellipse cx="137" cy="94" rx="7" ry="9"/></g>
        <circle cx="81" cy="91" r="2.2" fill="#fff"/><circle cx="135" cy="91" r="2.2" fill="#fff"/>
        <path d="m110 105-9 8 9 6 9-6Z" fill="#5e3529"/>
        <path className={styles.mascotMouth} d="M95 124c8 10 22 10 30 0" fill="none" stroke="#5e3529" strokeWidth="4" strokeLinecap="round"/>
        <path d="M57 117c-9 1-18 5-24 11m132-11c9 1 18 5 24 11M57 126c-8 3-14 7-18 12m126-12c8 3 14 7 18 12" stroke="#7a3e2c" strokeWidth="2.4" strokeLinecap="round" opacity=".55"/>
        <path d="M64 84c8-5 15-5 22-1m48 0c7-4 14-4 22 1" fill="none" stroke="#9d4c2d" strokeWidth="4" strokeLinecap="round"/>
        <circle cx="50" cy="109" r="8" fill="#ff9c83" opacity=".5"/><circle cx="170" cy="109" r="8" fill="#ff9c83" opacity=".5"/>
      </svg>
      <div className={styles.headphones}><span /><span /></div>
    </div>
  );
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
  const [coachSpeaking, setCoachSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ summary?: unknown; scores?: unknown } | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionRef = useRef<StartResult | null>(null);
  const transcriptRef = useRef<string[]>([]);
  const endingRef = useRef(false);
  const providerConnectedRef = useRef(false);
  const greetingSentRef = useRef(false);
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

  const sendOpeningGreeting = useCallback(() => {
    const channel = channelRef.current;
    if (!providerConnectedRef.current || greetingSentRef.current || channel?.readyState !== "open") return;
    greetingSentRef.current = true;
    setCaption("รีดี้กำลังทักทาย…");
    channel.send(JSON.stringify({
      type: "response.create",
      response: {
        output_modalities: ["audio"],
        instructions: "Start the practice now without waiting for the learner. Introduce yourself as Reedy in one warm, short Thai sentence, then use simple English to ask the first easy question about this lesson. The complete greeting must be 2-3 short sentences and under 15 seconds. Make it clear that the learner may answer in Thai, English, or mix both.",
      },
    }));
  }, []);

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
    providerConnectedRef.current = false;
    setConnected(false);
    setCoachSpeaking(false);
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
      if (type === "response.output_audio.delta" || type === "response.audio.delta") setCoachSpeaking(true);
      if (type === "response.output_audio.done" || type === "response.audio.done" || type === "response.done") setCoachSpeaking(false);
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
    providerConnectedRef.current = false;
    greetingSentRef.current = false;
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
              providerConnectedRef.current = true;
              setConnected(true);
              sendOpeningGreeting();
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
      channel.onopen = sendOpeningGreeting;
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
  const coachState = muted ? "muted" : starting ? "connecting" : coachSpeaking ? "speaking" : caption.includes("กำลังฟัง") ? "listening" : caption.includes("กำลังคิด") ? "thinking" : connected ? "listening" : "idle";
  const coachStatus = muted ? "พักฟังก่อนนะ" : starting ? "กำลังเข้าห้องฝึก…" : coachSpeaking ? "รีดี้กำลังพูด" : caption.includes("กำลังคิด") ? "ขอคิดแป๊บนึงนะ" : connected ? "รีดี้กำลังฟังคุณ" : "รีดี้พร้อมฝึกกับคุณ";

  return (
    <main className={styles.page}>
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      <header className={styles.header}>
        <Link href="/progress" className={styles.backButton}><ChevronLeft size={20} /> <span>กลับ</span></Link>
        <div className={styles.timer}><Clock3 size={16} /><div><small>เวลาฝึก</small><strong>{formatTime(connected ? remaining : entitlement?.remainingSeconds || 0)}</strong></div></div>
      </header>

      <section className={styles.content}>
        <div className={styles.intro}>
          <div className={styles.coachBadge}><span>R</span> ฝึกกับ “รีดี้”</div>
          <p className={styles.lessonLabel}>บทสนทนาจากเรื่อง</p>
          <h1>{selectedArticle?.title || "ฝึกพูดภาษาอังกฤษ"}</h1>
          <p>คุยสบายๆ เหมือนซ้อมกับเพื่อน รีดี้จะช่วยชวนคุยและแก้ประโยคให้</p>
        </div>

        <div className={styles.coachArea}>
          <div className={styles.statusBubble}><span className={styles.statusDot} />{coachStatus}</div>
          <CoachMascot state={coachState} level={volume} />
          {connected && <div className={styles.liveWave} aria-hidden="true">{Array.from({ length: 9 }).map((_, index) => <span key={index} style={{ height: `${7 + volume * (16 + (index % 4) * 16)}px` }} />)}</div>}
        </div>

        <div className={styles.captionCard} data-active={connected || undefined}>
          <Headphones size={18} />
          <p>{caption}</p>
        </div>

        {!connected && !error && <div className={styles.tips}><div><Lightbulb size={15} /> ไม่ต้องกลัวผิด</div><span />พูดแทรกได้ตลอด<span />คุยสั้นๆ ทีละประโยค</div>}

        {error && <div role="alert" className={styles.error}><AlertCircle size={18} /><span>{error}</span></div>}

        {!connected ? (
          <div className={styles.startArea}>
            <button disabled={!canStart || starting} onClick={startSession} className={styles.startButton} aria-label="เริ่มคุยกับรีดี้">
              <span className={styles.startRipple} /><span className={styles.startRippleTwo} />
              <Mic size={36} />
            </button>
            <strong>{starting ? "กำลังเข้าห้องฝึก…" : !entitlement?.enabled ? "ระบบกำลังเตรียมเปิดให้บริการ" : entitlement?.activeSession ? "มีการสนทนาเปิดอยู่ในอุปกรณ์อื่น" : "แตะเพื่อเริ่มคุย"}</strong>
            {canStart && !starting && <small>รีดี้พร้อมฟังแล้ว</small>}
          </div>
        ) : (
          <div className={styles.controls}>
            <button onClick={toggleMute} aria-label={muted ? "เปิดไมโครโฟน" : "ปิดไมโครโฟน"} className={`${styles.controlButton} ${muted ? styles.muted : ""}`}>
              {muted ? <MicOff /> : <Mic />}<small>{muted ? "เปิดไมค์" : "ปิดไมค์"}</small>
            </button>
            <button disabled={ending} onClick={() => void endSession()} aria-label="จบการสนทนา" className={`${styles.controlButton} ${styles.endButton}`}>
              <PhoneOff /><small>{ending ? "กำลังจบ…" : "จบการฝึก"}</small>
            </button>
          </div>
        )}

        {summary?.summaryTh && (
          <div className={styles.summary}>
            <div className={styles.summaryHeading}><span>🎉</span><div><small>GOOD JOB!</small><h2>สรุปการฝึกกับรีดี้</h2></div></div>
            <p>{summary.summaryTh}</p>
            {scores && <div className={styles.scoreGrid}>{Object.entries(scores).map(([key, value]) => <div key={key}><span className="capitalize">{key}</span><strong>{value ?? "–"}<small>/5</small></strong></div>)}</div>}
          </div>
        )}
      </section>
    </main>
  );
}

export default function VoicePracticePage() {
  return <Suspense fallback={<main className="min-h-dvh grid place-items-center">กำลังโหลด…</main>}><VoicePracticeContent /></Suspense>;
}
