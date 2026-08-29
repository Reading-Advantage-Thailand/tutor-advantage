import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const getSocketUrl = () => {
  const configuredUrl = process.env.NEXT_PUBLIC_LEARNING_SERVICE_URL;

  if (configuredUrl) {
    if (typeof window === 'undefined') return configuredUrl;
    try {
      const configuredHost = new URL(configuredUrl).hostname;
      const pageHost = window.location.hostname;
      const isPageOnLocalhost = pageHost === 'localhost' || pageHost === '127.0.0.1';
      const isConfiguredLocalhost = configuredHost === 'localhost' || configuredHost === '127.0.0.1';
      return isConfiguredLocalhost && !isPageOnLocalhost ? window.location.origin : configuredUrl;
    } catch {
      return configuredUrl;
    }
  }

  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:3002';
  }

  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3002';
};

function getAnswerSubmissionMessage(code?: string) {
  switch (code) {
    case "AI_CONCURRENCY_LIMIT":
    case "AI_QUOTA_EXCEEDED":
      return "ระบบกำลังตรวจคำตอบจำนวนมาก กรุณารอสักครู่แล้วลองส่งใหม่อีกครั้ง";
    case "AI_REQUEST_ALREADY_IN_PROGRESS":
      return "ระบบกำลังตรวจคำตอบนี้อยู่ กรุณารอสักครู่";
    case "ANSWER_ALREADY_SUBMITTED":
      return "คำตอบข้อนี้ถูกส่งไปแล้ว";
    case "ANSWER_TOO_LONG":
      return "คำตอบยาวเกินกำหนด กรุณาย่อคำตอบแล้วลองใหม่";
    case "SESSION_ACCESS_LOST":
    case "SESSION_NOT_FOUND":
    case "SESSION_STATE_LOST":
      return "การเชื่อมต่อห้องเรียนสะดุด ระบบกำลังเชื่อมต่อใหม่ กรุณาลองส่งอีกครั้ง";
    default:
      return "ส่งคำตอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
  }
}

export interface LessonPair {
  pairNumber: number;
  members: { studentId: string; name: string; pictureUrl?: string }[];
}

export type GameCategory = "vocabulary" | "sentence";
export type GamePhaseStatus = "voting" | "ready" | "teacher_demo" | "tutorial" | "countdown" | "playing" | "results";

export interface GamePhaseResult {
  studentId: string;
  name: string;
  gameId: string;
  score: number;
  correct?: number;
  total?: number;
  durationMs?: number;
  submittedAt: number;
}

export interface GamePhaseState {
  phase: number;
  category: GameCategory;
  status: GamePhaseStatus;
  votes: Record<string, string>;
  selectedGameId?: string;
  tutorialEnabled?: boolean;
  teacherDemoEnabled?: boolean;
  countdownEndsAt?: number;
  results: Record<string, GamePhaseResult>;
}

export interface LessonSessionData {
  sessionId: string;
  currentStudentId?: string;
  currentPhase: number;
  phaseChangeId?: string;
  hasAnswered?: boolean;
  articleData?: LessonArticleData;
  activeSentenceIndex?: number;
  phaseSelectedIndices?: Record<number, number>;
  pairs?: LessonPair[] | null;
  gameState?: GamePhaseState | null;
  phaseRestored?: boolean;
  resumePhase?: number;
  flagCounts?: Record<number, number>;
}

export interface LessonParticipant {
  studentId: string;
  name: string;
  pictureUrl?: string;
  isReady: boolean;
  score?: number;
}

interface LessonQuestion {
  question: string;
  answer: string;
}

interface LessonWord {
  vocabulary?: string;
  word?: string;
  text?: string;
  audioUrl?: string;
  audio_url?: string;
  definition?: {
    th?: string;
  };
  translation?: string;
}

interface LessonSentence {
  sentences: string;
}

interface LessonArticleData {
  id?: string;
  title?: string;
  multipleChoiceQuestions?: LessonQuestion[];
  shortAnswerQuestions?: LessonQuestion[];
  words?: LessonWord[];
  sentences?: Array<string | LessonSentence>;
}

export interface PaymentRequiredData {
  classId: string;
  cycleId?: string | null;
  bookId?: string | null;
  bookTitle?: string | null;
  bookCode?: string | null;
  packagePriceSatang?: number | null;
  paymentUrl: string;
  message?: string;
}

