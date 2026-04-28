import { v4 as uuidv4 } from "uuid";

export interface SessionParticipant {
  studentId: string;
  name: string;
  socketId: string;
  score: number;
  hasAnsweredCurrentPhase: boolean;
  latestAnswer?: any;
}

export interface LessonSession {
  sessionId: string;
  pin: string;
  tutorId: string;
  tutorSocketId: string;
  articleId: string;
  articleData?: any; // To store fetched article, sentences, words, and questions
  currentPhase: number;
  participants: Map<string, SessionParticipant>;
  status: 'LOBBY' | 'ACTIVE' | 'FINISHED';
}

class LessonSessionService {
  private sessions: Map<string, LessonSession> = new Map();
  private pinToSessionId: Map<string, string> = new Map();

  createSession(tutorId: string, tutorSocketId: string, articleId: string, articleData?: any): LessonSession {
    const sessionId = uuidv4();
    // Generate a 6-digit random PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    
    const session: LessonSession = {
      sessionId,
      pin,
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

    return session;
  }

  getSessionByPin(pin: string): LessonSession | undefined {
    const sessionId = this.pinToSessionId.get(pin);
    if (!sessionId) return undefined;
    return this.sessions.get(sessionId);
  }

  getSession(sessionId: string): LessonSession | undefined {
    return this.sessions.get(sessionId);
  }

  joinSession(pin: string, studentId: string, name: string, socketId: string): LessonSession | undefined {
    const session = this.getSessionByPin(pin);
    if (!session) return undefined;

    session.participants.set(studentId, {
      studentId,
      name,
      socketId,
      score: 0,
      hasAnsweredCurrentPhase: false
    });

    return session;
  }

  removeParticipantBySocketId(socketId: string) {
    for (const [sessionId, session] of this.sessions.entries()) {
      for (const [studentId, participant] of session.participants.entries()) {
        if (participant.socketId === socketId) {
          session.participants.delete(studentId);
          // Return info so we can notify the room
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
    // Reset answer status for all participants
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

    participant.hasAnsweredCurrentPhase = true;
    participant.latestAnswer = answer;

    // Check if everyone answered
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
