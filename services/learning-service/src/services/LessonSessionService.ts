import { v4 as uuidv4 } from "uuid";

export interface SessionParticipant {
  studentId: string;
  name: string;
  pictureUrl?: string; // Added pictureUrl
  socketId: string;
  score: number;
  hasAnsweredCurrentPhase: boolean;
  latestAnswer?: any;
  isReady: boolean; // Added isReady status
}

export interface LessonSession {
  sessionId: string;
  pin: string;
  classId?: string; // Added classId
  tutorId: string;
  tutorSocketId: string;
  articleId: string;
  articleData: any;
  currentPhase: number;
  participants: Map<string, SessionParticipant>;
  status: 'LOBBY' | 'ACTIVE' | 'FINISHED';
}

class LessonSessionService {
  private sessions: Map<string, LessonSession> = new Map();
  private pinToSessionId: Map<string, string> = new Map();
  private classToSessionId: Map<string, string> = new Map(); // Map classId to active session

  createSession(tutorId: string, tutorSocketId: string, articleId: string, articleData: any, classId?: string): LessonSession {
    // If a session for this class already exists, reuse it and update tutor's socket
    if (classId) {
      const existingSession = this.getSessionByClassId(classId);
      if (existingSession && existingSession.status !== 'FINISHED') {
        console.log(`[Service] Reusing existing session ${existingSession.sessionId} for class ${classId}`);
        existingSession.tutorSocketId = tutorSocketId;
        existingSession.articleId = articleId;
        existingSession.articleData = articleData;
        return existingSession;
      }
    }

    const sessionId = uuidv4();
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    
    const session: LessonSession = {
      sessionId,
      pin,
      classId,
      tutorId,
      tutorSocketId,
      articleId,
      articleData,
      currentPhase: 1,
      participants: new Map(),
      status: 'LOBBY'
    };

    this.sessions.set(sessionId, session);
    this.pinToSessionId.set(pin, sessionId);
    if (classId) {
      this.classToSessionId.set(classId, sessionId);
    }

    console.log(`[Service] Created NEW session ${sessionId} (PIN: ${pin}) for class ${classId}`);
    return session;
  }

  getSessionByPin(pin: string): LessonSession | undefined {
    const sessionId = this.pinToSessionId.get(pin);
    if (!sessionId) return undefined;
    return this.sessions.get(sessionId);
  }

  getSessionByClassId(classId: string): LessonSession | undefined {
    const sessionId = this.classToSessionId.get(classId);
    if (!sessionId) return undefined;
    return this.sessions.get(sessionId);
  }

  getSession(sessionId: string): LessonSession | undefined {
    return this.sessions.get(sessionId);
  }

  joinSession(pin: string, studentId: string, name: string, socketId: string, pictureUrl?: string): LessonSession | undefined {
    const session = this.getSessionByPin(pin);
    if (!session) return undefined;

    session.participants.set(studentId, {
      studentId,
      name,
      pictureUrl,
      socketId,
      score: 0,
      hasAnsweredCurrentPhase: false,
      isReady: false
    });

    return session;
  }

  joinSessionByClassId(classId: string, studentId: string, name: string, socketId: string, pictureUrl?: string): LessonSession | undefined {
    const session = this.getSessionByClassId(classId);
    if (!session) return undefined;

    session.participants.set(studentId, {
      studentId,
      name,
      pictureUrl,
      socketId,
      score: 0,
      hasAnsweredCurrentPhase: false,
      isReady: false
    });

    return session;
  }

  toggleReady(sessionId: string, studentId: string): LessonSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const participant = session.participants.get(studentId);
    if (participant) {
      participant.isReady = !participant.isReady;
    }
    return session;
  }

  removeParticipantBySocketId(socketId: string) {
    for (const [sessionId, session] of this.sessions.entries()) {
      for (const [studentId, participant] of session.participants.entries()) {
        if (participant.socketId === socketId) {
          session.participants.delete(studentId);
          return { sessionId, studentId };
        }
      }
    }
    return null;
  }

  setPhase(sessionId: string, phase: number): LessonSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.currentPhase = phase;
    for (const participant of session.participants.values()) {
      participant.hasAnsweredCurrentPhase = false;
      participant.latestAnswer = undefined;
    }

    if (phase > 1) {
      session.status = 'ACTIVE';
    }

    return session;
  }

  submitAnswer(sessionId: string, studentId: string, answer: any): { session: LessonSession, allAnswered: boolean } | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const participant = session.participants.get(studentId);
    if (!participant) return undefined;

    // Normalize answer (trim whitespace, convert to string if MCQ)
    const normalizedAnswer = typeof answer === 'string' ? answer.trim() : answer;
    
    participant.hasAnsweredCurrentPhase = true;
    participant.latestAnswer = normalizedAnswer;

    let allAnswered = true;
    if (session.participants.size === 0) {
      allAnswered = false;
    } else {
      for (const p of session.participants.values()) {
        if (!p.hasAnsweredCurrentPhase) {
          allAnswered = false;
          break;
        }
      }
    }

    return { session, allAnswered };
  }
}

export const lessonSessionService = new LessonSessionService();
