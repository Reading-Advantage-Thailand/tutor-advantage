import { v4 as uuidv4 } from "uuid";

export interface SessionParticipant {
  studentId: string;
  resolvedUserId?: string;
  name: string;
  pictureUrl?: string;
  socketId: string;
  score: number;
  hasAnsweredCurrentPhase: boolean;
  latestAnswer?: any;
  isReady: boolean;
}

export interface LessonSession {
  sessionId: string;
  classId?: string; // Added classId
  classBookCycleId?: string;
  bookId?: string;
  tutorId: string;
  tutorSocketId: string;
  articleId: string;
  articleData: any;
  currentPhase: number;
  participants: Map<string, SessionParticipant>;
  status: 'LOBBY' | 'ACTIVE' | 'FINISHED';
  phaseSelectedIndices?: Record<number, number>;
  // Phase 7 (Translation) Sentence Flags: sentenceIndex -> set of studentIds who flagged it
  sentenceFlags?: Map<number, Set<string>>;
  currentDbSessionId?: string; // Track active DB ID for dynamic restarting
}

function getRandomLongSentenceIndex(sentences: any[]): number {
  if (!sentences?.length) return 0;
  const validIndices = sentences
    .map((s, i) => {
      const txt = typeof s === 'object' ? s.sentences : s;
      const wordCount = String(txt || "").trim().split(/\s+/).length;
      return wordCount >= 4 ? i : -1;
    })
    .filter(idx => idx !== -1);
  
  const source = validIndices.length > 0 ? validIndices : sentences.map((_, i) => i);
  return source[Math.floor(Math.random() * source.length)];
}

