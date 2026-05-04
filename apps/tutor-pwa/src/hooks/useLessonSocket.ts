import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_LEARNING_SERVICE_URL || 'http://localhost:3002';

export const useLessonSocket = (tutorId: string, articleId: string, classId?: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionData, setSessionData] = useState<{ sessionId: string; pin: string; currentPhase: number; articleData?: any } | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [allAnsweredData, setAllAnsweredData] = useState<any[]>([]);
  const [articleData, setArticleData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Don't initialize if no articleId
    if (!articleId) return;

    // Initialize socket connection
    const newSocket = io(SOCKET_URL);
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to Learning Service WebSocket');
      // Auto create session on connect for Tutor with the selected article and classId
      newSocket.emit('create_session', { tutorId, articleId, classId });
    });

    newSocket.on('session_created', (data) => {
      setSessionData(data);
      setArticleData(data.articleData);
    });

    // Updated to listen for participants_updated from the new backend logic
    newSocket.on('participants_updated', (data) => {
      setParticipants(data.participants);
    });

    // Keep old events for fallback
    newSocket.on('participant_joined', (data) => {
      setParticipants(data.participants);
    });

    newSocket.on('participant_left', (data) => {
      setParticipants(data.participants);
    });

    newSocket.on('phase_changed', (data) => {
      console.log(`[Socket] Phase changed to: ${data.phase}`);
      setSessionData(prev => prev ? { ...prev, currentPhase: data.phase } : null);
      setTotalAnswered(0);
      setAllAnsweredData([]);
    });

    newSocket.on('participant_answered', (data) => {
      console.log(`[Socket] Participant answered: ${data.studentId}, Total: ${data.totalAnswered}`);
      setTotalAnswered(data.totalAnswered);
    });

    newSocket.on('all_answered', (data) => {
      console.log(`[Socket] All participants answered!`, data.answers);
      setAllAnsweredData(data.answers);
    });

    newSocket.on('error', (data) => {
      setError(data.message);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [tutorId, articleId, classId]);

  const changePhase = (phase: number) => {
    if (socketRef.current && sessionData) {
      socketRef.current.emit('change_phase', { sessionId: sessionData.sessionId, phase });
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

  return {
    socket,
    sessionData,
    participants,
    totalAnswered,
    allAnsweredData,
    articleData,
    error,
    changePhase,
    nudgeStudent,
    kickStudent
  };
};
