import { useEffect, useRef, useState } from 'react';
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

export const useLessonSocket = (
  tutorId: string,
  articleId: string,
  classId?: string,
  socketUrl?: string,
  classBookCycleId?: string,
  bookId?: string,
  demo?: boolean,
) => {
  const lessonSocketUrl = socketUrl || 'http://localhost:3002';
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionData, setSessionData] = useState<TutorSessionData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [allAnsweredData, setAllAnsweredData] = useState<AnswerData[]>([]);
  const [articleData, setArticleData] = useState<ArticleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flagCounts, setFlagCounts] = useState<Record<number, number>>({});

  const socketRef = useRef<Socket | null>(null);
  const sessionDataRef = useRef<TutorSessionData | null>(null);

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

    const initSocket = async () => {
      try {
        setError(null);
        const token = await getTutorSessionToken();

        if (!token) {
          setError("Please sign in as a tutor before opening the live lesson lobby.");
          return;
        }
        const socketInstance = io(lessonSocketUrl, {
          auth: { token },
          path: '/socket.io',
          addTrailingSlash: false,
        });
        newSocket = socketInstance;
        
        socketRef.current = socketInstance;
        setSocket(socketInstance);

        socketInstance.on('connect', () => {
          // Auto create session on connect for Tutor with the selected article and classId.
          // Demo mode runs a free, fixed preview with no class/DB/AI on the backend.
          socketInstance.emit('create_session', { tutorId, articleId, classId, classBookCycleId, bookId, demo });
        });

        socketInstance.on('connect_error', (err) => {
          setError(err.message || 'Could not connect to the learning service.');
        });

        socketInstance.on('session_created', (data) => {
          sessionDataRef.current = data;
          setSessionData(data);
          setArticleData(data.articleData);
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

        socketInstance.on('phase_changed', (data) => {
          setSessionData(prev => {
            const next = prev ? { ...prev, currentPhase: data.phase, phaseSelectedIndices: data.phaseSelectedIndices, pairs: data.pairs ?? null, gameState: data.gameState ?? null } : null;
            sessionDataRef.current = next;
            return next;
          });
          setTotalAnswered(0);
          setAllAnsweredData([]);
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

    initSocket();

    return () => {
      const activeSession = sessionDataRef.current;
      if (newSocket) {
        if (activeSession) {
          newSocket.emit('delete_session', { sessionId: activeSession.sessionId });
          sessionDataRef.current = null;
        }
        newSocket.disconnect();
      }
      if (socketRef.current === newSocket) {
        socketRef.current = null;
      }
    };
  }, [tutorId, articleId, classId, classBookCycleId, bookId, demo, lessonSocketUrl]);

  const changePhase = (phase: number) => {
    if (socketRef.current && sessionData) {
      socketRef.current.emit('change_phase', { sessionId: sessionData.sessionId, phase });
    }
  };

  const syncActiveSentence = (index: number) => {
    if (socketRef.current && sessionData) {
      socketRef.current.emit('sync_active_sentence', { sessionId: sessionData.sessionId, index });
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

  return {
    socket,
    sessionData,
    participants,
    totalAnswered,
    allAnsweredData,
    articleData,
    error,
    flagCounts,
    changePhase,
    syncActiveSentence,
    startGameVote,
    lockGameVote,
    startGameCountdown,
    nudgeStudent,
    kickStudent,
    deleteSession
  };
};
