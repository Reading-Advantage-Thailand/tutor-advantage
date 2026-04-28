import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_LEARNING_SERVICE_URL || 'http://localhost:3002';

export const useLessonSocket = (tutorId: string, articleId: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionData, setSessionData] = useState<{ sessionId: string; pin: string; currentPhase: number } | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [allAnsweredData, setAllAnsweredData] = useState<any[]>([]);
  
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(SOCKET_URL);
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to Learning Service WebSocket');
      // Auto create session on connect for Tutor
      newSocket.emit('create_session', { tutorId, articleId });
    });

    newSocket.on('session_created', (data) => {
      setSessionData(data);
    });

    newSocket.on('participant_joined', (data) => {
      setParticipants(data.participants);
    });

    newSocket.on('participant_left', (data) => {
      setParticipants(data.participants);
    });

    newSocket.on('phase_changed', (data) => {
      setSessionData(prev => prev ? { ...prev, currentPhase: data.phase } : null);
      setTotalAnswered(0);
      setAllAnsweredData([]);
    });

    newSocket.on('participant_answered', (data) => {
      setTotalAnswered(data.totalAnswered);
    });

    newSocket.on('all_answered', (data) => {
      setAllAnsweredData(data.answers);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [tutorId, articleId]);

  const changePhase = (phase: number) => {
    if (socketRef.current && sessionData) {
      socketRef.current.emit('change_phase', { sessionId: sessionData.sessionId, phase });
    }
  };

  return {
    socket,
    sessionData,
    participants,
    totalAnswered,
    allAnsweredData,
    changePhase
  };
};
