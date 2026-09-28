"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, BookOpenCheck, ChevronDown, ChevronLeft, Clock3, Headphones, Lightbulb, Mic, MicOff, PhoneOff, X } from "lucide-react";
import { toast } from "sonner";
import { studentApi } from "@/lib/api";
import styles from "./voice-practice.module.css";
import Reedy from "./Reedy";
import GuidedReading, { passageSegments, type ReadingCue } from "./GuidedReading";
import { REEDY_PREVIEW_EVENT, REEDY_READING_PREVIEW_EVENT, REEDY_READING_PREVIEWS } from "@/lib/reedy-preview";

type Entitlement = {
  enabled: boolean;
  totalSeconds: number;
  unlockedSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
  completedArticles: number;
  eligibleArticles: Array<{ articleId: string; title: string }>;
  activeSession?: { sessionId: string; expiresAt: string; articleId: string; classBookCycleId: string } | null;
};

type StartResult = {
  sessionId: string;
  answerSdp: string;
  expiresAt: string;
  reservedSeconds: number;
  remainingSeconds: number;
};

type ReviewWord = {
  vocabulary?: string;
  word?: string;
  text?: string;
  definition?: { th?: string };
  translation?: string;
};

type ArticleReview = {
  title?: string;
  passage?: string;
  summary?: string | { th?: string[] };
  translated_summary?: { th?: string[] };
  words?: ReviewWord[];
  sentences?: Array<string | { sentences?: string; sentence?: string; text?: string }>;
  shortAnswerQuestions?: Array<{ question?: string }>;
};

function getReviewSummary(article: ArticleReview | null) {
  if (!article) return "จำใจความได้ไม่หมดก็ไม่เป็นไร รีดี้จะช่วยค่อย ๆ ทวนระหว่างคุย";
  const translated = article.translated_summary?.th?.filter(Boolean).join(" ");
  const localized = typeof article.summary === "object" ? article.summary.th?.filter(Boolean).join(" ") : undefined;
  const summary = translated || localized || (typeof article.summary === "string" ? article.summary : "") || article.passage || "";
  return summary.trim() || "จำใจความได้ไม่หมดก็ไม่เป็นไร รีดี้จะช่วยค่อย ๆ ทวนระหว่างคุย";
}

function getReviewWords(article: ArticleReview | null, limit = 6) {
  const seen = new Set<string>();
  return (article?.words || []).flatMap((word) => {
    const text = (word.vocabulary || word.word || word.text || "").trim();
    if (!text || seen.has(text.toLowerCase())) return [];
    seen.add(text.toLowerCase());
    return [{ text, meaning: (word.definition?.th || word.translation || "").trim() }];
  }).slice(0, limit);
}

function pickAcrossArticle(items: string[], limit: number) {
  if (items.length <= limit) return items;
  const indexes = Array.from({ length: limit }, (_, index) => Math.round(index * (items.length - 1) / (limit - 1)));
  return indexes.map((index) => items[index]);
}

function getReviewKeyPoints(article: ArticleReview | null) {
  const sentenceItems = (article?.sentences || []).flatMap((sentence) => {
    const text = (typeof sentence === "string"
      ? sentence
      : sentence.sentences || sentence.sentence || sentence.text || "").trim();
    return text ? [text] : [];
  });
  const passageItems = (article?.passage || "")
    .match(/[^.!?。！？]+[.!?。！？]?/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) || [];
  const source = sentenceItems.length > 0 ? sentenceItems : passageItems;
  return pickAcrossArticle([...new Set(source)], 5);
}

function getReviewQuestions(article: ArticleReview | null) {
  return (article?.shortAnswerQuestions || [])
    .map((item) => item.question?.trim() || "")
    .filter(Boolean)
    .slice(0, 2);
}

