import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const getSocketUrl = () => {
  const configuredUrl = process.env.NEXT_PUBLIC_LEARNING_SERVICE_URL;

  if (typeof window === 'undefined') {
    return configuredUrl || 'http://localhost:3002';
  }

  if (!configuredUrl) {
    return window.location.origin;
  }

  const configuredHost = new URL(configuredUrl).hostname;
  const pageHost = window.location.hostname;
  const isPageOnLocalhost = pageHost === 'localhost' || pageHost === '127.0.0.1';
  const isConfiguredLocalhost = configuredHost === 'localhost' || configuredHost === '127.0.0.1';

  return isConfiguredLocalhost && !isPageOnLocalhost ? window.location.origin : configuredUrl;
};

interface LessonSessionData {
  sessionId: string;
  currentPhase: number;
  phaseSelectedIndices?: Record<number, number>;
  articleData?: LessonArticleData;
}

interface LessonParticipant {
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
  definition?: {
    th?: string;
  };
  translation?: string;
}

interface LessonSentence {
  sentences: string;
}

interface LessonArticleData {
  multipleChoiceQuestions?: LessonQuestion[];
  shortAnswerQuestions?: LessonQuestion[];
  words?: LessonWord[];
  sentences?: Array<string | LessonSentence>;
}

export const useLessonSocket = (classId: string | undefined, studentId: string, name: string, pictureUrl?: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionData, setSessionData] = useState<LessonSessionData | null>(null);
  const [articleData, setArticleData] = useState<LessonArticleData | null>(null);
  const [participants, setParticipants] = useState<LessonParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<{ score: number; feedback: string } | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isEveryoneReady, setIsEveryoneReady] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState<string | null>(null);
  const [kicked, setKicked] = useState<string | null>(null);
  
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!classId || !studentId) return;

    const token = typeof window !== "undefined"
      ? localStorage.getItem("student_session_token")
      : null;
    const newSocket = io(getSocketUrl(), {
      auth: token ? { token } : undefined,
      path: '/socket.io',
      addTrailingSlash: false,
      timeout: 8000,
    });
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setError(null);
      console.log('Connected to Learning Service WebSocket');
      newSocket.emit('join_class', { classId, studentId, name, pictureUrl });
    });

    newSocket.on('connect_error', (err) => {
      setError(err.message || 'Could not connect to the learning service.');
    });

    newSocket.on('join_success', (data: LessonSessionData) => {
      setSessionData(data);
      setArticleData(data.articleData ?? null);
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
    });

    newSocket.on('error', (data: { message: string }) => {
      setError(data.message);
    });

    newSocket.on('phase_changed', (data: { phase: number; phaseSelectedIndices?: Record<number, number> }) => {
      setSessionData(prev => prev ? { ...prev, currentPhase: data.phase, phaseSelectedIndices: data.phaseSelectedIndices } : null);
      setHasAnswered(false);
      setIsEveryoneReady(false);
      setAiFeedback(null);
    });

    newSocket.on('answer_received', () => {
      setHasAnswered(true);
    });

    newSocket.on('ai_evaluation_result', (data: { aiScore: number; aiFeedback: string }) => {
      setAiFeedback({
        score: data.aiScore,
        feedback: data.aiFeedback
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, [classId, studentId, name, pictureUrl]);

  const submitAnswer = (answer: string, question?: string, expectedAnswer?: string) => {
    if (socketRef.current && sessionData) {
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
    if (socketRef.current && sessionData) {
      socketRef.current.emit('toggle_ready', {
        sessionId: sessionData.sessionId,
        studentId
      });
    }
  };

  return {
    socket,
    sessionData,
    articleData,
    participants,
    error,
    hasAnswered,
    isEveryoneReady,
    aiFeedback,
    nudgeMessage,
    kicked,
    submitAnswer,
    toggleReady
  };
};
