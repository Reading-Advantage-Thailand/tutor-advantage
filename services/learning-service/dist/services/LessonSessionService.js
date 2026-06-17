"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lessonSessionService = void 0;
const shared_config_1 = require("@tutor-advantage/shared-config");
const uuid_1 = require("uuid");
function getRandomLongSentenceIndex(sentences) {
    if (!sentences?.length)
        return 0;
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
function getRandomIndex(count, excludedIndex) {
    if (count <= 0)
        return 0;
    if (count === 1 || excludedIndex === undefined || excludedIndex < 0 || excludedIndex >= count) {
        return Math.floor(Math.random() * count);
    }
    const candidates = Array.from({ length: count }, (_, index) => index).filter((index) => index !== excludedIndex);
    return candidates[Math.floor(Math.random() * candidates.length)];
}
class LessonSessionService {
    sessions = new Map();
    classToSessionId = new Map(); // Map classId to active session
    createSession(tutorId, tutorSocketId, articleId, articleData, classId, classBookCycleId, bookId, isDemo) {
        // ATTEMPT RECOVERY: If an active session already exists for this class, REUSE it!
        if (classId) {
            const existingSessionId = this.classToSessionId.get(classId);
            if (existingSessionId) {
                const existing = this.sessions.get(existingSessionId);
                if (existing && existing.status !== 'FINISHED') {
                    shared_config_1.logger.info(`[Service] Recovered existing session ${existingSessionId} for class ${classId}`);
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
                articleData.multipleChoiceQuestions.push({
                    id: "mcq-fb-1",
                    question: "What is he doing in the library?",
                    options: { option1: "Reading a book", option2: "Sleeping", option3: "Playing games", option4: "Singing" },
                    answer: "Reading a book"
                }, {
                    id: "mcq-fb-2",
                    question: "Where is he?",
                    options: { option1: "In the library", option2: "In the park", option3: "At school", option4: "At home" },
                    answer: "In the library"
                }, {
                    id: "mcq-fb-3",
                    question: "Is the library big or small?",
                    options: { option1: "It is big", option2: "It is small", option3: "It is empty", option4: "It is dark" },
                    answer: "It is big"
                });
            }
            if (!articleData.shortAnswerQuestions) {
                articleData.shortAnswerQuestions = [];
            }
            if (articleData.shortAnswerQuestions.length <= 1) {
                articleData.shortAnswerQuestions.push({ id: "saq-fb-1", question: "Describe the library from the article.", answer: "The library is big." }, { id: "saq-fb-2", question: "What are the benefits of reading in a library?", answer: "It is quiet and has many books." }, { id: "saq-fb-3", question: "Why do you think he goes to the library?", answer: "To study and read in silence." });
            }
        }
        // 14-step / 4-period phase map. Interactive index slots:
        //   7=Comprehension(MCQ) 8=GuidedResponse(ShortAnswer) 9=VocabPractice
        //   10=SentencePractice(fill) 11=SentencePractice(order) 12=GuidedWriting(prompt)
        const phaseSelectedIndices = {};
        if (articleData?.multipleChoiceQuestions?.length) {
            phaseSelectedIndices[7] = Math.floor(Math.random() * articleData.multipleChoiceQuestions.length);
        }
        if (articleData?.shortAnswerQuestions?.length) {
            const count = articleData.shortAnswerQuestions.length;
            phaseSelectedIndices[8] = getRandomIndex(count);
            phaseSelectedIndices[12] = getRandomIndex(count); // Guided Writing prompt
        }
        if (articleData?.words?.length) {
            phaseSelectedIndices[9] = Math.floor(Math.random() * articleData.words.length);
        }
        if (articleData?.sentences?.length) {
            phaseSelectedIndices[10] = getRandomLongSentenceIndex(articleData.sentences);
            phaseSelectedIndices[11] = getRandomLongSentenceIndex(articleData.sentences);
        }
        shared_config_1.logger.info(`[Service] Available MCQ questions (Phase 7):`, articleData?.multipleChoiceQuestions?.map((q) => q.question));
        shared_config_1.logger.info(`[Service] Available Short Answer questions (Phase 8):`, articleData?.shortAnswerQuestions?.map((q) => q.question));
        // Force fresh UUID session instantiation every time to ensure unique, separated histories
        const sessionId = (0, uuid_1.v4)();
        const session = {
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
            sentenceFlags: new Map(),
            isDemo: isDemo ?? false,
        };
        this.sessions.set(sessionId, session);
        // Demo sessions are not tracked by class so concurrent demos never collide.
        if (classId && !isDemo) {
            this.classToSessionId.set(classId, sessionId);
        }
        shared_config_1.logger.info(`[Service] Created NEW session ${sessionId} for class ${classId}`);
        return session;
    }
    getSessionByClassId(classId) {
        const sessionId = this.classToSessionId.get(classId);
        if (!sessionId)
            return undefined;
        return this.sessions.get(sessionId);
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    getSessionByTutorSocketId(socketId) {
        for (const session of this.sessions.values()) {
            if (session.tutorSocketId === socketId) {
                return session;
            }
        }
        return undefined;
    }
    joinSessionByClassId(classId, studentId, name, socketId, pictureUrl, resolvedUserId) {
        const session = this.getSessionByClassId(classId);
        if (!session)
            return undefined;
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
    toggleReady(sessionId, studentId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return undefined;
        const participant = session.participants.get(studentId);
        if (participant) {
            participant.isReady = !participant.isReady;
        }
        return session;
    }
    removeParticipantBySocketId(socketId) {
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
    setPhase(sessionId, phase) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return undefined;
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
        // 7=MCQ 8=ShortAnswer 9=VocabGame 10/11=SentenceGames 12=GuidedWriting prompt
        if (phase === 7) {
            const count = session.articleData?.multipleChoiceQuestions?.length || 1;
            session.phaseSelectedIndices[7] = Math.floor(Math.random() * count);
        }
        else if (phase === 8 || phase === 12) {
            const count = session.articleData?.shortAnswerQuestions?.length || 1;
            session.phaseSelectedIndices[phase] = getRandomIndex(count);
        }
        else if (phase === 9) {
            const count = session.articleData?.words?.length || 1;
            session.phaseSelectedIndices[9] = Math.floor(Math.random() * count);
        }
        else if (phase === 10 || phase === 11) {
            session.phaseSelectedIndices[phase] = getRandomLongSentenceIndex(session.articleData?.sentences || []);
        }
        // Step 14 (Pair Conversation): shuffle students into fresh pairs every entry
        if (phase === 15) {
            this.generatePairs(session);
        }
        if (phase > 0) {
            session.status = 'ACTIVE';
        }
        shared_config_1.logger.info(`[Service] Session phase changed to: ${phase}`);
        if ([7, 8, 9, 10, 11, 12].includes(phase)) {
            const idx = session.phaseSelectedIndices?.[phase] || 0;
            shared_config_1.logger.info(`[Service] Selected Question Index for Phase ${phase}:`, idx);
        }
        return session;
    }
    // Step 14 (Pair Conversation): randomly pair up everyone in the room.
    // An odd student out joins the last pair as a group of three.
    generatePairs(session) {
        const ids = Array.from(session.participants.keys());
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        const pairs = [];
        for (let i = 0; i + 1 < ids.length; i += 2) {
            pairs.push({ pairNumber: pairs.length + 1, studentIds: [ids[i], ids[i + 1]] });
        }
        if (ids.length % 2 === 1) {
            const leftover = ids[ids.length - 1];
            if (pairs.length > 0) {
                pairs[pairs.length - 1].studentIds.push(leftover);
            }
            else {
                pairs.push({ pairNumber: 1, studentIds: [leftover] });
                if (process.env.NODE_ENV !== "production") {
                    pairs[0].studentIds.push("mock-student-dev");
                }
            }
        }
        session.pairs = pairs;
        shared_config_1.logger.info(`[Service] Generated ${pairs.length} conversation pair(s) for session ${session.sessionId}`);
    }
    // Serialize pairs with display info for broadcast to tutor + students
    getPairsPayload(session) {
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
    submitAnswer(sessionId, studentId, answer) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return undefined;
        const participant = session.participants.get(studentId);
        if (!participant)
            return undefined;
        // Normalize answer (trim whitespace, convert to string if MCQ)
        const normalizedAnswer = typeof answer === 'string' ? answer.trim() : answer;
        participant.hasAnsweredCurrentPhase = true;
        participant.latestAnswer = normalizedAnswer;
        let allAnswered = true;
        if (session.participants.size === 0) {
            allAnswered = false;
        }
        else {
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
    toggleSentenceFlag(sessionId, studentId, sentenceIndex) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return undefined;
        if (!session.sentenceFlags)
            session.sentenceFlags = new Map();
        let voters = session.sentenceFlags.get(sentenceIndex);
        if (!voters) {
            voters = new Set();
            session.sentenceFlags.set(sentenceIndex, voters);
        }
        let flagged;
        if (voters.has(studentId)) {
            voters.delete(studentId);
            flagged = false;
        }
        else {
            voters.add(studentId);
            flagged = true;
        }
        if (voters.size === 0)
            session.sentenceFlags.delete(sentenceIndex);
        return { session, sentenceIndex, count: voters.size, flagged };
    }
    // Serialize all flag counts for broadcast: { sentenceIndex: count }
    getFlagCounts(session) {
        const result = {};
        if (!session.sentenceFlags)
            return result;
        for (const [idx, voters] of session.sentenceFlags.entries()) {
            if (voters.size > 0)
                result[idx] = voters.size;
        }
        return result;
    }
    deleteSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return false;
        this.sessions.delete(sessionId);
        if (session.classId) {
            this.classToSessionId.delete(session.classId);
        }
        return true;
    }
}
exports.lessonSessionService = new LessonSessionService();
