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
  phaseSelectedIndices?: Record<number, number>;
}

class LessonSessionService {
  private sessions: Map<string, LessonSession> = new Map();
  private pinToSessionId: Map<string, string> = new Map();
  private classToSessionId: Map<string, string> = new Map(); // Map classId to active session

  createSession(tutorId: string, tutorSocketId: string, articleId: string, articleData: any, classId?: string): LessonSession {
    if (articleData) {
      if (!articleData.multipleChoiceQuestions) {
        articleData.multipleChoiceQuestions = [];
      }
      if (articleData.multipleChoiceQuestions.length <= 1) {
        articleData.multipleChoiceQuestions.push(
          {
            id: "mcq-fb-1",
            question: "What is he doing in the library?",
            options: { option1: "Reading a book", option2: "Sleeping", option3: "Playing games", option4: "Singing" },
            answer: "Reading a book"
          },
          {
            id: "mcq-fb-2",
            question: "Where is he?",
            options: { option1: "In the library", option2: "In the park", option3: "At school", option4: "At home" },
            answer: "In the library"
          },
          {
            id: "mcq-fb-3",
            question: "Is the library big or small?",
            options: { option1: "It is big", option2: "It is small", option3: "It is empty", option4: "It is dark" },
            answer: "It is big"
          }
        );
      }

      if (!articleData.shortAnswerQuestions) {
        articleData.shortAnswerQuestions = [];
      }
      if (articleData.shortAnswerQuestions.length <= 1) {
        articleData.shortAnswerQuestions.push(
          { id: "saq-fb-1", question: "Describe the library from the article.", answer: "The library is big." },
          { id: "saq-fb-2", question: "What are the benefits of reading in a library?", answer: "It is quiet and has many books." },
          { id: "saq-fb-3", question: "Why do you think he goes to the library?", answer: "To study and read in silence." }
        );
      }
    }

    const phaseSelectedIndices: Record<number, number> = {};
    if (articleData?.multipleChoiceQuestions?.length) {
      phaseSelectedIndices[7] = Math.floor(Math.random() * articleData.multipleChoiceQuestions.length);
    }
    if (articleData?.shortAnswerQuestions?.length) {
      phaseSelectedIndices[8] = Math.floor(Math.random() * articleData.shortAnswerQuestions.length);
      phaseSelectedIndices[13] = Math.floor(Math.random() * articleData.shortAnswerQuestions.length);
    }
    if (articleData?.words?.length) {
      phaseSelectedIndices[10] = Math.floor(Math.random() * articleData.words.length);
    }
    if (articleData?.sentences?.length) {
      phaseSelectedIndices[11] = Math.floor(Math.random() * articleData.sentences.length);
      phaseSelectedIndices[12] = Math.floor(Math.random() * articleData.sentences.length);
    }

    console.log(`[Service] Available MCQ questions (Phase 7):`, articleData?.multipleChoiceQuestions?.map((q: any) => q.question));
    console.log(`[Service] Available Short Answer questions (Phase 8/13):`, articleData?.shortAnswerQuestions?.map((q: any) => q.question));

    // If a session for this class already exists, reuse it and update tutor's socket
    if (classId) {
      const existingSession = this.getSessionByClassId(classId);
      if (existingSession && existingSession.status !== 'FINISHED') {
        console.log(`[Service] Reusing existing session ${existingSession.sessionId} for class ${classId}`);
        existingSession.tutorSocketId = tutorSocketId;
        existingSession.articleId = articleId;
        existingSession.articleData = articleData;
        existingSession.phaseSelectedIndices = phaseSelectedIndices;
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
      currentPhase: 0,
      participants: new Map(),
      status: 'LOBBY',
      phaseSelectedIndices
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
      if (phase === 1) {
        participant.score = 0;
      }
    }

    if (!session.phaseSelectedIndices) {
      session.phaseSelectedIndices = {};
    }

    // Force re-randomize every time we enter the phase
    if (phase === 7) {
      const count = session.articleData?.multipleChoiceQuestions?.length || 1;
      session.phaseSelectedIndices[7] = Math.floor(Math.random() * count);
    } else if (phase === 8 || phase === 13) {
      const count = session.articleData?.shortAnswerQuestions?.length || 1;
      session.phaseSelectedIndices[phase] = Math.floor(Math.random() * count);
    } else if (phase === 10) {
      const count = session.articleData?.words?.length || 1;
      session.phaseSelectedIndices[10] = Math.floor(Math.random() * count);
    } else if (phase === 11 || phase === 12) {
      const count = session.articleData?.sentences?.length || 1;
      session.phaseSelectedIndices[phase] = Math.floor(Math.random() * count);
    }

    if (phase > 0) {
      session.status = 'ACTIVE';
    }

    console.log(`[Service] Session phase changed to: ${phase}`);
    if ([7, 8, 10, 11, 12, 13].includes(phase)) {
       const idx = session.phaseSelectedIndices?.[phase] || 0;
       console.log(`[Service] Selected Question Index for Phase ${phase}:`, idx);
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

  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    this.sessions.delete(sessionId);
    this.pinToSessionId.delete(session.pin);
    if (session.classId) {
      this.classToSessionId.delete(session.classId);
    }
    return true;
  }
}

export const lessonSessionService = new LessonSessionService();
