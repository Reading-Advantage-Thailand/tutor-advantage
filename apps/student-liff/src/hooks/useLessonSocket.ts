import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_LEARNING_SERVICE_URL || 'http://localhost:3002';

interface LessonSessionData {
  sessionId: string;
  currentPhase: number;
  pin?: string;
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

export const useLessonSocket = (pin: string | null, studentId: string, name: string, classId?: string, pictureUrl?: string) => {
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
    if ((!pin && !classId) || !studentId) return;

    const token = typeof window !== "undefined"
      ? localStorage.getItem("student_session_token")
      : null;
    const newSocket = io(SOCKET_URL, {
      auth: token ? { token } : undefined,
    });
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to Learning Service WebSocket');
      if (classId) {
        newSocket.emit('join_class', { classId, studentId, name, pictureUrl });
      } else if (pin) {
        newSocket.emit('join_session', { pin, studentId, name, pictureUrl });
      }
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
  }, [pin, studentId, name, classId, pictureUrl]);

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
