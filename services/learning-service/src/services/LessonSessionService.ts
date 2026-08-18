import { logger } from "@tutor-advantage/shared-config";
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

interface PhaseSnapshot {
  currentPhase: number;
  status: LessonSession["status"];
  participants: SessionParticipant[];
  activeSentenceIndex?: number;
  phaseSelectedIndices?: Record<number, number>;
  sentenceFlags: Array<[number, string[]]>;
  pairs?: { pairNumber: number; studentIds: string[] }[];
  gameState?: GamePhaseState;
  currentDbSessionId?: string;
}

export type GameCategory = "vocabulary" | "sentence";
export type GamePhaseStatus =
  | "voting"
  | "ready"
  | "teacher_demo"
  | "tutorial"
  | "countdown"
  | "playing"
  | "results";

export interface GamePhaseResult {
  studentId: string;
  name: string;
  gameId: string;
  score: number;
  correct?: number;
  total?: number;
  durationMs?: number;
  submittedAt: number;
}

export interface GamePhaseState {
  phase: number;
  category: GameCategory;
  status: GamePhaseStatus;
  votes: Record<string, string>;
  selectedGameId?: string;
  tutorialEnabled?: boolean;
  teacherDemoEnabled?: boolean;
  countdownEndsAt?: number;
  results: Record<string, GamePhaseResult>;
  voteFirstSeen: Record<string, number>;
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
  // True when the tutor navigated back to a previously completed phase.
  // The client uses this to render the phase as review-only.
  phaseRestored?: boolean;
  // The phase to resume after review. This prevents interactive phases from
  // being replayed and scored a second time.
  resumePhase?: number;
  participants: Map<string, SessionParticipant>;
  status: 'LOBBY' | 'ACTIVE' | 'FINISHED';
  activeSentenceIndex?: number;
  phaseSelectedIndices?: Record<number, number>;
  // Step 3 (Read the Article) Sentence Flags: sentenceIndex -> set of studentIds who flagged it
  sentenceFlags?: Map<number, Set<string>>;
  // Step 14 (Pair Conversation): random pairs, regenerated every time phase 18 starts
  pairs?: { pairNumber: number; studentIds: string[] }[];
  gameState?: GamePhaseState;
  currentDbSessionId?: string; // Track active DB ID for dynamic restarting
  finalNotificationSent?: boolean;
  // Demo sessions are ephemeral previews: never persisted, never AI-scored, no class.
  isDemo?: boolean;
  // In-memory checkpoints for safe tutor-only phase rewind. These are scoped
  // to the live session and are discarded with the session.
  phaseSnapshots: Map<number, PhaseSnapshot>;
}

export interface PairMember {
  studentId: string;
  name: string;
  pictureUrl?: string;
}

export interface PairPayload {
  pairNumber: number;
  members: PairMember[];
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

export const LIVE_LESSON_TOTAL_PHASES = 19;
export const VOCABULARY_GAME_PHASE = 11;
export const SENTENCE_GAME_PHASE = 15;
export const PAIR_CONVERSATION_PHASE = 18;
export const FINAL_LEADERBOARD_PHASE = 19;

const ENABLED_GAME_BY_CATEGORY: Record<GameCategory, Set<string>> = {
  vocabulary: new Set([
    "dragon-flight",
    "wizard-vs-zombie",
    "enchanted-library",
    "rune-match",
  ]),
  sentence: new Set(["castle-defense", "potion-rush"]),
};

const DEFAULT_GAME_BY_CATEGORY: Partial<Record<GameCategory, string>> = {
  vocabulary: "dragon-flight",
  sentence: "castle-defense",
};

function isEnabledGameForCategory(category: GameCategory, gameId?: string | null): boolean {
  return !!gameId && ENABLED_GAME_BY_CATEGORY[category].has(gameId);
}

function getDefaultGameForCategory(category: GameCategory): string | undefined {
  const defaultGameId = DEFAULT_GAME_BY_CATEGORY[category];
  return isEnabledGameForCategory(category, defaultGameId) ? defaultGameId : undefined;
}

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getGameCategoryForPhase(phase: number): GameCategory | null {
  if (phase === VOCABULARY_GAME_PHASE) return "vocabulary";
  if (phase === SENTENCE_GAME_PHASE) return "sentence";
  return null;
}

class LessonSessionService {
  private sessions: Map<string, LessonSession> = new Map();
  private classToSessionId: Map<string, string> = new Map(); // Map classId to active session

  resetForTest() {
    if (process.env.NODE_ENV === "production") return;
    this.sessions.clear();
    this.classToSessionId.clear();
  }

