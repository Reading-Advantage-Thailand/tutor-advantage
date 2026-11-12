import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getLessonErrorKind } from '../components/lesson/lessonConnection';
import { setLiveRoundStartedAt } from '../lib/games/roundClock';

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
  /** Server time when play began. */
  playingStartedAt?: number;
  /** Server time when this state was sent, for a phone with a wrong clock. */
  serverNow?: number;
}

type GameResultPayload = { gameId: string; score: number; correct?: number; total?: number; durationMs?: number };

// How often a student whose room ended asks whether it has come back, and for how
// long. A tutor who was cut off usually reopens the room within minutes.
const ROOM_RETURN_CHECK_MS = 20_000;
const ROOM_RETURN_WATCH_MS = 30 * 60_000;

export interface LessonSessionData {
  sessionId: string;
  classBookCycleId?: string;
  currentStudentId?: string;
  currentPhase: number;
  phaseVersion?: number;
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
  tutorAway?: boolean;
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
  // True when the tutor removed this student (they may rejoin); false when the room closed.
  const [removedByTutor, setRemovedByTutor] = useState(false);
  const [flagCounts, setFlagCounts] = useState<Record<number, number>>({});
  const [languageAnswer, setLanguageAnswer] = useState<{ question: string; answer: string } | null>(null);
  const [phaseReadOnly, setPhaseReadOnly] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  // The socket dropped and is reconnecting. Nothing is lost, so no alarm is needed.
  const [connectionLost, setConnectionLost] = useState(false);
  // The tutor's connection is gone; the room stays open for them to return.
  const [tutorAway, setTutorAway] = useState(false);
  // The room ended without the tutor finishing the lesson, so it may come back.
  const [roomInterrupted, setRoomInterrupted] = useState(false);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const hasAnsweredRef = useRef(false);
  const submissionPendingRef = useRef(false);
  const phaseVersionRef = useRef(0);
  const phaseChangeIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const roomReturnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastGameResultRef = useRef<{ key: string; result: GameResultPayload } | null>(null);

  useEffect(() => {
    hasAnsweredRef.current = hasAnswered;
  }, [hasAnswered]);

  useEffect(() => {
    if (!classId || !studentId) return;

    let activeSocket: Socket | null = null;
    let cancelled = false;
    const stopWatchingForRoom = () => {
      if (roomReturnTimerRef.current) clearInterval(roomReturnTimerRef.current);
      roomReturnTimerRef.current = null;
    };
    // Keep asking whether the room is open, so a student goes in by themselves
    // when the tutor opens it or comes back. join_success stops this.
    const watchForRoom = (socket: Socket) => {
      if (roomReturnTimerRef.current) return;
      const watchStartedAt = Date.now();
      roomReturnTimerRef.current = setInterval(() => {
        if (Date.now() - watchStartedAt > ROOM_RETURN_WATCH_MS) {
          stopWatchingForRoom();
          return;
        }
        if (socket.connected) socket.emit('join_class', { classId, studentId, name, pictureUrl });
      }, ROOM_RETURN_CHECK_MS);
    };
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
      setConnectionLost(false);
      newSocket.emit('join_class', { classId, studentId, name, pictureUrl });
    });

    newSocket.on('connect_error', (err) => {
      if (cancelled) return;
      setError(err.message || 'Could not connect to the learning service.');
    });

    newSocket.on('disconnect', (reason) => {
      const wasSubmitting = submissionPendingRef.current;
      submissionPendingRef.current = false;
      if (cancelled || reason === 'io client disconnect') return;
      setConnectionLost(true);
      // Only an answer lost on the way needs saying out loud.
      if (wasSubmitting) setSubmissionError('การเชื่อมต่อห้องเรียนขาดหาย ระบบกำลังเชื่อมต่อใหม่');
    });

    newSocket.on('join_success', (data: LessonSessionData) => {
      setPaymentRequired(null);
      const hasPhaseVersion = Number.isInteger(data.phaseVersion) && Number(data.phaseVersion) >= 0;
      const incomingPhaseVersion = hasPhaseVersion
        ? Number(data.phaseVersion)
        : 0;
      const isSameRoom = sessionIdRef.current === data.sessionId;
      if (isSameRoom && (incomingPhaseVersion < phaseVersionRef.current || (!hasPhaseVersion && phaseVersionRef.current > 0))) {
        // A reconnect response can race with a newer phase event already
        // received on this socket. Never let that older snapshot move the
        // student back to a previous question. A new room counts from zero.
        return;
      }
      sessionIdRef.current = data.sessionId;
      stopWatchingForRoom();
      setKicked(null);
      setRoomInterrupted(false);
      setError(null);
      setTutorAway(Boolean(data.tutorAway));
      const incomingGame = data.gameState;
      if (typeof incomingGame?.serverNow === 'number') setClockOffsetMs(incomingGame.serverNow - Date.now());
      // Joined a round already running: play the time left, not a fresh round.
      // A game whose clock is already running (a socket reconnect) is unaffected.
      setLiveRoundStartedAt(
        incomingGame?.status === 'playing' && incomingGame.playingStartedAt && incomingGame.serverNow
          ? performance.now() - Math.max(0, incomingGame.serverNow - incomingGame.playingStartedAt)
          : null,
      );
      // A result sent just as the connection died may never have arrived.
      const lastResult = lastGameResultRef.current;
      if (
        lastResult &&
        incomingGame &&
        lastResult.key === `${incomingGame.phase}:${incomingGame.selectedGameId || ''}` &&
        ['playing', 'results'].includes(incomingGame.status) &&
        !incomingGame.results?.[data.currentStudentId || studentId]
      ) {
        newSocket.emit('submit_game_result', { sessionId: data.sessionId, result: lastResult.result });
      }
      phaseVersionRef.current = incomingPhaseVersion;
      phaseChangeIdRef.current = typeof data.phaseChangeId === 'string'
        ? data.phaseChangeId
        : null;
      const answered = Boolean(data.hasAnswered);
      setSessionData(data);
      // Keep the same object on a reconnect: a game restarts its round when its
      // words change identity.
      setArticleData((previous) => (isSameRoom && previous ? previous : data.articleData ?? null));
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
      setRemovedByTutor(true);
      newSocket.disconnect();
    });

