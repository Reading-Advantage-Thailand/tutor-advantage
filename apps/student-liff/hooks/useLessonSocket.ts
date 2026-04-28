import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_LEARNING_SERVICE_URL || 'http://localhost:3002';

export const useLessonSocket = (pin: string, studentId: string, name: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionData, setSessionData] = useState<{ sessionId: string; currentPhase: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<{ score: number; feedback: string } | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!pin || !studentId) return;

    const newSocket = io(SOCKET_URL);
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to Learning Service WebSocket');
      newSocket.emit('join_session', { pin, studentId, name });
    });

    newSocket.on('join_success', (data) => {
      setSessionData(data);
    });

    newSocket.on('error', (data) => {
      setError(data.message);
    });

    newSocket.on('phase_changed', (data) => {
      setSessionData(prev => prev ? { ...prev, currentPhase: data.phase } : null);
      setHasAnswered(false);
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
  }, [pin, studentId, name]);

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

  return {
    socket,
    sessionData,
    error,
    hasAnswered,
    aiFeedback,
    submitAnswer
  };
};