function getRandomIndex(count: number, excludedIndex?: number): number {
  if (count <= 0) return 0;
  if (count === 1 || excludedIndex === undefined || excludedIndex < 0 || excludedIndex >= count) {
    return Math.floor(Math.random() * count);
  }

  const candidates = Array.from({ length: count }, (_, index) => index).filter((index) => index !== excludedIndex);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

class LessonSessionService {
  private sessions: Map<string, LessonSession> = new Map();
  private classToSessionId: Map<string, string> = new Map(); // Map classId to active session

  createSession(
    tutorId: string,
    tutorSocketId: string,
    articleId: string,
    articleData: any,
    classId?: string,
    classBookCycleId?: string,
    bookId?: string,
  ): LessonSession {
    // ATTEMPT RECOVERY: If an active session already exists for this class, REUSE it!
    if (classId) {
      const existingSessionId = this.classToSessionId.get(classId);
      if (existingSessionId) {
        const existing = this.sessions.get(existingSessionId);
        if (existing && existing.status !== 'FINISHED') {
          console.log(`[Service] Recovered existing session ${existingSessionId} for class ${classId}`);
          existing.tutorSocketId = tutorSocketId;
          return existing;
        }
      }
    }

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

    // Phase mapping (post-renumber): 7=Translation, 8=MCQ, 9=ShortAnswer, 13=Read-Aloud
    const phaseSelectedIndices: Record<number, number> = {};
    if (articleData?.multipleChoiceQuestions?.length) {
      phaseSelectedIndices[8] = Math.floor(Math.random() * articleData.multipleChoiceQuestions.length);
    }
    if (articleData?.shortAnswerQuestions?.length) {
      const count = articleData.shortAnswerQuestions.length;
      phaseSelectedIndices[9] = getRandomIndex(count);
    }
    if (articleData?.words?.length) {
      phaseSelectedIndices[10] = Math.floor(Math.random() * articleData.words.length);
    }
    if (articleData?.sentences?.length) {
      phaseSelectedIndices[11] = getRandomLongSentenceIndex(articleData.sentences);
      phaseSelectedIndices[12] = getRandomLongSentenceIndex(articleData.sentences);
      phaseSelectedIndices[13] = getRandomLongSentenceIndex(articleData.sentences);
    }

    console.log(`[Service] Available MCQ questions (Phase 7):`, articleData?.multipleChoiceQuestions?.map((q: any) => q.question));
    console.log(`[Service] Available Short Answer questions (Phase 8/13):`, articleData?.shortAnswerQuestions?.map((q: any) => q.question));

    // Force fresh UUID session instantiation every time to ensure unique, separated histories
    const sessionId = uuidv4();
    const session: LessonSession = {
      sessionId,
      classId,
      classBookCycleId,
      bookId,
      tutorId,
      tutorSocketId,
      articleId,
      articleData,
      currentPhase: 0,
      participants: new Map(),
      status: 'LOBBY',
      phaseSelectedIndices,
      sentenceFlags: new Map()
    };

    this.sessions.set(sessionId, session);
    if (classId) {
      this.classToSessionId.set(classId, sessionId);
    }

    console.log(`[Service] Created NEW session ${sessionId} for class ${classId}`);
    return session;
  }

  getSessionByClassId(classId: string): LessonSession | undefined {
    const sessionId = this.classToSessionId.get(classId);
    if (!sessionId) return undefined;
    return this.sessions.get(sessionId);
  }

  getSession(sessionId: string): LessonSession | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionByTutorSocketId(socketId: string): LessonSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.tutorSocketId === socketId) {
        return session;
      }
    }
    return undefined;
  }

  joinSessionByClassId(classId: string, studentId: string, name: string, socketId: string, pictureUrl?: string, resolvedUserId?: string): LessonSession | undefined {
    const session = this.getSessionByClassId(classId);
    if (!session) return undefined;

    const existing = session.participants.get(studentId);
    session.participants.set(studentId, {
      studentId,
      resolvedUserId: resolvedUserId ?? existing?.resolvedUserId,
      name,
      pictureUrl,
      socketId,
      score: existing ? existing.score : 0,
      hasAnsweredCurrentPhase: existing ? existing.hasAnsweredCurrentPhase : false,
      isReady: existing ? existing.isReady : false
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

    // Reset sentence flags at the start of a fresh instructional cycle
    if (phase === 1) {
      session.sentenceFlags = new Map();
    }

    if (!session.phaseSelectedIndices) {
      session.phaseSelectedIndices = {};
    }

    // Force re-randomize every time we enter the phase
    // Phase mapping (post-renumber): 8=MCQ, 9=ShortAnswer, 10=VocabGame, 11/12=SentenceGames, 13=Read-Aloud
    if (phase === 8) {
      const count = session.articleData?.multipleChoiceQuestions?.length || 1;
      session.phaseSelectedIndices[8] = Math.floor(Math.random() * count);
    } else if (phase === 9) {
      const count = session.articleData?.shortAnswerQuestions?.length || 1;
      session.phaseSelectedIndices[9] = getRandomIndex(count);
    } else if (phase === 10) {
      const count = session.articleData?.words?.length || 1;
      session.phaseSelectedIndices[10] = Math.floor(Math.random() * count);
    } else if (phase === 11 || phase === 12 || phase === 13) {
      session.phaseSelectedIndices[phase] = getRandomLongSentenceIndex(session.articleData?.sentences || []);
    }

    if (phase > 0) {
      session.status = 'ACTIVE';
    }

    console.log(`[Service] Session phase changed to: ${phase}`);
    if ([8, 9, 10, 11, 12, 13].includes(phase)) {
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

  // Toggle a student's flag on a sentence (Phase 7 Translation). Returns updated count for that sentence.
  toggleSentenceFlag(sessionId: string, studentId: string, sentenceIndex: number):
    { session: LessonSession; sentenceIndex: number; count: number; flagged: boolean } | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    if (!session.sentenceFlags) session.sentenceFlags = new Map();

    let voters = session.sentenceFlags.get(sentenceIndex);
    if (!voters) {
      voters = new Set();
      session.sentenceFlags.set(sentenceIndex, voters);
    }

    let flagged: boolean;
    if (voters.has(studentId)) {
      voters.delete(studentId);
      flagged = false;
    } else {
      voters.add(studentId);
      flagged = true;
    }

    if (voters.size === 0) session.sentenceFlags.delete(sentenceIndex);

    return { session, sentenceIndex, count: voters.size, flagged };
  }

  // Serialize all flag counts for broadcast: { sentenceIndex: count }
  getFlagCounts(session: LessonSession): Record<number, number> {
    const result: Record<number, number> = {};
    if (!session.sentenceFlags) return result;
    for (const [idx, voters] of session.sentenceFlags.entries()) {
      if (voters.size > 0) result[idx] = voters.size;
    }
    return result;
  }

  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    this.sessions.delete(sessionId);
    if (session.classId) {
      this.classToSessionId.delete(session.classId);
    }
    return true;
  }
}

export const lessonSessionService = new LessonSessionService();
