import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getTutorSessionToken } from '../app/dashboard/actions';
import { t } from '@/lib/i18n';


import {
  Participant,
  TutorSessionData,
  AnswerData,
  ArticleData,
  GamePhaseState,
} from '@/lib/lesson-types';

type PhaseChangeResult = {
  ok?: boolean;
  phase?: number;
  code?: string;
  message?: string;
};

const PHASE_CHANGE_TIMEOUT_MS = 8_000;

export const useLessonSocket = (
  tutorId: string,
  articleId: string,
  classId?: string,
  socketUrl?: string,
  classBookCycleId?: string,
  bookId?: string,
  demo?: boolean
) => {
  const getEffectiveSocketUrl = () => {
    const candidate = socketUrl || process.env.NEXT_PUBLIC_LEARNING_SERVICE_URL || 'http://localhost:3002';
    if (typeof window === 'undefined') return candidate;

    if (!candidate || candidate === '/' || candidate === window.location.origin) {
      return 'http://localhost:3002';
    }

    try {
      const url = new URL(candidate, window.location.origin);
      if (url.port === '3000' && window.location.port === '3000') {
        return `${url.protocol}//${url.hostname}:3002`;
      }
      return candidate;
    } catch {
      return candidate;
    }
  };

  const lessonSocketUrl = getEffectiveSocketUrl();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionData, setSessionData] = useState<TutorSessionData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [allAnsweredData, setAllAnsweredData] = useState<AnswerData[]>([]);
  const [questionEnded, setQuestionEnded] = useState(false);
  const [articleData, setArticleData] = useState<ArticleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flagCounts, setFlagCounts] = useState<Record<number, number>>({});

  const socketRef = useRef<Socket | null>(null);
  const sessionDataRef = useRef<TutorSessionData | null>(null);
  const finishRequestRef = useRef<Promise<boolean> | null>(null);
  const sessionReadyRef = useRef(false);
  const phaseVersionRef = useRef(0);
  const phaseChangeIdRef = useRef<string | null>(null);
  const phaseChangeInFlightRef = useRef<Promise<boolean> | null>(null);
  const phaseChangeRequestIdRef = useRef(0);
  const phaseChangeCancelRef = useRef<(() => void) | null>(null);
  const invalidatePhaseChange = useCallback(() => {
    phaseChangeCancelRef.current?.();
    phaseChangeCancelRef.current = null;
    phaseChangeRequestIdRef.current += 1;
    phaseChangeInFlightRef.current = null;
  }, []);

  useEffect(() => {
    sessionDataRef.current = sessionData;
  }, [sessionData]);

  useEffect(() => {
    // An explicit articleId is required unless a class is given — demo classes
    // are pinned to their book's first article on the server.
    if (!articleId && !classId) {
      setError("Missing article ID for this lesson.");
      return;
    }

    let newSocket: Socket | null = null;
    let cancelled = false;

    const initSocket = async () => {
      try {
        setError(null);
        const token = await getTutorSessionToken();

        if (cancelled) return;

        if (!token) {
          setError("Please sign in as a tutor before opening the live lesson lobby.");
          return;
        }
        const socketInstance = io(lessonSocketUrl, {
          // The lesson token is intentionally short-lived. Refresh it for
          // every handshake so a long lesson can recover after a transient
          // network drop instead of losing the tutor's room.
          auth: (callback) => {
            void getTutorSessionToken()
              .then((freshToken) => callback({ token: freshToken || token }))
              .catch(() => callback({ token }));
          },
          path: '/socket.io',
          addTrailingSlash: false,
        });

        if (cancelled) {
          socketInstance.disconnect();
          return;
        }

        newSocket = socketInstance;
        
        socketRef.current = socketInstance;
        setSocket(socketInstance);

        socketInstance.on('connect', () => {
          if (cancelled) return;
          // The socket can reconnect before the async create_session handler
          // finishes. Do not allow stale UI state to issue phase commands in
          // that gap.
          sessionReadyRef.current = false;
          invalidatePhaseChange();
          setError(null);
          // Auto create session on connect for Tutor with the selected article and classId.
          // Demo mode runs a free, fixed preview with no class/DB/AI on the backend.
          socketInstance.emit('create_session', { tutorId, articleId, classId, classBookCycleId, bookId, demo });
        });

        socketInstance.on('connect_error', (err) => {
          setError(err.message || 'Could not connect to the learning service.');
        });

        socketInstance.on('disconnect', () => {
          sessionReadyRef.current = false;
          invalidatePhaseChange();
        });

        socketInstance.on('session_created', (data) => {
          if (cancelled || !socketInstance.connected) return;
          sessionReadyRef.current = true;
          const hasPhaseVersion = Number.isInteger(data.phaseVersion) && Number(data.phaseVersion) >= 0;
          const incomingPhaseVersion = hasPhaseVersion
            ? Number(data.phaseVersion)
            : 0;
          if (incomingPhaseVersion < phaseVersionRef.current || (!hasPhaseVersion && phaseVersionRef.current > 0)) {
            // Do not let a delayed reconnect snapshot overwrite a newer
            // phase event already rendered by this tutor socket.
            return;
          }
          phaseVersionRef.current = incomingPhaseVersion;
          phaseChangeIdRef.current = typeof data.phaseChangeId === 'string'
            ? data.phaseChangeId
            : null;
          sessionDataRef.current = data;
          setSessionData(data);
          setArticleData(data.articleData);
          if (Array.isArray(data.participants)) setParticipants(data.participants);
          setFlagCounts(data.flagCounts || {});
        });

        // Updated to listen for participants_updated from the new backend logic
        socketInstance.on('participants_updated', (data) => {
          setParticipants(data.participants);
        });

        // Keep old events for fallback
        socketInstance.on('participant_joined', (data) => {
          setParticipants(data.participants);
        });

        socketInstance.on('participant_left', (data) => {
          setParticipants(data.participants);
        });

        socketInstance.on('phase_changed', (data: { phase: number; phaseVersion?: number; phaseChangeId?: string; phaseSelectedIndices?: Record<number, number>; pairs?: TutorSessionData['pairs']; gameState?: GamePhaseState | null; phaseRestored?: boolean; resumePhase?: number; activeSentenceIndex?: number; flagCounts?: Record<number, number> }) => {
          if (cancelled || socketRef.current !== socketInstance || !socketInstance.connected) return;
          const hasPhaseVersion = Number.isInteger(data.phaseVersion) && Number(data.phaseVersion) >= 0;
          const incomingPhaseVersion = hasPhaseVersion ? Number(data.phaseVersion) : undefined;
          if (incomingPhaseVersion !== undefined) {
            if (
              incomingPhaseVersion < phaseVersionRef.current ||
              (incomingPhaseVersion === phaseVersionRef.current && incomingPhaseVersion > 0)
            ) return;
            phaseVersionRef.current = incomingPhaseVersion;
          } else if (phaseVersionRef.current > 0) {
            // Ignore an unversioned event from an older rolling deployment.
            return;
          }
          if (data.phaseChangeId && data.phaseChangeId === phaseChangeIdRef.current) {
            return;
          }
          if (data.phaseChangeId) phaseChangeIdRef.current = data.phaseChangeId;
          setSessionData(prev => {
            const next = prev ? { ...prev, currentPhase: data.phase, phaseVersion: incomingPhaseVersion ?? prev.phaseVersion, phaseChangeId: data.phaseChangeId ?? prev.phaseChangeId, phaseSelectedIndices: data.phaseSelectedIndices, pairs: data.pairs ?? null, gameState: data.gameState ?? null, phaseRestored: data.phaseRestored ?? false, resumePhase: data.resumePhase, activeSentenceIndex: data.activeSentenceIndex, flagCounts: data.flagCounts ?? {} } : null;
            sessionDataRef.current = next;
            return next;
          });
          setTotalAnswered(0);
          setAllAnsweredData([]);
          setQuestionEnded(false);
          setFlagCounts(data.flagCounts || {});
          // Sentence flags reset at the start of a fresh instructional cycle
          if (data.phase === 1) setFlagCounts({});
        });

        socketInstance.on('flags_updated', (data) => {
          setFlagCounts(data.flagCounts || {});
        });

        socketInstance.on('participant_answered', (data) => {
          setTotalAnswered(data.totalAnswered);
        });

        socketInstance.on('all_answered', (data) => {
          setAllAnsweredData(data.answers);
          setQuestionEnded(true);
        });

        socketInstance.on('question_ended', (data) => {
          setTotalAnswered(data.totalAnswered ?? data.answers?.length ?? 0);
          setAllAnsweredData(data.answers || []);
          setQuestionEnded(true);
        });

        const handleGameState = (data: { gameState: GamePhaseState }) => {
          setSessionData(prev => {
            const next = prev ? { ...prev, gameState: data.gameState } : prev;
            sessionDataRef.current = next;
            return next;
          });
        };

        socketInstance.on('game_state_changed', handleGameState);
        socketInstance.on('game_votes_updated', handleGameState);
        socketInstance.on('game_results_updated', handleGameState);

        socketInstance.on('error', (data) => {
          setError(data.message);
        });

        socketInstance.on('session_deleted', (data) => {
          sessionDataRef.current = null;
          setSessionData(null);
          setError(t("app.lessonSessionCancelled"));
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not prepare the tutor lesson lobby.');
      }
    };

    void initSocket();

    return () => {
      cancelled = true;
      sessionReadyRef.current = false;
      invalidatePhaseChange();
      phaseChangeIdRef.current = null;
      phaseVersionRef.current = 0;
      if (newSocket) {
        // Disconnecting is not the same as explicitly cancelling a lesson.
        // React can run this cleanup during Strict Mode, route transitions,
        // or a socket reinitialisation. The server owns the disconnect grace
        // period; delete_session is reserved for the explicit close action.
        newSocket.disconnect();
      }
      if (socketRef.current === newSocket) {
        socketRef.current = null;
        setSocket(null);
      }
      sessionDataRef.current = null;
      setSessionData(null);
      setParticipants([]);
      setTotalAnswered(0);
      setAllAnsweredData([]);
      setQuestionEnded(false);
    };
  }, [tutorId, articleId, classId, classBookCycleId, bookId, demo, lessonSocketUrl, invalidatePhaseChange]);

  const changePhase = useCallback((phase: number): Promise<boolean> => {
    const pendingRequest = phaseChangeInFlightRef.current;
    if (pendingRequest) return pendingRequest;
    const activeSocket = socketRef.current;
    const activeSession = sessionDataRef.current;

    if (
      !activeSocket ||
      !activeSession ||
      !activeSocket.connected ||
      !sessionReadyRef.current
    ) {
      setError('The lesson connection is unavailable. Please wait for it to reconnect and try again.');
      return Promise.resolve(false);
    }

    const requestId = ++phaseChangeRequestIdRef.current;
    let resolveRequest!: (ok: boolean) => void;
    const request = new Promise<boolean>((resolve) => {
      resolveRequest = resolve;
    });
    phaseChangeInFlightRef.current = request;

    let settled = false;
    const settle = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (phaseChangeRequestIdRef.current === requestId) {
        phaseChangeInFlightRef.current = null;
        phaseChangeCancelRef.current = null;
      }
      resolveRequest(ok);
    };

    phaseChangeCancelRef.current = () => settle(false);

    const timeout = setTimeout(() => {
      setError('The lesson server did not confirm the phase change. Please check the connection and try again.');
      settle(false);
    }, PHASE_CHANGE_TIMEOUT_MS);

    try {
      activeSocket.emit(
        'change_phase',
        { sessionId: activeSession.sessionId, phase },
        (result?: PhaseChangeResult) => {
          if (!result?.ok) {
            setError(result?.message || 'Could not change the lesson phase. Please try again.');
            settle(false);
            return;
          }
          settle(true);
        },
      );
    } catch {
      setError('Could not send the phase change. Please check the connection and try again.');
      settle(false);
    }

    return request;
  }, []);

  const syncActiveSentence = (index: number) => {
    if (socketRef.current && sessionData) {
      socketRef.current.emit('sync_active_sentence', { sessionId: sessionData.sessionId, index });
    }
  };

  const endQuestion = () => {
    if (socketRef.current && sessionData) {
      socketRef.current.emit('end_question', { sessionId: sessionData.sessionId });
    }
  };

  const startGameVote = (phase?: number) => {
    if (socketRef.current && sessionData) {
      socketRef.current.emit('start_game_vote', { sessionId: sessionData.sessionId, phase: phase ?? sessionData.currentPhase });
    }
  };

  const lockGameVote = () => {
    if (socketRef.current && sessionData) {
      socketRef.current.emit('lock_game_vote', { sessionId: sessionData.sessionId });
    }
  };

  const startGameIntro = (options: { tutorialEnabled: boolean; teacherDemoEnabled: boolean }) => {
    if (socketRef.current && sessionData) {
      socketRef.current.emit('start_game_intro', {
        sessionId: sessionData.sessionId,
        ...options,
      });
    }
  };

  const advanceGameIntro = (durationMs = 5000) => {
    if (socketRef.current && sessionData) {
      socketRef.current.emit('advance_game_intro', {
        sessionId: sessionData.sessionId,
        durationMs,
      });
    }
  };

  const startGameCountdown = (durationMs = 5000) => {
    if (socketRef.current && sessionData) {
      socketRef.current.emit('start_game_countdown', { sessionId: sessionData.sessionId, durationMs });
    }
  };

  const nudgeStudent = (studentId: string) => {
    if (socketRef.current && sessionData) {
      socketRef.current.emit('nudge_student', { sessionId: sessionData.sessionId, studentId });
    }
  };

  const kickStudent = (studentId: string) => {
    if (socketRef.current && sessionData) {
      socketRef.current.emit('kick_student', { sessionId: sessionData.sessionId, studentId });
    }
  };

  const deleteSession = () => {
    const activeSession = sessionDataRef.current;
    if (socketRef.current && activeSession) {
      socketRef.current.emit('delete_session', { sessionId: activeSession.sessionId });
      sessionDataRef.current = null;
      setSessionData(null);
    }
  };

  const finishSession = (): Promise<boolean> => {
    const activeSession = sessionDataRef.current;
    const activeSocket = socketRef.current;
    if (!activeSocket || !activeSession) return Promise.resolve(true);
    if (finishRequestRef.current) return finishRequestRef.current;

    const request = new Promise<boolean>((resolve) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        finishRequestRef.current = null;
        setError('Could not finish the lesson. Please try again while the connection is available.');
        resolve(false);
      }, 5000);

      activeSocket.emit(
        'finish_session',
        { sessionId: activeSession.sessionId },
        (result: { ok?: boolean } | undefined) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          finishRequestRef.current = null;

          if (!result?.ok) {
            setError('Could not finish the lesson. Please try again.');
            resolve(false);
            return;
          }

          // Clear local state before navigation. The server has already
          // persisted FINISHED and removed the live room.
          sessionDataRef.current = null;
          setSessionData(null);
          resolve(true);
        },
      );
    });

    finishRequestRef.current = request;
    return request;
  };

  return {
    socket,
    sessionData,
    participants,
    totalAnswered,
    allAnsweredData,
    questionEnded,
    articleData,
    error,
    flagCounts,
    changePhase,
    syncActiveSentence,
    endQuestion,
    startGameVote,
    lockGameVote,
    startGameIntro,
    advanceGameIntro,
    startGameCountdown,
    nudgeStudent,
    kickStudent,
    deleteSession,
    finishSession
  };
};
