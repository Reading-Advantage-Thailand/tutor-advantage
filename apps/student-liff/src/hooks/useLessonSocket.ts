import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_LEARNING_SERVICE_URL || 'http://localhost:3002';

export const useLessonSocket = (pin: string | null, studentId: string, name: string, classId?: string, pictureUrl?: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionData, setSessionData] = useState<{ sessionId: string; currentPhase: number; pin?: string; phaseSelectedIndices?: Record<number, number> } | null>(null);
  const [articleData, setArticleData] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<{ score: number; feedback: string } | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isEveryoneReady, setIsEveryoneReady] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState<string | null>(null);
  const [kicked, setKicked] = useState<string | null>(null);
  
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if ((!pin && !classId) || !studentId) return;

    const newSocket = io(SOCKET_URL);
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

    newSocket.on('join_success', (data) => {
      setSessionData(data);
      setArticleData(data.articleData);
    });

    newSocket.on('participants_updated', (data) => {
      setParticipants(data.participants);
    });

    newSocket.on('nudge_received', (data) => {
      setNudgeMessage(data.message);
      // Clear nudge after 5 seconds
      setTimeout(() => setNudgeMessage(null), 5000);
    });

    newSocket.on('kicked', (data) => {
      setKicked(data.message);
      newSocket.disconnect();
    });

    newSocket.on('all_answered_broadcast', () => {
      setIsEveryoneReady(true);
    });

    newSocket.on('error', (data) => {
      setError(data.message);
    });

    newSocket.on('phase_changed', (data) => {
      setSessionData(prev => prev ? { ...prev, currentPhase: data.phase, phaseSelectedIndices: data.phaseSelectedIndices } : null);
      setHasAnswered(false);
      setIsEveryoneReady(false);
      setAiFeedback(null);
    });

    newSocket.on('answer_received', () => {
      setHasAnswered(true);
    });

    newSocket.on('ai_evaluation_result', (data) => {
      setAiFeedback({
        score: data.aiScore,
        feedback: data.aiFeedback
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, [pin, studentId, name, classId]);

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