  createSession(
    tutorId: string,
    tutorSocketId: string,
    articleId: string,
    articleData: any,
    classId?: string,
    classBookCycleId?: string,
    bookId?: string,
    isDemo?: boolean,
  ): LessonSession {
    // ATTEMPT RECOVERY: If an active session already exists for this class, REUSE it!
    if (classId) {
      const existingSessionId = this.classToSessionId.get(classId);
      if (existingSessionId) {
        const existing = this.sessions.get(existingSessionId);
        if (existing && existing.status !== 'FINISHED') {
          logger.info(`[Service] Recovered existing session ${existingSessionId} for class ${classId}`);
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

    // 19-phase map. Phase 3 is the vocabulary flashcard mission.
    // Interactive index slots:
    //   8=Comprehension(MCQ) 9=GuidedResponse(ShortAnswer) 10=VocabPractice
    //   12=SentencePractice(fill) 13=SentencePractice(order) 14=GuidedWriting(prompt)
    const phaseSelectedIndices: Record<number, number> = {};
    if (articleData?.multipleChoiceQuestions?.length) {
      phaseSelectedIndices[8] = Math.floor(Math.random() * articleData.multipleChoiceQuestions.length);
    }
    if (articleData?.shortAnswerQuestions?.length) {
      const count = articleData.shortAnswerQuestions.length;
      phaseSelectedIndices[9] = getRandomIndex(count);
      phaseSelectedIndices[14] = getRandomIndex(count); // Guided Writing prompt
    }
    if (articleData?.words?.length) {
      phaseSelectedIndices[10] = Math.floor(Math.random() * articleData.words.length);
    }
    if (articleData?.sentences?.length) {
      phaseSelectedIndices[12] = getRandomLongSentenceIndex(articleData.sentences);
      phaseSelectedIndices[13] = getRandomLongSentenceIndex(articleData.sentences);
    }

    logger.info(`[Service] Available MCQ questions (Phase 8):`, articleData?.multipleChoiceQuestions?.map((q: any) => q.question));
    logger.info(`[Service] Available Short Answer questions (Phase 9):`, articleData?.shortAnswerQuestions?.map((q: any) => q.question));

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
      phaseRestored: false,
      resumePhase: undefined,
      participants: new Map(),
      status: 'LOBBY',
      activeSentenceIndex: -1,
      phaseSelectedIndices,
      sentenceFlags: new Map(),
      isDemo: isDemo ?? false,
      phaseSnapshots: new Map(),
      finalNotificationSent: false,
    };

    this.sessions.set(sessionId, session);
    // Demo sessions are not tracked by class so concurrent demos never collide.
    if (classId && !isDemo) {
      this.classToSessionId.set(classId, sessionId);
    }

    logger.info(`[Service] Created NEW session ${sessionId} for class ${classId}`);
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
    if (!session || session.phaseRestored) return undefined;

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

    // Starting a new lesson cycle must not be able to rewind into the prior
    // cycle's checkpoints. Keep the existing cycle behavior intact while
    // clearing only the in-memory rewind history.
    if (phase === 1 && session.currentPhase === FINAL_LEADERBOARD_PHASE) {
      session.phaseSnapshots.clear();
      session.finalNotificationSent = false;
    } else {
      this.savePhaseSnapshot(session);
    }

    session.currentPhase = phase;
    session.phaseRestored = false;
    session.resumePhase = undefined;
    for (const participant of session.participants.values()) {
      participant.hasAnsweredCurrentPhase = false;
      participant.latestAnswer = undefined;
      if (phase === 1) {
        participant.score = 0;
      }
    }
    session.gameState = undefined;

    // Reset sentence flags at the start of a fresh instructional cycle
    if (phase === 1) {
      session.sentenceFlags = new Map();
    }

    if (!session.phaseSelectedIndices) {
      session.phaseSelectedIndices = {};
    }

    // Force re-randomize every time we enter the phase
    // 8=MCQ 9=ShortAnswer 10=VocabPractice 12/13=SentenceGames 14=GuidedWriting prompt
    if (phase === 8) {
      const count = session.articleData?.multipleChoiceQuestions?.length || 1;
      session.phaseSelectedIndices[8] = Math.floor(Math.random() * count);
    } else if (phase === 9 || phase === 14) {
      const count = session.articleData?.shortAnswerQuestions?.length || 1;
      session.phaseSelectedIndices[phase] = getRandomIndex(count);
    } else if (phase === 10) {
      const count = session.articleData?.words?.length || 1;
      session.phaseSelectedIndices[10] = Math.floor(Math.random() * count);
    } else if (phase === 12 || phase === 13) {
      session.phaseSelectedIndices[phase] = getRandomLongSentenceIndex(session.articleData?.sentences || []);
    }

    const gameCategory = getGameCategoryForPhase(phase);
    if (gameCategory) {
      session.gameState = {
        phase,
        category: gameCategory,
        status: "voting",
        votes: {},
        results: {},
        voteFirstSeen: {},
      };
    }

    // Step 14 (Pair Conversation): shuffle students into fresh pairs every entry
    if (phase === PAIR_CONVERSATION_PHASE) {
      this.generatePairs(session);
    }

    if (phase > 0) {
      session.status = 'ACTIVE';
    }

    logger.info(`[Service] Session phase changed to: ${phase}`);
    if ([8, 9, 10, 12, 13, 14].includes(phase)) {
       const idx = session.phaseSelectedIndices?.[phase] || 0;
       logger.info(`[Service] Selected Question Index for Phase ${phase}:`, idx);
    }

    return session;
  }

  rewindPhase(sessionId: string, phase: number): LessonSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || phase >= session.currentPhase || phase < 1) return undefined;

    const snapshot = session.phaseSnapshots.get(phase);
    if (!snapshot) return undefined;

    const currentParticipants = session.participants;
    const restoredParticipants = new Map<string, SessionParticipant>();

    for (const saved of snapshot.participants) {
      const liveParticipant = currentParticipants.get(saved.studentId);
      restoredParticipants.set(saved.studentId, {
        ...cloneJson(saved),
        // A participant may have reconnected since this checkpoint was made;
        // never restore an obsolete socket id.
        socketId: liveParticipant?.socketId || saved.socketId,
      });
    }

    // Keep students who joined after the checkpoint in the room. They remain
    // eligible for the live session but have not answered the restored phase.
    for (const [studentId, participant] of currentParticipants.entries()) {
      if (restoredParticipants.has(studentId)) continue;
      restoredParticipants.set(studentId, {
        ...participant,
        hasAnsweredCurrentPhase: false,
        latestAnswer: undefined,
      });
    }

    const resumePhase = session.phaseRestored && session.resumePhase !== undefined
      ? session.resumePhase
      : session.currentPhase;

    session.currentPhase = snapshot.currentPhase;
    session.phaseRestored = true;
    session.resumePhase = resumePhase;
    session.status = snapshot.status === "LOBBY" ? "ACTIVE" : snapshot.status;
    session.participants = restoredParticipants;
    session.activeSentenceIndex = snapshot.activeSentenceIndex;
    session.phaseSelectedIndices = cloneJson(snapshot.phaseSelectedIndices);
    session.sentenceFlags = new Map(
      snapshot.sentenceFlags.map(([index, studentIds]) => [index, new Set(studentIds)]),
    );
    session.pairs = cloneJson(snapshot.pairs);
    session.gameState = cloneJson(snapshot.gameState);
    session.currentDbSessionId = snapshot.currentDbSessionId;

    logger.info(`[Service] Rewound session ${sessionId} to phase ${phase}`);
    return session;
  }