export const useLessonSocket = (classId: string | undefined, studentId: string, name: string, pictureUrl?: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionData, setSessionData] = useState<LessonSessionData | null>(null);
  const [articleData, setArticleData] = useState<LessonArticleData | null>(null);
  const [participants, setParticipants] = useState<LessonParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paymentRequired, setPaymentRequired] = useState<PaymentRequiredData | null>(null);
  const [aiFeedback, setAiFeedback] = useState<{ score: number; feedback: string } | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [questionEnded, setQuestionEnded] = useState(false);
  const [missedQuestion, setMissedQuestion] = useState(false);
  const [isEveryoneReady, setIsEveryoneReady] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState<string | null>(null);
  const [kicked, setKicked] = useState<string | null>(null);
  const [flagCounts, setFlagCounts] = useState<Record<number, number>>({});
  const [languageAnswer, setLanguageAnswer] = useState<{ question: string; answer: string } | null>(null);
  const [phaseReadOnly, setPhaseReadOnly] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const hasAnsweredRef = useRef(false);
  const submissionPendingRef = useRef(false);
  const phaseChangeIdRef = useRef<string | null>(null);

  useEffect(() => {
    hasAnsweredRef.current = hasAnswered;
  }, [hasAnswered]);

  useEffect(() => {
    if (!classId || !studentId) return;

    let activeSocket: Socket | null = null;
    let cancelled = false;
    const init = async () => {
      try {
        const tokenResponse = await fetch("/api/auth/socket-token", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const tokenData = await tokenResponse.json().catch(() => ({})) as { socketToken?: string };
        if (!tokenResponse.ok || !tokenData.socketToken) {
          if (!cancelled) setError("Your session is not ready. Please sign in again.");
          return;
        }
        if (cancelled) return;

        const initialToken = tokenData.socketToken;
        const newSocket = io(getSocketUrl(), {
          // Lesson tokens expire after a few minutes. Refresh the handshake
          // token for reconnects so a transient network change does not make
          // the student lose the room while submitting an answer.
          auth: (callback) => {
            void fetch("/api/auth/socket-token", {
              cache: "no-store",
              credentials: "same-origin",
            })
              .then(async (response) => {
                const data = await response.json().catch(() => ({})) as { socketToken?: string };
                callback({ token: response.ok && data.socketToken ? data.socketToken : initialToken });
              })
              .catch(() => callback({ token: initialToken }));
          },
          path: '/socket.io',
          addTrailingSlash: false,
          timeout: 8000,
        });
        activeSocket = newSocket;
        socketRef.current = newSocket;
        setSocket(newSocket);

    newSocket.on('connect', () => {
      if (cancelled) return;
      setError(null);
      newSocket.emit('join_class', { classId, studentId, name, pictureUrl });
    });

    newSocket.on('connect_error', (err) => {
      if (cancelled) return;
      setError(err.message || 'Could not connect to the learning service.');
    });

    newSocket.on('disconnect', (reason) => {
      submissionPendingRef.current = false;
      if (!cancelled && reason !== 'io client disconnect') {
        setSubmissionError('การเชื่อมต่อห้องเรียนขาดหาย ระบบกำลังเชื่อมต่อใหม่');
      }
    });

    newSocket.on('join_success', (data: LessonSessionData) => {
      setPaymentRequired(null);
      phaseChangeIdRef.current = typeof data.phaseChangeId === 'string'
        ? data.phaseChangeId
        : null;
      const answered = Boolean(data.hasAnswered);
      setSessionData(data);
      setArticleData(data.articleData ?? null);
      setPhaseReadOnly(Boolean(data.phaseRestored));
      setFlagCounts(data.flagCounts || {});
      setHasAnswered(answered);
      hasAnsweredRef.current = answered;
      submissionPendingRef.current = false;
      setSubmissionError(null);
    });

    newSocket.on('participants_updated', (data: { participants: LessonParticipant[] }) => {
      setParticipants(data.participants);
    });

    newSocket.on('nudge_received', (data: { message: string }) => {
      setNudgeMessage(data.message);
      // Clear nudge after 5 seconds
      setTimeout(() => setNudgeMessage(null), 5000);
    });

    newSocket.on('kicked', (data: { message: string }) => {
      setKicked(data.message);
      newSocket.disconnect();
    });

    newSocket.on('session_deleted', (data: { message: string }) => {
      setKicked(data.message);
      newSocket.disconnect();
    });

    newSocket.on('all_answered_broadcast', () => {
      setIsEveryoneReady(true);
      setQuestionEnded(true);
      setMissedQuestion(!hasAnsweredRef.current);
    });

    newSocket.on('error', (data: { message: string }) => {
      setError(data.message);
    });

    newSocket.on('payment_required', (data: PaymentRequiredData) => {
      setError(null);
      setPaymentRequired(data);
    });

    newSocket.on('phase_changed', (data: { phase: number; phaseChangeId?: string; phaseSelectedIndices?: Record<number, number>; pairs?: LessonPair[] | null; gameState?: GamePhaseState | null; phaseRestored?: boolean; resumePhase?: number; activeSentenceIndex?: number; flagCounts?: Record<number, number> }) => {
      if (cancelled || socketRef.current !== newSocket || !newSocket.connected) return;
      if (data.phaseChangeId && data.phaseChangeId === phaseChangeIdRef.current) {
        return;
      }
      if (data.phaseChangeId) phaseChangeIdRef.current = data.phaseChangeId;
      setSessionData(prev => prev ? { ...prev, currentPhase: data.phase, phaseChangeId: data.phaseChangeId ?? prev.phaseChangeId, hasAnswered: false, phaseSelectedIndices: data.phaseSelectedIndices, pairs: data.pairs ?? null, gameState: data.gameState ?? null, phaseRestored: data.phaseRestored ?? false, resumePhase: data.resumePhase, activeSentenceIndex: data.activeSentenceIndex, flagCounts: data.flagCounts ?? {} } : null);
      setPhaseReadOnly(Boolean(data.phaseRestored));
      setFlagCounts(data.flagCounts || {});
      setHasAnswered(false);
      hasAnsweredRef.current = false;
      setQuestionEnded(false);
      setMissedQuestion(false);
      setIsEveryoneReady(false);
      setAiFeedback(null);
      setLanguageAnswer(null);
      submissionPendingRef.current = false;
      setSubmissionError(null);
      // Sentence flags reset at the start of a fresh instructional cycle
      if (data.phase === 1) setFlagCounts({});
    });

    newSocket.on('active_sentence_synced', (data: { activeSentenceIndex: number }) => {
      setSessionData(prev => prev ? { ...prev, activeSentenceIndex: data.activeSentenceIndex } : null);
    });

    newSocket.on('flags_updated', (data: { flagCounts: Record<number, number> }) => {
      setFlagCounts(data.flagCounts || {});
    });

    newSocket.on('answer_received', (data: { success?: boolean; code?: string; message?: string }) => {
      submissionPendingRef.current = false;
      if (data?.success === false) {
        setSubmissionError(data.message || getAnswerSubmissionMessage(data.code));
        return;
      }
      setSubmissionError(null);
      setHasAnswered(true);
      hasAnsweredRef.current = true;
    });

    newSocket.on('ai_evaluation_result', (data: { aiScore: number; aiFeedback: string }) => {
      setAiFeedback({
        score: data.aiScore,
        feedback: data.aiFeedback
      });
    });

    newSocket.on('language_answer_result', (data: { question: string; answer: string }) => {
      setLanguageAnswer(data);
    });

    const handleGameState = (data: { gameState: GamePhaseState }) => {
      setSessionData(prev => prev ? { ...prev, gameState: data.gameState } : prev);
      if (data.gameState.results?.[studentId]) {
        setHasAnswered(true);
        hasAnsweredRef.current = true;
      }
    };

    newSocket.on('game_state_changed', handleGameState);
    newSocket.on('game_votes_updated', handleGameState);
    newSocket.on('game_results_updated', handleGameState);

      } catch {
        if (!cancelled) setError("Could not prepare the lesson session.");
      }
    };

    void init();
    return () => {
      cancelled = true;
      submissionPendingRef.current = false;
      activeSocket?.disconnect();
      if (socketRef.current === activeSocket) {
        socketRef.current = null;
        setSocket(null);
      }
      phaseChangeIdRef.current = null;
    };
  }, [classId, studentId, name, pictureUrl]);

  const submitAnswer = (answer: string, question?: string, expectedAnswer?: string) => {
    if (phaseReadOnly || hasAnsweredRef.current || submissionPendingRef.current) return;
    if (socketRef.current && sessionData) {
      submissionPendingRef.current = true;
      setSubmissionError(null);
      socketRef.current.emit('submit_answer', { 
        sessionId: sessionData.sessionId, 
        studentId, 
        answer,
        question,
        expectedAnswer
      });
    }
  };

  const toggleReady = () => {
    if (phaseReadOnly) return;
    if (socketRef.current && sessionData) {
      socketRef.current.emit('toggle_ready', {
        sessionId: sessionData.sessionId,
        studentId
      });
    }
  };

  const flagSentence = (sentenceIndex: number) => {
    if (phaseReadOnly) return;
    if (socketRef.current && sessionData) {
      socketRef.current.emit('flag_sentence', {
        sessionId: sessionData.sessionId,
        studentId,
        sentenceIndex,
      });
    }
  };

  const submitGameVote = (gameId: string) => {
    if (phaseReadOnly) return;
    if (socketRef.current && sessionData) {
      socketRef.current.emit('submit_game_vote', {
        sessionId: sessionData.sessionId,
        gameId,
      });
    }
  };

  const submitGameResult = (result: { gameId: string; score: number; correct?: number; total?: number; durationMs?: number }) => {
    if (phaseReadOnly) return;
    if (socketRef.current && sessionData) {
      socketRef.current.emit('submit_game_result', {
        sessionId: sessionData.sessionId,
        result,
      });
    }
  };

  return {
    socket,
    sessionData,
    articleData,
    participants,
    error,
    paymentRequired,
    hasAnswered,
    questionEnded,
    missedQuestion,
    isEveryoneReady,
    aiFeedback,
    nudgeMessage,
    kicked,
    flagCounts,
    languageAnswer,
    submissionError,
    submitAnswer,
    toggleReady,
    flagSentence,
    submitGameVote,
    submitGameResult,
    phaseReadOnly,
  };
};