    newSocket.on('session_deleted', (data: { message: string; reason?: string }) => {
      setKicked(data.message);
      setRemovedByTutor(false);
      setTutorAway(false);
      if (!data.reason || data.reason === 'finished') {
        newSocket.disconnect();
        return;
      }
      // The room ended without the lesson finishing: go back in if it returns.
      setRoomInterrupted(true);
      watchForRoom(newSocket);
    });

    newSocket.on('tutor_away', () => setTutorAway(true));
    newSocket.on('tutor_back', () => setTutorAway(false));

    newSocket.on('all_answered_broadcast', () => {
      setIsEveryoneReady(true);
      setQuestionEnded(true);
      setMissedQuestion(!hasAnsweredRef.current);
    });

    newSocket.on('error', (data: { message: string }) => {
      setError(data.message);
      if (getLessonErrorKind(data.message) === 'notStarted') watchForRoom(newSocket);
    });

    newSocket.on('payment_required', (data: PaymentRequiredData) => {
      setError(null);
      setPaymentRequired(data);
    });

    newSocket.on('phase_changed', (data: { phase: number; phaseVersion?: number; phaseChangeId?: string; phaseSelectedIndices?: Record<number, number>; pairs?: LessonPair[] | null; gameState?: GamePhaseState | null; phaseRestored?: boolean; resumePhase?: number; activeSentenceIndex?: number; flagCounts?: Record<number, number> }) => {
      if (cancelled || socketRef.current !== newSocket || !newSocket.connected) return;
      const hasPhaseVersion = Number.isInteger(data.phaseVersion) && Number(data.phaseVersion) >= 0;
      const incomingPhaseVersion = hasPhaseVersion ? Number(data.phaseVersion) : undefined;
      if (incomingPhaseVersion !== undefined) {
        if (
          incomingPhaseVersion < phaseVersionRef.current ||
          (incomingPhaseVersion === phaseVersionRef.current && incomingPhaseVersion > 0)
        ) return;
        phaseVersionRef.current = incomingPhaseVersion;
      } else if (phaseVersionRef.current > 0) {
        // Do not allow an old unversioned event from a rolling deployment to
        // move a client backwards after it has joined the versioned protocol.
        return;
      }
      if (data.phaseChangeId && data.phaseChangeId === phaseChangeIdRef.current) {
        return;
      }
      if (data.phaseChangeId) phaseChangeIdRef.current = data.phaseChangeId;
      setSessionData(prev => prev ? { ...prev, currentPhase: data.phase, phaseVersion: incomingPhaseVersion ?? prev.phaseVersion, phaseChangeId: data.phaseChangeId ?? prev.phaseChangeId, hasAnswered: false, phaseSelectedIndices: data.phaseSelectedIndices, pairs: data.pairs ?? null, gameState: data.gameState ?? null, phaseRestored: data.phaseRestored ?? false, resumePhase: data.resumePhase, activeSentenceIndex: data.activeSentenceIndex, flagCounts: data.flagCounts ?? {} } : null);
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
      setLiveRoundStartedAt(null);
      if (typeof data.gameState?.serverNow === 'number') setClockOffsetMs(data.gameState.serverNow - Date.now());
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
      if (typeof data.gameState.serverNow === 'number') setClockOffsetMs(data.gameState.serverNow - Date.now());
      if (data.gameState.status !== 'playing') setLiveRoundStartedAt(null);
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
      stopWatchingForRoom();
      setLiveRoundStartedAt(null);
      activeSocket?.disconnect();
      if (socketRef.current === activeSocket) {
        socketRef.current = null;
        setSocket(null);
      }
      phaseChangeIdRef.current = null;
      phaseVersionRef.current = 0;
      sessionIdRef.current = null;
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

  const submitGameResult = (result: GameResultPayload) => {
    if (phaseReadOnly) return;
    if (socketRef.current && sessionData) {
      const game = sessionData.gameState;
      if (game) lastGameResultRef.current = { key: `${game.phase}:${game.selectedGameId || ''}`, result };
      socketRef.current.emit('submit_game_result', {
        sessionId: sessionData.sessionId,
        result,
      });
    }
  };

  // Reconnect after the tutor removed this student: the `connect` handler
  // sends a fresh join_class, which puts them back with their score.
  const rejoin = () => {
    setKicked(null);
    setRemovedByTutor(false);
    setRoomInterrupted(false);
    if (socketRef.current?.connected) {
      socketRef.current.emit('join_class', { classId, studentId, name, pictureUrl });
    } else {
      socketRef.current?.connect();
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
    removedByTutor,
    roomInterrupted,
    tutorAway,
    connectionLost,
    clockOffsetMs,
    rejoin,
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