function normalizeArticleTitle(title?: string) {
  return (title || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

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
  const [articleReview, setArticleReview] = useState<ArticleReview | null>(null);
  const [reviewExpanded, setReviewExpanded] = useState(false);
  const [fullPassageExpanded, setFullPassageExpanded] = useState(false);
  const [readingOpen, setReadingOpen] = useState(false);
  const [readingOffered, setReadingOffered] = useState(false);
  const [readingQuote, setReadingQuote] = useState("");
  const [readingPreview, setReadingPreview] = useState<"speaking" | "listening" | null>(null);
  const previewStepRef = useRef(0);
  const readingOpenRef = useRef(false);
  const readingArticleRef = useRef<ArticleReview | null>(null);
  const handledToolsRef = useRef(new Set<string>());
  const responseBusyRef = useRef(false);
  readingArticleRef.current = articleReview;
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [ending, setEnding] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [checkingMic, setCheckingMic] = useState(false);
  const [micCheck, setMicCheck] = useState<string | null>(null);
  const [sendingReadingIntent, setSendingReadingIntent] = useState(false);
  const [muted, setMuted] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [caption, setCaption] = useState("พร้อมเริ่มฝึกสนทนา");
  const [volume, setVolume] = useState(0);
  const [coachSpeaking, setCoachSpeaking] = useState(false);
  const [learnerSpeaking, setLearnerSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ summary?: unknown; scores?: unknown } | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionRef = useRef<StartResult | null>(null);
  const endingRef = useRef(false);
  const providerConnectedRef = useRef(false);
  const greetingSentRef = useRef(false);
  const analyserFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const disconnectTimerRef = useRef<number | null>(null);

  const selectedArticle = entitlement?.eligibleArticles.find((article) => article.articleId === articleId);

  const loadEntitlement = useCallback(async () => {
    if (!cycleId) {
      setError("ไม่พบข้อมูลสิทธิ์ของหนังสือ");
      setLoading(false);
      return;
    }
    try {
      const [data, review] = await Promise.all([
        studentApi.getVoiceEntitlement(cycleId) as Promise<Entitlement>,
        articleId
          ? studentApi.getStudentArticle(articleId).catch(() => null) as Promise<{ article?: ArticleReview } | null>
          : Promise.resolve(null),
      ]);
      const eligibleArticle = data.eligibleArticles.find((article) => article.articleId === articleId);
      const reviewArticle = review?.article || null;
      const reviewMatchesCycle = !reviewArticle?.title
        || !eligibleArticle?.title
        || normalizeArticleTitle(reviewArticle.title) === normalizeArticleTitle(eligibleArticle.title);
      setEntitlement(data);
      // Article IDs can collide across local/external catalogs. Never show a
      // recap from a different lesson just because the IDs happen to match.
      setArticleReview(reviewMatchesCycle ? reviewArticle : null);
      setRemaining(data.remainingSeconds);
      return data;
    } catch {
      setError("โหลดสิทธิ์ฝึกสนทนาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [articleId, cycleId]);

  useEffect(() => { void loadEntitlement(); }, [loadEntitlement]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const preview = (event: Event) => {
      const action: unknown = (event as CustomEvent).detail;
      if (!REEDY_READING_PREVIEWS.some(([value]) => value === action)) return;
      if (sessionRef.current || starting || connected) { toast.info("จบการสนทนาก่อนทดสอบหน้าจอจำลองนะครับ"); return; }
      if (action === "reset") {
        setReadingPreview(null); setReadingOpen(false); readingOpenRef.current = false;
        setReadingOffered(false); setReadingQuote(""); setCaption("พร้อมเริ่มฝึกสนทนา"); previewStepRef.current = 0;
        window.dispatchEvent(new CustomEvent(REEDY_PREVIEW_EVENT, { detail: null }));
        return;
      }
      const article = readingArticleRef.current;
      if (!article?.passage?.trim()) { toast.info("ยังไม่มีบทความสำหรับทดสอบ"); return; }
      window.dispatchEvent(new CustomEvent(REEDY_PREVIEW_EVENT, { detail: null }));
      setReviewExpanded(false); setReadingPreview(action === "listen" ? "listening" : "speaking");
      setReadingOffered(action === "offer"); setReadingOpen(action !== "offer"); readingOpenRef.current = action !== "offer";
      if (action === "offer") { setCaption("จำไม่ได้ไม่เป็นไร เปิดบทความอ่านด้วยกันไหม?"); return; }
      const sentences = passageSegments(article.passage).map((text) => text.trim()).filter(Boolean);
      if (action === "word") {
        const words = getReviewWords(article, Infinity);
        if (!words.length) { toast.info("บทนี้ไม่มีข้อมูลคำศัพท์"); return; }
        const word = words[previewStepRef.current++ % words.length]; setReadingQuote(word.text);
        setCaption(`ลองอ่านคำว่า ${word.text} ด้วยกันนะ`);
      } else if (action === "listen") { setCaption("ตาคุณแล้ว ลองอ่านตรงที่รีดี้ชี้ได้เลย"); }
      else { if (action === "open") previewStepRef.current = 0; else previewStepRef.current++; const sentence = sentences[previewStepRef.current % sentences.length]; setReadingQuote(sentence); setCaption("อ่านประโยคที่รีดี้ชี้ไปด้วยกันนะ"); }
    };
    window.addEventListener(REEDY_READING_PREVIEW_EVENT, preview);
    return () => window.removeEventListener(REEDY_READING_PREVIEW_EVENT, preview);
  }, [connected, starting]);

  const sendOpeningGreeting = useCallback(() => {
    const channel = channelRef.current;
    if (!providerConnectedRef.current || greetingSentRef.current || channel?.readyState !== "open") return;
    greetingSentRef.current = true;
    setCaption("รีดี้กำลังทักทาย…");
    channel.send(JSON.stringify({
      type: "response.create",
      response: {
        output_modalities: ["audio"],
        instructions: readingOpenRef.current
          ? "Start now. The learner already opened the full article on screen to read together. Introduce yourself warmly in Thai, give one simple memory cue, and ask one easy lesson question. You choose the teaching sequence; the learner only answers or reads aloud. Keep under 15 seconds."
          : "Start the practice now without waiting for the learner. Introduce yourself as Reedy in one warm, short Thai sentence. Give exactly one concise Thai memory cue about the lesson's central idea, without reading or revealing the whole passage, then ask one very easy personal-experience question in simple English that connects to the lesson. Keep the complete opening under 15 seconds and make it clear the learner may answer in Thai, English, or mix both.",
      },
    }));
  }, []);

  const cleanupMedia = useCallback(() => {
    if (disconnectTimerRef.current !== null) window.clearTimeout(disconnectTimerRef.current);
    disconnectTimerRef.current = null;
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
    responseBusyRef.current = false;
    setReadingOffered(false);
    setCoachSpeaking(false);
    setVolume(0);
  }, []);

  const endSession = useCallback(async (reason: "USER_ENDED" | "CONNECTION_LOST" | "QUOTA_REACHED" = "USER_ENDED") => {
    if (endingRef.current) return;
    endingRef.current = true;
    setEnding(true);
    const active = sessionRef.current;
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = false; });
    if (active) {
      try {
        const ended = await studentApi.endVoiceSession(active.sessionId, reason) as { summary?: unknown; scores?: unknown };
        setResult({ summary: ended.summary, scores: ended.scores });
        setCaption(reason === "QUOTA_REACHED" ? "ครบเวลาฝึกของรอบนี้แล้ว" : "จบการฝึกแล้ว");
        await loadEntitlement();
      } catch {
        setCaption("จบการเชื่อมต่อแล้ว ระบบจะปรับยอดเวลาให้อัตโนมัติ");
      }
    }
    cleanupMedia();
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

  useEffect(() => {
    const closeOnPageExit = () => {
      const active = sessionRef.current;
      if (active && !endingRef.current) void studentApi.endVoiceSessionKeepalive(active.sessionId);
    };
    window.addEventListener("pagehide", closeOnPageExit);
    return () => window.removeEventListener("pagehide", closeOnPageExit);
  }, []);

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
      if (type === "response.created") responseBusyRef.current = true;
      if (type === "response.done") {
        responseBusyRef.current = false;
        if (endingRef.current) return;
        const response = data.response as { status?: string; output?: Array<{ type?: string; name?: string; call_id?: string; arguments?: string }> } | undefined;
        let handled = false;
        for (const item of response?.output || []) {
          if (item.type !== "function_call" || item.name !== "guide_reading" || !item.call_id || handledToolsRef.current.has(item.call_id)) continue;
          handledToolsRef.current.add(item.call_id);
          let success = false;
          let highlightedQuote = "";
          if (response?.status === "completed") {
            try {
              const cue = JSON.parse(item.arguments || "{}") as ReadingCue;
              const article = readingArticleRef.current;
              const passage = article?.passage || "";
              if (passage.trim()) {
                if (cue.action === "offer") { setReadingOffered(true); success = true; }
                if (cue.action === "open") {
                  highlightedQuote = typeof cue.quote === "string" && cue.quote.trim() && passage.includes(cue.quote.trim())
                    ? cue.quote.trim() : passageSegments(passage)[0].trim();
                  readingOpenRef.current = true; setReadingOpen(true); setReadingOffered(false); setReviewExpanded(false);
                  setReadingQuote(highlightedQuote); success = true;
                }
                if ((cue.action === "focus" || cue.action === "word") && readingOpenRef.current && typeof cue.quote === "string" && cue.quote.trim()) {
                  const quote = cue.quote.trim();
                  const valid = cue.action === "word" ? getReviewWords(article, Infinity).some((word) => word.text.toLowerCase() === quote.toLowerCase()) : passage.includes(quote);
                  if (valid) { highlightedQuote = quote; setReadingQuote(quote); success = true; }
                }
                if (cue.action === "close") { readingOpenRef.current = false; setReadingOpen(false); setReadingOffered(false); setReadingQuote(""); success = true; }
              }
            } catch { /* Never render malformed or invented teaching content. */ }
          }
          channelRef.current?.send(JSON.stringify({ type: "conversation.item.create", item: { type: "function_call_output", call_id: item.call_id, output: JSON.stringify({ success, readingOpen: readingOpenRef.current, highlightedQuote }) } }));
          handled = true;
        }
        if (handled && response?.status === "completed" && channelRef.current?.readyState === "open") {
          responseBusyRef.current = true;
          channelRef.current.send(JSON.stringify({ type: "response.create", response: { output_modalities: ["audio"], tool_choice: "none", instructions: "Continue using the guide_reading result. For offer, ask in Thai whether to open the article and WAIT for consent. For open, read the exact highlighted quote slowly, give one brief Thai hint, and invite the learner to repeat; do not ask them to choose a sentence. For focus or word, read the exact highlighted text slowly once, give one short Thai hint, invite repetition, then WAIT. For close, return to one easy lesson question. If the tool failed, explain the display is unavailable and continue verbally. Keep under 15 seconds." } }));
        }
      }
      if (type === "input_audio_buffer.speech_started") { setLearnerSpeaking(true); setCoachSpeaking(false); setCaption("กำลังฟังคุณพูด…"); }
      if (type === "input_audio_buffer.speech_stopped") { setLearnerSpeaking(false); setCaption("AI กำลังคิด…"); }
      if (type === "output_audio_buffer.started") setCoachSpeaking(true);
      if (type === "output_audio_buffer.stopped" || type === "output_audio_buffer.cleared") setCoachSpeaking(false);
      if (type === "conversation.item.input_audio_transcription.completed" && typeof data.transcript === "string") {
        const text = data.transcript.trim();
        if (text) {
          setCaption(text);
        }
      }
      if (type === "response.output_audio_transcript.done" && typeof data.transcript === "string") {
        const text = data.transcript.trim();
        if (text) {
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
    setReadingPreview(null);
    window.dispatchEvent(new CustomEvent(REEDY_PREVIEW_EVENT, { detail: null }));
    setError(null);
    setResult(null);
    endingRef.current = false;
    providerConnectedRef.current = false;
    greetingSentRef.current = false;
    handledToolsRef.current.clear();
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
        if (pc.connectionState !== "disconnected" && disconnectTimerRef.current !== null) {
          window.clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
        if (pc.connectionState === "disconnected" && disconnectTimerRef.current === null) {
          setCaption("การเชื่อมต่อสะดุด กำลังรอเครือข่ายกลับมา…");
          disconnectTimerRef.current = window.setTimeout(() => {
            disconnectTimerRef.current = null;
            if (pc.connectionState === "disconnected" && sessionRef.current && !endingRef.current) void endSession("CONNECTION_LOST");
          }, 8_000);
        }
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

  const checkMicrophone = async () => {
    if (checkingMic || connected) return;
    setCheckingMic(true);
    setMicCheck("กำลังฟังเสียงรอบตัว… กรุณาเงียบสักครู่");
    let testStream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      testStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      context.createMediaStreamSource(testStream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const listen = async (durationMs: number) => {
        const levels: number[] = [];
        const deadline = Date.now() + durationMs;
        while (Date.now() < deadline) {
          analyser.getFloatTimeDomainData(samples);
          levels.push(Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length));
          await new Promise((resolve) => window.setTimeout(resolve, 100));
        }
        return levels;
      };
      const quiet = await listen(1000);
      setMicCheck("ลองพูดว่า “Hello Reedy” ด้วยเสียงปกติ");
      const speaking = await listen(2200);
      const background = quiet.reduce((sum, value) => sum + value, 0) / quiet.length;
      const peak = Math.max(...speaking);
      setMicCheck(background > 0.07
        ? "เสียงรอบตัวอาจดังเกินไป ลองย้ายไปที่เงียบขึ้นหรือใช้หูฟัง แล้วตรวจใหม่"
        : peak < 0.02 || peak - background < 0.015
          ? "เสียงพูดอาจเบา ลองขยับไมค์ให้ใกล้ขึ้นและพูดด้วยเสียงปกติ แล้วตรวจใหม่"
          : "ไมค์รับเสียงได้ชัด พร้อมเริ่มฝึกกับรีดี้");
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : "";
      setMicCheck(name === "NotAllowedError"
        ? "ยังไม่ได้อนุญาตไมค์ กรุณาเปิดสิทธิ์ไมโครโฟนใน LINE หรือเบราว์เซอร์ แล้วกดตรวจใหม่"
        : "ตรวจไมค์ไม่สำเร็จ ตรวจว่าอุปกรณ์เชื่อมต่ออยู่ แล้วกดตรวจใหม่");
    } finally {
      testStream?.getTracks().forEach((track) => track.stop());
      if (context) void context.close().catch(() => undefined);
      setCheckingMic(false);
    }
  };

  const sendReadingIntent = async (action: "accept" | "decline" | "close") => {
    const active = sessionRef.current;
    if (!active || sendingReadingIntent) return;
    if (responseBusyRef.current) { toast.info("รอให้รีดี้พูดจบก่อนนะ"); return; }
    setSendingReadingIntent(true);
    responseBusyRef.current = true;
    try {
      await studentApi.sendVoiceReadingIntent(active.sessionId, action);
      setCaption("รีดี้กำลังตอบ…");
    } catch {
      responseBusyRef.current = false;
      toast.error("ส่งคำตอบไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSendingReadingIntent(false);
    }
  };

  const resolveInterruptedSession = async (continuePracticing: boolean) => {
    const interrupted = entitlement?.activeSession;
    if (!interrupted || recovering) return;
    setRecovering(true);
    setError(null);
    try {
      const ended = await studentApi.endVoiceSession(interrupted.sessionId, "INTERRUPTED_RECOVERY") as { consumedSeconds: number; summary?: unknown; scores?: unknown };
      const refreshed = await loadEntitlement();
      if (!refreshed) throw new Error("ตรวจสอบเวลาที่เหลือไม่สำเร็จ กรุณาลองอีกครั้ง");
      if (continuePracticing) {
        if (interrupted.articleId !== articleId || interrupted.classBookCycleId !== cycleId) {
          window.location.assign(`/voice-practice?cycleId=${encodeURIComponent(interrupted.classBookCycleId)}&articleId=${encodeURIComponent(interrupted.articleId)}`);
        } else if (refreshed.remainingSeconds <= 0) {
          setCaption("ครบเวลาฝึกแล้ว");
          setResult({ summary: ended.summary, scores: ended.scores });
        } else {
          await startSession();
        }
      } else {
        setResult({ summary: ended.summary, scores: ended.scores });
        setCaption(`จบรอบก่อนแล้ว ใช้เวลาฝึก ${formatTime(ended.consumedSeconds)}`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "จัดการรอบที่ค้างไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setRecovering(false);
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
  const reviewSummary = getReviewSummary(articleReview);
  const reviewWords = getReviewWords(articleReview);
  const reviewKeyPoints = getReviewKeyPoints(articleReview);
  const reviewQuestions = getReviewQuestions(articleReview);
  const repeatAfterPractice = reviewKeyPoints.find((sentence) => sentence.length <= 140)
    || reviewWords[0]?.text
    || "";
  const displayTitle = selectedArticle?.title || articleReview?.title || "ฝึกพูดภาษาอังกฤษ";
  const coachState = error ? "reassuring" : result ? "celebrating" : starting ? "connecting" : coachSpeaking ? "speaking" : muted ? "muted" : learnerSpeaking && connected ? "listening" : caption.includes("กำลังคิด") && connected ? "thinking" : connected ? "listening" : "idle";
  const coachStatus = muted ? "พักฟังก่อนนะ" : starting ? "กำลังเข้าห้องฝึก…" : coachSpeaking ? "รีดี้กำลังพูด" : caption.includes("กำลังคิด") ? "ขอคิดแป๊บนึงนะ" : connected ? "รีดี้กำลังฟังคุณ" : "รีดี้พร้อมฝึกกับคุณ";

  return (
    <main className={styles.page}>
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      <header className={styles.header}>
        <Link href="/progress" className={styles.backButton}><ChevronLeft size={20} /> <span>กลับ</span></Link>
        <div className={styles.timer}><Clock3 size={16} /><div><small>เวลาฝึก</small><strong>{formatTime(connected ? remaining : entitlement?.remainingSeconds || 0)}</strong></div></div>
      </header>

      <section className={`${styles.content} ${readingOpen ? styles.readingMode : ""}`}>
        <div className={styles.intro}>
          <div className={styles.coachBadge}><span>R</span> ฝึกกับ “รีดี้”</div>
          <p className={styles.lessonLabel}>บทสนทนาจากเรื่อง</p>
          <h1>{displayTitle}</h1>
          <p>คุยสบายๆ เหมือนซ้อมกับเพื่อน รีดี้จะช่วยชวนคุยและแก้ประโยคให้</p>
        </div>

        <div className={styles.coachArea}>
          <span className="sr-only">{coachStatus}</span>
          <Reedy state={readingPreview || coachState} level={volume} />
          {connected && <div className={styles.liveWave} aria-hidden="true">{Array.from({ length: 9 }).map((_, index) => <span key={index} style={{ height: `${7 + volume * (16 + (index % 4) * 16)}px` }} />)}</div>}
        </div>

        {readingPreview && <button className={styles.previewBadge} onClick={() => window.dispatchEvent(new CustomEvent(REEDY_READING_PREVIEW_EVENT, { detail: "reset" }))}>DEV · จำลองหน้าอ่าน ไม่มีเสียง <X size={12} /></button>}
        {readingOpen && articleReview?.passage && <>
          <GuidedReading title={displayTitle} passage={articleReview.passage} quote={readingQuote} words={getReviewWords(articleReview, Infinity)} speaking={readingPreview ? readingPreview === "speaking" : coachSpeaking} connected={connected || Boolean(readingPreview)} />
          {connected && <button type="button" className={styles.readingFallback} disabled={sendingReadingIntent} onClick={() => void sendReadingIntent("close")}>กลับไปคุยกับรีดี้</button>}
        </>}
        {readingOffered && !readingOpen && <div className={styles.readingOffer} role="status"><strong>จำไม่ได้ก็ไม่เป็นไร ♡</strong><p>เปิดบทความอ่านไปกับรีดี้ไหม?</p><small>ตอบด้วยเสียงหรือแตะเลือกได้</small>{connected && <div><button type="button" disabled={sendingReadingIntent} onClick={() => void sendReadingIntent("accept")}>เปิดอ่านด้วยกัน</button><button type="button" disabled={sendingReadingIntent} onClick={() => void sendReadingIntent("decline")}>คุยต่อ</button></div>}</div>}

        {!connected && !readingOpen && (
          <section className={styles.memoryCard}>
            <button type="button" className={styles.memoryHeader} onClick={() => setReviewExpanded((value) => !value)} aria-expanded={reviewExpanded}>
              <span className={styles.memoryIcon}><BookOpenCheck size={18} /></span>
              <span><small>MEMORY REFRESH</small><strong>ทบทวนสั้น ๆ ก่อนคุย</strong></span>
              <ChevronDown className={styles.memoryChevron} size={18} aria-hidden="true" />
            </button>
          </section>
        )}

        {!connected && reviewExpanded && (
          <div className={styles.memoryOverlay} role="presentation" onClick={() => setReviewExpanded(false)}>
            <section className={styles.memorySheet} role="dialog" aria-modal="true" aria-labelledby="memory-review-title" onClick={(event) => event.stopPropagation()}>
              <span className={styles.sheetHandle} aria-hidden="true" />
              <header className={styles.sheetHeader}>
                <span className={styles.memoryIcon}><BookOpenCheck size={19} /></span>
                <span><small>MEMORY REFRESH</small><strong id="memory-review-title">ทบทวนสั้น ๆ ก่อนคุย</strong></span>
                <button type="button" onClick={() => setReviewExpanded(false)} aria-label="ปิดเนื้อหาทบทวน"><X size={20} /></button>
              </header>
              <div className={styles.memoryBody}>
                <section className={styles.memoryOverview}>
                  <small>เรื่องนี้พูดถึงอะไร</small>
                  <p>{reviewSummary}</p>
                </section>
                {reviewKeyPoints.length > 0 && <section className={styles.keyPoints}><small>ภาพรวมตั้งแต่ต้นถึงท้ายบท</small><ol>{reviewKeyPoints.map((sentence) => <li key={sentence}>{sentence}</li>)}</ol></section>}
                {reviewWords.length > 0 && <section className={styles.vocabularySection}><small>คำศัพท์ช่วยจำ</small><div className={styles.memoryWords}>{reviewWords.map((word) => <span key={word.text}><strong>{word.text}</strong>{word.meaning && <small>{word.meaning}</small>}</span>)}</div></section>}
                {reviewQuestions.length > 0 && <section className={styles.recallQuestions}><small>ลองนึกคำตอบก่อนคุย</small>{reviewQuestions.map((question) => <p key={question}>{question}</p>)}</section>}
                <div className={styles.sentenceStarter}><small>ถ้ายังนึกไม่ออก เริ่มด้วย</small><strong>“I remember that…”</strong></div>
                {articleReview?.passage?.trim() && <>
                  <button type="button" className={styles.fullPassageButton} onClick={() => setFullPassageExpanded((value) => !value)} aria-expanded={fullPassageExpanded}>
                    <span>{fullPassageExpanded ? "ซ่อนบทความเต็ม" : "เปิดดูบทความเต็ม"}</span><ChevronDown size={16} aria-hidden="true" />
                  </button>
                  {fullPassageExpanded && <section className={styles.fullPassage}><small>บทความเต็ม</small><p>{articleReview.passage}</p></section>}
                </>}
                <p className={styles.memoryReassurance}>จำไม่ได้ไม่เป็นไร รีดี้จะช่วยใบ้ทีละขั้น</p>
              </div>
            </section>
          </div>
        )}

        <div className={styles.captionCard} data-active={connected || undefined}>
          <Headphones size={18} />
          <p>{caption}</p>
        </div>

        {!connected && !error && <div className={styles.tips}><div><Lightbulb size={15} /> ไม่ต้องกลัวผิด</div><span />พูดแทรกได้ตลอด<span />คุยสั้นๆ ทีละประโยค</div>}

        {error && <div role="alert" className={styles.error}><AlertCircle size={18} /><span>{error}</span></div>}
        {!connected && !starting && !entitlement?.activeSession && <div className={styles.micCheck}>
          {micCheck && <p role="status">{micCheck}</p>}
          <button type="button" disabled={checkingMic} onClick={() => void checkMicrophone()}>{checkingMic ? "กำลังตรวจไมค์…" : micCheck ? "ตรวจไมค์อีกครั้ง" : "ตรวจไมค์ก่อนเริ่ม"}</button>
          {error && <button type="button" disabled={!canStart} onClick={() => void startSession()}>ลองเริ่มใหม่</button>}
        </div>}

        {entitlement?.activeSession && !connected && (
          <section className={styles.interruptedSession} aria-label="รอบฝึกที่ค้างอยู่">
            <strong>มีรอบฝึกก่อนหน้าที่ยังเปิดอยู่</strong>
            <p>หากปิดหน้าหรือเสียงหลุด ระบบจะคิดเวลาเท่าที่ใช้ไป แล้วเริ่มการเชื่อมต่อใหม่เมื่อกลับไปฝึกต่อ</p>
            <div>
              <button type="button" disabled={recovering} onClick={() => void resolveInterruptedSession(true)}>กลับไปฝึกต่อ</button>
              <button type="button" disabled={recovering} onClick={() => void resolveInterruptedSession(false)}>จบรอบนี้</button>
            </div>
          </section>
        )}

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
            <div className={styles.nextPractice}>
              {summary.strengths?.[0] && <div><small>ทำได้ดี</small><strong>{summary.strengths[0]}</strong></div>}
              {summary.improvements?.[0] && <div><small>ครั้งหน้าลอง</small><strong>{summary.improvements[0]}</strong></div>}
            </div>
            {repeatAfterPractice && <div className={styles.repeatPractice}><small>ลองพูดอีกครั้งจากบทนี้</small><strong lang="en">“{repeatAfterPractice}”</strong><span>อ่านออกเสียงช้า ๆ แล้วลองพูดอีกครั้งโดยไม่มองข้อความ</span></div>}
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