  private savePhaseSnapshot(session: LessonSession) {
    // Phase 0 is a lobby and is not a valid target for the tutor's Previous
    // action, so it does not need a checkpoint.
    if (session.currentPhase < 1) return;

    session.phaseSnapshots.set(session.currentPhase, {
      currentPhase: session.currentPhase,
      status: session.status,
      participants: Array.from(session.participants.values()).map((participant) => cloneJson(participant)),
      activeSentenceIndex: session.activeSentenceIndex,
      phaseSelectedIndices: cloneJson(session.phaseSelectedIndices),
      sentenceFlags: Array.from(session.sentenceFlags?.entries() || []).map(([index, studentIds]) => [
        index,
        Array.from(studentIds),
      ]),
      pairs: cloneJson(session.pairs),
      gameState: cloneJson(session.gameState),
      currentDbSessionId: session.currentDbSessionId,
    });
  }

  getGameStatePayload(session?: LessonSession): GamePhaseState | null {
    if (!session?.gameState) return null;
    return {
      ...session.gameState,
      votes: { ...session.gameState.votes },
      results: { ...session.gameState.results },
      voteFirstSeen: { ...session.gameState.voteFirstSeen },
    };
  }

  startGameVote(sessionId: string, phase: number): GamePhaseState | null {
    const session = this.sessions.get(sessionId);
    const category = getGameCategoryForPhase(phase);
    if (!session || session.phaseRestored || !category) return null;
    session.gameState = {
      phase,
      category,
      status: "voting",
      votes: {},
      results: {},
      voteFirstSeen: {},
    };
    return this.getGameStatePayload(session);
  }

  submitGameVote(sessionId: string, studentId: string, gameId: string): GamePhaseState | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.phaseRestored || !session.gameState || session.gameState.status !== "voting") return null;
    if (!isEnabledGameForCategory(session.gameState.category, gameId)) return null;
    session.gameState.votes[studentId] = gameId;
    if (!session.gameState.voteFirstSeen[gameId]) {
      session.gameState.voteFirstSeen[gameId] = Date.now();
    }
    return this.getGameStatePayload(session);
  }

  lockGameVote(sessionId: string): GamePhaseState | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.phaseRestored || !session.gameState) return null;
    const counts = new Map<string, number>();
    for (const gameId of Object.values(session.gameState.votes)) {
      counts.set(gameId, (counts.get(gameId) || 0) + 1);
    }
    let selectedGameId = getDefaultGameForCategory(session.gameState.category);
    let selectedCount = -1;
    let selectedFirstSeen = Number.POSITIVE_INFINITY;
    for (const [gameId, count] of counts.entries()) {
      if (!isEnabledGameForCategory(session.gameState.category, gameId)) continue;
      const firstSeen = session.gameState.voteFirstSeen[gameId] || Number.POSITIVE_INFINITY;
      if (count > selectedCount || (count === selectedCount && firstSeen < selectedFirstSeen)) {
        selectedGameId = gameId;
        selectedCount = count;
        selectedFirstSeen = firstSeen;
      }
    }
    if (selectedGameId) {
      session.gameState.selectedGameId = selectedGameId;
      session.gameState.status = "ready";
      session.gameState.tutorialEnabled = true;
      session.gameState.teacherDemoEnabled = false;
    } else {
      delete session.gameState.selectedGameId;
    }
    return this.getGameStatePayload(session);
  }

  startGameIntro(
    sessionId: string,
    options: { tutorialEnabled?: boolean; teacherDemoEnabled?: boolean } = {},
  ): GamePhaseState | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.phaseRestored || !session.gameState || session.gameState.status !== "ready") return null;

    session.gameState.tutorialEnabled = options.tutorialEnabled !== false;
    session.gameState.teacherDemoEnabled = options.teacherDemoEnabled === true;
    if (session.gameState.teacherDemoEnabled) {
      session.gameState.status = "teacher_demo";
    } else if (session.gameState.tutorialEnabled) {
      session.gameState.status = "tutorial";
    } else {
      return this.startGameCountdown(sessionId);
    }

    return this.getGameStatePayload(session);
  }

  advanceGameIntro(sessionId: string, durationMs = 5000): GamePhaseState | null {
    const session = this.sessions.get(sessionId);
    const gameState = session?.gameState;
    if (!session || session.phaseRestored || !gameState) return null;

    if (gameState.status === "teacher_demo" && gameState.tutorialEnabled) {
      gameState.status = "tutorial";
      return this.getGameStatePayload(session);
    }

    if (["ready", "teacher_demo", "tutorial"].includes(gameState.status)) {
      return this.startGameCountdown(sessionId, durationMs);
    }

    return null;
  }

  startGameCountdown(sessionId: string, durationMs = 5000): GamePhaseState | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.phaseRestored || !session.gameState) return null;
    if (!session.gameState.selectedGameId) {
      this.lockGameVote(sessionId);
    }
    if (!session.gameState.selectedGameId) return null;
    session.gameState.status = "countdown";
    session.gameState.countdownEndsAt = Date.now() + durationMs;
    return this.getGameStatePayload(session);
  }

  markGamePlaying(sessionId: string, expectedCountdownEndsAt?: number): GamePhaseState | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.phaseRestored || !session.gameState) return null;
    if (
      expectedCountdownEndsAt !== undefined &&
      (session.gameState.status !== "countdown" ||
        session.gameState.countdownEndsAt !== expectedCountdownEndsAt)
    ) {
      return null;
    }
    session.gameState.status = "playing";
    return this.getGameStatePayload(session);
  }

  submitGameResult(
    sessionId: string,
    studentId: string,
    result: { gameId?: string; score?: number; correct?: number; total?: number; durationMs?: number },
  ): { session: LessonSession; gameState: GamePhaseState; accepted: boolean; allSubmitted: boolean } | null {
    const session = this.sessions.get(sessionId);
    const gameState = session?.gameState;
    if (!session || session.phaseRestored || !gameState || !["playing", "results"].includes(gameState.status)) return null;
    if (gameState.results[studentId]) {
      return {
        session,
        gameState: this.getGameStatePayload(session)!,
        accepted: false,
        allSubmitted: Object.keys(gameState.results).length >= session.participants.size,
      };
    }
    const participant = session.participants.get(studentId);
    if (!participant) return null;
    const gameId = gameState.selectedGameId;
    if (!gameId || !isEnabledGameForCategory(gameState.category, gameId)) return null;
    if (result.gameId && result.gameId !== gameId) return null;

    const isBoundedInteger = (value: unknown, max: number) =>
      value === undefined ||
      (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max);
    if (
      !isBoundedInteger(result.score, 100_000) ||
      !isBoundedInteger(result.correct, 100) ||
      !isBoundedInteger(result.total, 100) ||
      !isBoundedInteger(result.durationMs, 30 * 60 * 1000) ||
      (result.correct !== undefined && result.total !== undefined && result.correct > result.total)
    ) {
      return null;
    }

    // The browser result is not a verifiable proof of game performance. Keep
    // the result for display/audit, but do not let client-controlled numbers
    // affect participant scores or money-bearing metrics.
    const score = 0;
    const correct = result.correct;
    const total = result.total;
    const durationMs = result.durationMs;
    participant.score = (participant.score || 0) + score;
    participant.hasAnsweredCurrentPhase = true;
    participant.latestAnswer = { gameId, score, correct, total };
    gameState.results[studentId] = {
      studentId,
      name: participant.name,
      gameId,
      score,
      correct,
      total,
      durationMs,
      submittedAt: Date.now(),
    };
    // Keep the game mounted for students who have not submitted yet. The
    // tutor can still monitor partial results, while the shared results view
    // only becomes final once every current participant has submitted.
    const allSubmitted = Object.keys(gameState.results).length >= session.participants.size;
    gameState.status = allSubmitted ? "results" : "playing";
    return {
      session,
      gameState: this.getGameStatePayload(session)!,
      accepted: true,
      allSubmitted,
    };
  }

  // Step 14 (Pair Conversation): randomly pair up everyone in the room.
  // An odd student out joins the last pair as a group of three.
  private generatePairs(session: LessonSession) {
    const ids = Array.from(session.participants.keys());
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }

    const pairs: { pairNumber: number; studentIds: string[] }[] = [];
    for (let i = 0; i + 1 < ids.length; i += 2) {
      pairs.push({ pairNumber: pairs.length + 1, studentIds: [ids[i], ids[i + 1]] });
    }
    if (ids.length % 2 === 1) {
      const leftover = ids[ids.length - 1];
      if (pairs.length > 0) {
        pairs[pairs.length - 1].studentIds.push(leftover);
      } else {
        pairs.push({ pairNumber: 1, studentIds: [leftover] });
        if (process.env.NODE_ENV !== "production") {
          pairs[0].studentIds.push("mock-student-dev");
        }
      }
    }

    session.pairs = pairs;
    logger.info(`[Service] Generated ${pairs.length} conversation pair(s) for session ${session.sessionId}`);
  }

  // Serialize pairs with display info for broadcast to tutor + students
  getPairsPayload(session: LessonSession): PairPayload[] {
    return (session.pairs ?? []).map((pair) => ({
      pairNumber: pair.pairNumber,
      members: pair.studentIds.map((studentId) => {
        const participant = session.participants.get(studentId);
        return {
          studentId,
          name: participant?.name || (studentId.startsWith('mock') ? 'เพื่อนสมมติ (Dev)' : '?'),
          pictureUrl: participant?.pictureUrl,
        };
      }),
    }));
  }

  syncActiveSentence(sessionId: string, index: number): LessonSession | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.activeSentenceIndex = index;
    }
    return session || null;
  }

  submitAnswer(sessionId: string, studentId: string, answer: any): { session: LessonSession, allAnswered: boolean, accepted: boolean } | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.phaseRestored) return undefined;

    const participant = session.participants.get(studentId);
    if (!participant) return undefined;

    if (participant.hasAnsweredCurrentPhase) {
      return { session, allAnswered: false, accepted: false };
    }

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

    return { session, allAnswered, accepted: true };
  }

  endQuestion(sessionId: string): { session: LessonSession; answers: Array<{ studentId: string; answer: any }> } | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.phaseRestored) return undefined;

    const answers = Array.from(session.participants.values())
      .filter((participant) => participant.hasAnsweredCurrentPhase)
      .map((participant) => ({
        studentId: participant.studentId,
        answer: participant.latestAnswer,
      }));

    return { session, answers };
  }

  // Toggle a student's flag on a sentence (Phase 4 Reading). Returns updated count for that sentence.
  toggleSentenceFlag(sessionId: string, studentId: string, sentenceIndex: number):
    { session: LessonSession; sentenceIndex: number; count: number; flagged: boolean } | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.phaseRestored) return undefined;

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
