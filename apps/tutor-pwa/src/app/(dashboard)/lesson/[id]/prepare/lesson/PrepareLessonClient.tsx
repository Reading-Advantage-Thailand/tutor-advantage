"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, GraduationCap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhaseManager } from "../../interactive/PhaseManager";
import { getGamesByCategory } from "@/lib/liveLessonGames";
import {
  AnswerData,
  ArticleData,
  GamePhaseState,
  Participant,
  TutorSessionData,
} from "@/lib/lesson-types";
import TutorGuideOverlay, { TutorGuideStep } from "./TutorGuideOverlay";

type PreparationMode = "explore" | "guided";

type PreparationArticle = ArticleData & {
  passage?: string;
  words?: any[];
  sentences?: any[];
  multipleChoiceQuestions?: any[];
  shortAnswerQuestions?: any[];
  content?: {
    words?: any[];
    sentences?: any[];
    comprehensionQuestions?: any[];
    shortAnswerQuestions?: any[];
    [key: string]: any;
  };
  [key: string]: any;
};

const TOTAL_PHASES = 19;
const PREPARATION_MOCK_ANSWER_INTERVAL_MS = 1400;
const PREPARATION_MOCK_ANSWER_COUNT = 4;
const PREPARATION_MOCK_WAIT_BUFFER_MS = 800;
const PREPARATION_MOCK_GAME_RESULT_INTERVAL_MS = 1400;
const PREPARATION_MOCK_GAME_RESULT_COUNT = 4;
const preparationStudentStatusPhases = new Set([3, 8, 9, 10, 12, 13, 14, 16, 17]);

const phaseGuidance: Record<number, { title: string; description: string; tip: string }> = {
  1: { title: "เปิดบทเรียน", description: "ใช้หน้าจอจริงเพื่อแนะนำบทความ ตั้งเป้าหมาย และชวนให้นักเรียนคาดเดาเรื่อง", tip: "เริ่มด้วยคำถามสั้น ๆ ก่อนเฉลยเนื้อหา" },
  2: { title: "คำศัพท์สำคัญ", description: "เปิดคำศัพท์จาก Lesson จริง กดฟังเสียง และเตรียมคำอธิบายให้กระชับ", tip: "ให้เด็กฟังและอ่านตามก่อนอธิบายความหมาย" },
  3: { title: "บัตรคำศัพท์", description: "ดูว่าหน้าบัตรคำทำงานอย่างไร แล้วเตรียมคำถามให้นักเรียนเรียกคืนความหมาย", tip: "ชวนเด็กใช้คำศัพท์ในประโยคของตัวเอง" },
  4: { title: "อ่านบทความ", description: "ใช้บทอ่านจริงเพื่อวางจังหวะการอ่านและเลือกจุดที่ควรหยุดฟังเสียง", tip: "อ่านรอบแรกเพื่อจับใจความก่อนแปลทีละคำ" },
  5: { title: "เก็บคำศัพท์", description: "ทบทวนจุดในบทอ่านที่ควรหยุดอธิบายคำศัพท์จากบริบท", tip: "ให้เด็กเดาความหมายจากคำรอบข้างก่อน" },
  6: { title: "อ่านเชิงลึก", description: "ใช้หน้าจอจริงพานักเรียนกลับไปหาหลักฐานและรายละเอียดในบทความ", tip: "ถามว่า Where do you see that in the text?" },
  7: { title: "เก็บประโยค", description: "เลือกประโยคหลัก ฟังเสียง และเตรียมให้นักเรียนอ่านซ้ำพร้อมสังเกตโครงสร้าง", tip: "ให้เด็กอธิบายว่าประโยคนี้ช่วยสื่อใจความอย่างไร" },
  8: { title: "ตรวจความเข้าใจ", description: "อ่านคำถามและตัวเลือกจาก Lesson จริง แล้วเตรียมจังหวะให้เด็กคิดก่อนเฉลย", tip: "เน้นเหตุผลและหลักฐาน ไม่ใช่แค่คำตอบที่ถูก" },
  9: { title: "ตอบแบบมีโครง", description: "ดูคำถามปลายเปิดและ sentence frame ที่ใช้ช่วยให้นักเรียนเรียบเรียงคำตอบ", tip: "เริ่มจากคำตอบสั้น ๆ แล้วค่อยต่อเหตุผล" },
  10: { title: "ฝึกคำศัพท์", description: "ทดลองดูโจทย์คำศัพท์จริงและเตรียมคำอธิบายหลังนักเรียนเลือกคำตอบ", tip: "ชวนเด็กยกตัวอย่างประโยคเพิ่ม" },
  11: { title: "เกมคำศัพท์", description: "ลองเปิดโหวตเกม เลือกเกม และดู Teacher Demo/Tutorial จาก component เกมจริง", tip: "สาธิตกติกาและวิธีตอบก่อนให้นักเรียนเล่น" },
  12: { title: "เติมคำในประโยค", description: "ใช้โจทย์เติมคำจริงเพื่อฝึกให้นักเรียนอาศัยบริบทและอ่านประโยคเต็ม", tip: "ให้อ่านประโยคเต็มหลังตอบทุกครั้ง" },
  13: { title: "เรียงประโยค", description: "ดูโจทย์เรียงคำจริงและเตรียมคำถามให้เด็กสังเกต subject, verb และคำเชื่อม", tip: "ให้เด็กอ่านประโยคที่เรียงแล้วออกเสียง" },
  14: { title: "เขียนแบบมีโครง", description: "ใช้ prompt และโครงคำตอบจริงเพื่อวางแผนการเขียนก่อนลงมือเขียน", tip: "ตรวจให้มีใจความ เหตุผล และหลักฐานจากบทเรียน" },
  15: { title: "เกมประโยค", description: "ทดลองเปิดโหวตและสาธิตเกมประโยคจาก Lesson จริงก่อนใช้กับนักเรียน", tip: "ย้ำให้อ่านประโยคให้จบก่อนส่งคำตอบ" },
  16: { title: "คำถามภาษา", description: "เตรียมพื้นที่ให้เด็กถามเรื่องภาษาและใช้เนื้อหาบทเรียนช่วยอธิบาย", tip: "ขอให้เด็กยกตัวอย่างจากบทความเมื่อถามเรื่องภาษา" },
  17: { title: "Reflection", description: "ใช้คำถามสะท้อนการเรียนรู้เพื่อดูสิ่งที่เด็กเข้าใจและสิ่งที่ควรฝึกต่อ", tip: "เปลี่ยนคำตอบของเด็กให้เป็นเป้าหมายครั้งถัดไป" },
  18: { title: "สนทนาจับคู่", description: "ดูคำถามชวนคุยและแนวทางดูแลคู่สนทนาจาก Lesson จริง", tip: "เดินฟังแต่ละคู่และจดประโยคที่น่าสนใจ" },
  19: { title: "สรุปผล", description: "ปิดบทเรียนด้วยหน้าสรุปผลจริง และเตรียมคำพูดเพื่อชื่นชมความพยายาม", tip: "ใช้คะแนนเป็นข้อมูลพัฒนาการ ไม่ใช่เพื่อเปรียบเทียบเด็ก" },
};

function normaliseArticle(article: PreparationArticle): ArticleData {
  const content = article.content || {};
  const words = Array.isArray(article.words) ? article.words : Array.isArray(content.words) ? content.words : [];
  const sentences = Array.isArray(article.sentences) ? article.sentences : Array.isArray(content.sentences) ? content.sentences : [];
  const multipleChoiceQuestions = Array.isArray(article.multipleChoiceQuestions)
    ? article.multipleChoiceQuestions
    : Array.isArray(content.comprehensionQuestions)
      ? content.comprehensionQuestions
      : [];
  const shortAnswerQuestions = Array.isArray(article.shortAnswerQuestions)
    ? article.shortAnswerQuestions
    : Array.isArray(content.shortAnswerQuestions)
      ? content.shortAnswerQuestions
      : [];

  return {
    ...article,
    id: String(article.id),
    title: String(article.title || "Untitled lesson"),
    words,
    sentences,
    multipleChoiceQuestions,
    shortAnswerQuestions,
    content: {
      ...content,
      words,
      sentences,
      comprehensionQuestions: multipleChoiceQuestions,
      shortAnswerQuestions,
    },
  } as ArticleData;
}

function buildInitialPhaseIndices() {
  return Object.fromEntries(Array.from({ length: TOTAL_PHASES }, (_, index) => [index + 1, 0]));
}

export default function PrepareLessonClient({
  classId,
  article,
  mode,
}: {
  classId: string;
  article: PreparationArticle;
  mode: PreparationMode;
}) {
  const router = useRouter();
  const articleData = useMemo(() => normaliseArticle(article), [article]);
  const [currentPhase, setCurrentPhase] = useState(1);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(0);
  const [gameState, setGameState] = useState<GamePhaseState | null>(null);
  const [guideOpen, setGuideOpen] = useState(mode === "guided");
  const [guideIndex, setGuideIndex] = useState(0);
  const [preparationAnswersCompletePhase, setPreparationAnswersCompletePhase] = useState<number | null>(null);
  const [preparationGameVotesCompletePhase, setPreparationGameVotesCompletePhase] = useState<number | null>(null);
  const [preparationGameResultsCompletePhase, setPreparationGameResultsCompletePhase] = useState<number | null>(null);
  const [preparationGuideReadyPhase, setPreparationGuideReadyPhase] = useState<number | null>(null);
  const [preparationGameResultsReadyFallbackPhase, setPreparationGameResultsReadyFallbackPhase] = useState<number | null>(null);
  const guideResultTransitionPhaseRef = useRef<number | null>(null);
  const participants: Participant[] = [];
  const allAnsweredData: AnswerData[] = [];
  const phaseSelectedIndices = useMemo(buildInitialPhaseIndices, []);

  const closePreparation = useCallback(() => {
    router.push(`/dashboard/classes/${classId}`);
  }, [classId, router]);

  const sessionData = useMemo<TutorSessionData>(() => ({
    sessionId: `preparation-${articleData.id}`,
    currentPhase,
    activeSentenceIndex,
    phaseSelectedIndices,
    articleData,
    pairs: null,
    gameState,
  }), [activeSentenceIndex, articleData, currentPhase, gameState, phaseSelectedIndices]);

  const changePhase = useCallback((phase: number) => {
    if (phase <= 0) {
      closePreparation();
      return;
    }

    setCurrentPhase(Math.min(TOTAL_PHASES, phase));
    if (phase !== 11 && phase !== 15) setGameState(null);
  }, [closePreparation]);

  const syncActiveSentence = useCallback((index: number) => {
    setActiveSentenceIndex(index);
  }, []);

  const handlePreparationAnswersComplete = useCallback((phase: number) => {
    setPreparationAnswersCompletePhase(phase);
  }, []);

  const handlePreparationGameVotesComplete = useCallback((phase: number) => {
    setPreparationGameVotesCompletePhase(phase);
  }, []);

  const handlePreparationGameResultsComplete = useCallback((phase: number) => {
    setPreparationGameResultsCompletePhase(phase);
  }, []);

  const startGameVote = useCallback((phase?: number) => {
    const gamePhase = phase === 15 ? 15 : 11;
    setGameState({
      phase: gamePhase,
      category: gamePhase === 15 ? "sentence" : "vocabulary",
      status: "voting",
      votes: {},
      results: {},
    });
  }, []);

  const lockGameVote = useCallback(() => {
    setGameState((current) => {
      if (!current) return current;
      const selectedGame = getGamesByCategory(current.category).find((game) => game.enabled !== false);
      return {
        ...current,
        status: "ready",
        selectedGameId: selectedGame?.id,
      };
    });
  }, []);

  const startGameIntro = useCallback((options: { tutorialEnabled: boolean; teacherDemoEnabled: boolean }) => {
    setGameState((current) => {
      if (!current) return current;
      const nextStatus = options.teacherDemoEnabled
        ? "teacher_demo"
        : options.tutorialEnabled
          ? "tutorial"
          : "results";
      return {
        ...current,
        status: nextStatus,
        tutorialEnabled: options.tutorialEnabled,
        teacherDemoEnabled: options.teacherDemoEnabled,
      };
    });
  }, []);

  const advanceGameIntro = useCallback(() => {
    setGameState((current) => {
      if (!current) return current;
      if (current.status === "teacher_demo" && current.tutorialEnabled) {
        return { ...current, status: "tutorial" };
      }
      return { ...current, status: "results" };
    });
  }, []);

  const guideSteps = useMemo<TutorGuideStep[]>(() => {
    const vocabularyTarget = articleData.words?.length
      ? "vocabulary-first-audio"
      : "phase-content";
    const introductionSteps: TutorGuideStep[] = [
      {
        target: "lesson-control-panel",
        title: "รู้จักแผงควบคุม Lesson",
        description: "แผงนี้ใช้ดู Phase ปัจจุบัน เปิด Full screen ซ่อนแถบควบคุม และกดไปยังช่วงถัดไปของบทเรียน",
        tip: "ในห้องจริง แผงนี้คือจุดควบคุมการสอนทั้งหมดของติวเตอร์",
        phase: 0,
        action: "none",
      },
      {
        target: "fullscreen-button",
        title: "เปิด Full screen",
        description: "กดปุ่ม Full screen เพื่อขยาย Lesson ให้เต็มพื้นที่ เหมาะสำหรับแชร์หน้าจอหรือสอนบนจอใหญ่",
        tip: "หลังเปิดแล้ว ให้สังเกตแถบควบคุมที่ลอยอยู่ด้านล่างของหน้าจอ",
        phase: 0,
        action: "click",
        autoAdvance: true,
      },
    ];

    const phaseSteps = Array.from({ length: TOTAL_PHASES }, (_, index) => index + 1).flatMap((phase) => {
      const guidance = phaseGuidance[phase];
      const isGamePhase = phase === 11 || phase === 15;
      const isLastPhase = phase === TOTAL_PHASES;
      return [
        {
          target: phase === 2 ? vocabularyTarget : "phase-content",
          title: `Phase ${phase}: ${guidance.title}`,
          description: guidance.description,
          tip: guidance.tip,
          phase: phase - 1,
          action: "click" as const,
          autoAdvance: true,
        },
        {
          target: isLastPhase
            ? "preparation-exit-button"
            : isGamePhase
              ? "game-primary-button"
              : "phase-next-button",
          title: isLastPhase ? "จบการเตรียมสอน" : isGamePhase ? "ทดลองขั้นตอนเกม" : `ไป Phase ${phase + 1}`,
          description: isLastPhase
            ? "เมื่อดูหน้าสรุปผลจริงแล้ว กดปุ่มจบเพื่อกลับไปหน้าคลาส"
            : isGamePhase
              ? "กดปุ่มหลักของ Lesson จริงเพื่อเปิดโหวต เลือกเกม และดูขั้นตอน Demo/Tutorial"
              : "กดปุ่มถัดไปของ Lesson จริงเพื่อไปยัง Phase ถัดไป",
          phase: phase - 1,
          action: "click" as const,
          autoAdvance: true,
        },
      ];
    });

    const phaseFocusGuidance: Record<number, Array<{
      target: string;
      title: string;
      description: string;
      tip: string;
      action?: "click" | "none";
      autoAdvance?: boolean;
    }>> = {
      1: [
        { target: "phase-1-overview", title: "ภาพรวมบทเรียน", description: "ดูชื่อเรื่อง ระดับภาษา และภาพรวมของบทเรียนจริงก่อนเริ่มสอน", tip: "ใช้ส่วนนี้ชวนให้นักเรียนเดาเรื่องจากภาพและชื่อเรื่อง" },
        { target: "phase-1-checklist", title: "Checklist เปิดบทเรียน", description: "ส่วนนี้คือสิ่งที่ติวเตอร์ควรทำในช่วงเริ่มต้น: แนะนำเรื่อง ตั้งเป้าหมาย และชวนคิด", tip: "เลือกทำทีละข้อ ไม่ต้องอ่านทุกข้อความบนจอให้นักเรียนฟัง" },
      ],
      2: [
        { target: "phase-2-vocabulary-list", title: "รายการคำศัพท์", description: "ดูคำศัพท์ทั้งหมดที่ Lesson เตรียมไว้ พร้อมคำแปลและคำอธิบายสำหรับใช้ปูพื้นฐาน", tip: "เลือกเฉพาะคำที่จำเป็นต่อการเข้าใจเรื่อง ไม่จำเป็นต้องสอนทุกคำ" },
        { target: "vocabulary-first-audio", title: "ฟังเสียงคำศัพท์ตัวอย่าง", description: "กดปุ่มลำโพงของคำแรกเพื่อฟังการออกเสียงจาก component จริงของ Lesson", tip: "ให้เด็กฟังก่อน แล้วชวนอ่านตาม 1–2 รอบ", action: "click", autoAdvance: true },
      ],
      3: [
        { target: "phase-3-flashcards", title: "รู้จักหน้าบัตรคำศัพท์", description: "นี่คือ Flashcard จริงของ Lesson ใช้สำหรับให้เด็กเห็นคำศัพท์ทีละใบและลองนึกความหมายด้วยตัวเอง", tip: "เริ่มจากให้เด็กอ่านคำศัพท์บนหน้าใบการ์ดก่อน" },
        { target: "phase-3-flashcard-card", title: "กดที่การ์ดเพื่อพลิกดู", description: "คลิกที่ตัวการ์ดเพื่อสลับระหว่างหน้าคำศัพท์และหน้าความหมายได้ทันที", tip: "ให้เด็กลองตอบความหมายก่อน แล้วค่อยพลิกการ์ดดูเฉลย", action: "click", autoAdvance: true },
        { target: "phase-3-flashcard-reveal", title: "เปิดเฉลยหรือกลับไปดูคำศัพท์", description: "ปุ่มนี้ทำงานเหมือนการพลิกการ์ด ใช้เปิดคำแปลหลังจากให้นักเรียนลองตอบแล้ว หรือกลับไปดูคำศัพท์อีกครั้ง", tip: "อย่าเปิดเฉลยทันที ให้เว้นเวลาคิดสั้น ๆ ก่อน", action: "click", autoAdvance: true },
        { target: "phase-3-flashcard-progress", title: "ดูความคืบหน้าของ Flashcard", description: "แถบนี้บอกว่ากำลังอยู่การ์ดใบที่เท่าไร และทำไปแล้วกี่เปอร์เซ็นต์ของชุดคำศัพท์", tip: "ใช้บอกนักเรียนว่าตอนนี้อยู่ช่วงไหนของภารกิจ" },
        { target: "phase-3-flashcard-next", title: "ไปการ์ดใบถัดไป", description: "กดปุ่ม ถัดไป เพื่อเปลี่ยนเป็นคำศัพท์ใบใหม่ ระบบจะกลับไปแสดงหน้าคำศัพท์ให้อัตโนมัติ", tip: "ให้เด็กอ่านคำใหม่ ออกเสียง และเดาความหมายก่อนเปิดเฉลยอีกครั้ง", action: "click", autoAdvance: true },
      ],
      4: [
        { target: "phase-4-reading-passage", title: "บทอ่านจริง", description: "นี่คือพื้นที่ที่นักเรียนอ่านตามและกดเลือกประโยคเพื่อโฟกัสระหว่างการอ่าน", tip: "สาธิตการอ่านหนึ่งย่อหน้า แล้วค่อยให้นักเรียนอ่านต่อ" },
        { target: "phase-4-audio-player", title: "แผงเสียงอ่านบทความ", description: "แผงนี้ใช้ควบคุมเสียง เล่นย้อนหลัง ข้ามประโยค และดูตำแหน่งการอ่าน", tip: "สังเกตว่าแผงควบคุมจะลอยอยู่ด้านล่างของ Lesson" },
        { target: "phase-4-play-button", title: "เริ่มเสียงอ่าน", description: "กดปุ่มเล่นเพื่อให้นักเรียนฟังจังหวะและการออกเสียงจากบทอ่านจริง", tip: "หยุดเป็นช่วง ๆ เพื่อให้เด็กอ่านตาม", action: "click", autoAdvance: true },
      ],
      5: [
        { target: "phase-5-passage", title: "คำศัพท์ในบริบท", description: "ดูคำศัพท์ที่ถูกไฮไลต์อยู่ในบทอ่าน เพื่ออธิบายความหมายจากประโยครอบข้าง", tip: "ถามให้เด็กเดาความหมายก่อนเปิดคำแปล" },
        { target: "phase-5-vocabulary", title: "Vocabulary List สำหรับทบทวน", description: "ใช้รายการนี้เทียบคำศัพท์กับความหมาย ชนิดของคำ และคำแปลภาษาไทย", tip: "เลือกคำที่เด็กยังสับสนมาทบทวนซ้ำ" },
        { target: "phase-5-first-audio", title: "ฟังเสียงคำศัพท์ในบริบท", description: "กดลำโพงของคำแรกเพื่อฟังเสียงจากรายการคำศัพท์จริง", tip: "ให้เด็กออกเสียงตาม แล้วกลับไปชี้คำในบทอ่าน", action: "click", autoAdvance: true },
      ],
      6: [
        { target: "phase-6-passage", title: "อ่านเพื่อหาหลักฐาน", description: "ใช้บทอ่านจริงเป็นหลักฐานประกอบคำตอบ ไม่ใช่เดาจากความรู้สึกอย่างเดียว", tip: "ชวนถามว่า Where do you see that in the text?" },
        { target: "phase-6-questions", title: "Comprehension Guide", description: "นี่คือชุดคำถามที่ใช้พานักเรียนกลับไปค้นหาคำตอบจากบทอ่าน", tip: "ให้เด็กชี้หรืออธิบายประโยคที่เป็นหลักฐาน" },
        { target: "phase-6-first-question", title: "คำถามข้อแรก", description: "กดดูคำถามทีละข้อและเตรียมจังหวะให้นักเรียนคิดก่อนช่วยอธิบาย", tip: "ใช้ปุ่มเสียงเมื่ออยากให้นักเรียนฟังคำถามซ้ำ" },
      ],
      7: [
        { target: "phase-7-sentences", title: "Key Sentences", description: "เลือกประโยคสำคัญจากบทเรียนเพื่อฝึกอ่าน โครงสร้าง และคำศัพท์ที่ไฮไลต์", tip: "เริ่มจากประโยคที่สั้นและมีคำศัพท์เป้าหมาย" },
        { target: "phase-7-first-audio", title: "ฟังประโยคตัวอย่าง", description: "กดลำโพงของประโยคแรกเพื่อฟังจังหวะการอ่านจาก Lesson จริง", tip: "ให้นักเรียนอ่านตาม แล้วถามว่าประโยคนี้สื่อความหมายอย่างไร", action: "click", autoAdvance: true },
        { target: "phase-7-article", title: "ย้อนดูประโยคในบทอ่าน", description: "ใช้ส่วนนี้เชื่อมประโยคสำคัญกลับไปยังบริบทของเรื่อง", tip: "ชี้คำศัพท์หรือโครงสร้างที่ต้องการให้เด็กสังเกต" },
      ],
      8: [
        { target: "phase-8-question", title: "คำถามตรวจความเข้าใจ", description: "อ่านคำถามจาก Lesson จริงและเตรียมให้นักเรียนคิดก่อนเห็นตัวเลือก", tip: "ถามเหตุผลประกอบคำตอบเสมอ" },
        { target: "phase-8-question-audio", title: "เสียงอ่านคำถาม", description: "กดลำโพงเพื่อฟังคำถาม แล้วใช้เป็นตัวอย่างการอ่านออกเสียง", tip: "เหมาะสำหรับคำถามยาวหรือคำที่นักเรียนยังไม่คุ้น", action: "click", autoAdvance: true },
        { target: "phase-8-options", title: "ตัวเลือกคำตอบ", description: "ดูรูปแบบตัวเลือกและเตรียมชวนเด็กเปรียบเทียบหลักฐานของแต่ละข้อ", tip: "ให้เด็กอธิบายว่าทำไมตัวเลือกอื่นจึงไม่ใช่" },
      ],
      9: [
        { target: "phase-9-question", title: "คำถามปลายเปิด", description: "ดูคำถามที่ให้นักเรียนเรียบเรียงคำตอบด้วยภาษาของตัวเอง", tip: "เริ่มจากคำตอบสั้น ๆ แล้วค่อยขอเหตุผลเพิ่ม" },
        { target: "phase-9-question-audio", title: "เสียงอ่านคำถามปลายเปิด", description: "กดลำโพงเพื่อฟังคำถามและเตรียมสาธิตการจับใจความก่อนตอบ", tip: "หยุดหลังคำสำคัญเพื่อให้นักเรียนทวนคำถาม", action: "click", autoAdvance: true },
      ],
      10: [
        { target: "phase-10-question", title: "โจทย์คำศัพท์", description: "ดูรูปแบบคำถามที่ให้นักเรียนเลือกความหมายของคำศัพท์จากบทเรียน", tip: "ให้เด็กลองนึกความหมายเองก่อนอ่านข้อความตัวเลือก" },
        { target: "phase-10-question", title: "อ่านโจทย์และคำศัพท์เป้าหมาย", description: "อ่านโจทย์และคำศัพท์เป้าหมายจาก Lesson จริงเพื่อเตรียมให้นักเรียนคิดความหมายก่อนเลือกคำตอบ", tip: "Phase นี้ไม่มีปุ่มลำโพง ให้ติวเตอร์อ่านโจทย์หรือใช้การออกเสียงของตัวเองแทน" },
        { target: "phase-10-options", title: "ตัวเลือกความหมาย", description: "เปรียบเทียบความหมายของตัวเลือกและเตรียมอธิบายคำตอบหลังเด็กเลือก", tip: "ยกตัวอย่างประโยคเพิ่มเมื่อคำศัพท์มีหลายความหมาย" },
      ],
      11: [
        { target: "phase-11-game", title: "เกมคำศัพท์", description: "สำรวจ flow ของเกมจริง ตั้งแต่เปิดโหวต เลือกเกม ไปจนถึง Teacher Demo และ Tutorial", tip: "ติวเตอร์ควรสาธิตกติกาและวิธีตอบก่อนให้นักเรียนเริ่มเล่น" },
      ],
      12: [
        { target: "phase-12-question", title: "เติมคำในประโยค", description: "ดูประโยคจริงและช่องว่างที่ให้นักเรียนใช้บริบทช่วยเลือกคำ", tip: "ให้นักเรียนอ่านประโยคเต็มหลังเฉลยทุกครั้ง" },
        { target: "phase-12-question-audio", title: "ฟังโจทย์เติมคำ", description: "กดลำโพงเพื่อฟังประโยคและจับคำที่เป็นกุญแจของโจทย์", tip: "ชี้ให้เด็กฟังคำก่อนและหลังช่องว่าง", action: "click", autoAdvance: true },
        { target: "phase-12-options", title: "ตัวเลือกเติมคำ", description: "ดูตัวเลือกและเตรียมให้เด็กอธิบายว่าคำไหนเข้ากับความหมายและไวยากรณ์", tip: "เน้นทั้งความหมายและรูปประโยค" },
      ],
      13: [
        { target: "phase-13-question", title: "เรียงประโยค", description: "ดูโจทย์ที่ให้นักเรียนจัดลำดับคำให้เป็นประโยคที่ถูกต้อง", tip: "ให้เด็กหา subject และ verb ก่อนเรียงทั้งหมด" },
        { target: "phase-13-question-audio", title: "ฟังโจทย์เรียงประโยค", description: "กดลำโพงเพื่อฟังโจทย์และเตรียมอ่านประโยคที่เรียงแล้ว", tip: "หลังจัดเรียงเสร็จ ให้เด็กอ่านออกเสียงทั้งประโยค", action: "click", autoAdvance: true },
        { target: "phase-13-options", title: "คำสำหรับจัดเรียง", description: "ดูชุดคำที่นักเรียนต้องใช้สร้างประโยค และเตรียมอธิบายตัวเชื่อม", tip: "ถามเหตุผลของตำแหน่งคำ ไม่ใช่ให้เดาตามรูปแบบอย่างเดียว" },
      ],
      14: [
        { target: "phase-14-writing", title: "Guided Writing", description: "ดู prompt และโครงคำตอบที่ช่วยให้นักเรียนวางแผนการเขียนก่อนลงมือจริง", tip: "ชวนเด็กพูดไอเดียออกมาก่อน แล้วค่อยเขียนเป็นประโยค" },
        { target: "phase-14-question-audio", title: "ฟัง Writing Prompt", description: "กดลำโพงเพื่อฟังโจทย์การเขียนและเตรียมเน้นคำสั่งสำคัญ", tip: "ตรวจว่าคำตอบมีเหตุผลและเชื่อมกับบทเรียน", action: "click", autoAdvance: true },
      ],
      15: [
        { target: "phase-15-game", title: "เกมประโยค", description: "สำรวจ flow ของเกมที่ใช้ฝึกการเรียงหรือสร้างประโยคด้วย component เกมจริง", tip: "สาธิตวิธีอ่านประโยคหลังจบแต่ละรอบ" },
      ],
      16: [
        { target: "phase-16-question-list", title: "Language Questions", description: "ดูพื้นที่รวมคำถามภาษาที่นักเรียนสงสัย และคำตอบแนะนำจาก Lesson", tip: "ใช้คำถามของนักเรียนเป็นโอกาสทบทวน grammar หรือ vocabulary" },
      ],
      17: [
        { target: "phase-17-reflection", title: "Reflection", description: "ใช้คำถามสะท้อนการเรียนรู้เพื่อดูว่านักเรียนเข้าใจอะไรและยังต้องฝึกอะไรต่อ", tip: "เปลี่ยนคำตอบให้เป็นเป้าหมายสำหรับครั้งถัดไป" },
      ],
      18: [
        { target: "phase-18-starters", title: "คำถามเริ่มบทสนทนา", description: "เลือกคำถามชวนคุยเพื่อให้นักเรียนจับคู่พูดคุยเกี่ยวกับเรื่องและคำศัพท์", tip: "เดินฟังแต่ละคู่และจดประโยคที่ควรนำมา feedback" },
      ],
      19: [
        { target: "phase-19-summary", title: "สรุปผลบทเรียน", description: "ดูหน้าสรุปผลและใช้ข้อมูลเพื่อชื่นชมความพยายาม พร้อมปิดบทเรียนอย่างมีเป้าหมาย", tip: "ใช้คะแนนเป็นข้อมูลพัฒนา ไม่ใช่การเปรียบเทียบนักเรียน" },
      ],
    };

    const resolveFocusTarget = (focus: (typeof phaseFocusGuidance)[number][number]) => {
      const hasWords = Boolean(articleData.words?.length);
      const hasSentences = Boolean(articleData.sentences?.length);
      const hasQuestions = Boolean(articleData.shortAnswerQuestions?.length);
      const hasArticleAudio = Boolean(
        (articleData as any)?.audio_url ||
        (articleData as any)?.raAudioUrl ||
        (articleData as any)?.readingAdvantageAudioUrl ||
        (articleData as any)?.audio_manifest,
      );
      if ((focus.target === "phase-4-audio-player" || focus.target === "phase-4-play-button") && !hasArticleAudio) {
        return { ...focus, target: "phase-4-reading-passage", action: "none" as const, autoAdvance: false };
      }
      if (focus.target === "vocabulary-first-audio" && !hasWords) {
        return { ...focus, target: "phase-2-vocabulary-list", action: "none" as const, autoAdvance: false };
      }
      if (focus.target === "phase-5-first-audio" && !hasWords) {
        return { ...focus, target: "phase-5-vocabulary", action: "none" as const, autoAdvance: false };
      }
      if (focus.target === "phase-7-first-audio" && !hasSentences) {
        return { ...focus, target: "phase-7-sentences", action: "none" as const, autoAdvance: false };
      }
      if ((focus.target === "phase-6-first-question" || focus.target === "phase-9-question-audio" || focus.target === "phase-14-question-audio") && !hasQuestions) {
        return {
          ...focus,
          target: focus.target === "phase-6-first-question" ? "phase-6-questions" : focus.target.replace("-question-audio", "-question"),
          action: "none" as const,
          autoAdvance: false,
        };
      }
      return focus;
    };

    const detailedPhaseSteps = phaseSteps.flatMap((step, stepIndex) => {
      if (stepIndex % 2 === 1) {
        const phase = Math.floor(stepIndex / 2) + 1;
        const isGamePhase = phase === 11 || phase === 15;
        const isLastPhase = phase === TOTAL_PHASES;
        if (isGamePhase && !isLastPhase) {
          return [
            step,
            {
              target: `phase-${phase}-game`,
              title: "ดูนักเรียนเล่นเกมจนจบ",
              description: "หลังจากปิดโหวตแล้ว ให้สังเกตสถานะ LIVE MONITORING นักเรียนจะค่อย ๆ เล่นเสร็จทีละคน ก่อนที่ Lesson จะเปิดหน้าสรุปผล",
              tip: "ในห้องจริง ใช้ช่วงนี้ดูว่าใครยังเล่นอยู่ และค่อยชวนสะท้อนวิธีคิดหลังผลสรุปแสดง",
              phase: phase - 1,
              action: "none" as const,
              waitForGameResults: true,
            } satisfies TutorGuideStep,
          ];
        }
        return [step];
      }
      const phase = Math.floor(stepIndex / 2) + 1;
      const guidance = phaseGuidance[phase];
      const isGamePhase = phase === 11 || phase === 15;
      const progressStep: TutorGuideStep = {
        target: "phase-progress",
        title: "Phase " + phase + ": " + guidance.title,
        description: "ดูแถบความคืบหน้าด้านบนเพื่อรู้ว่ากำลังอยู่ช่วงไหนของแผนการสอน",
        tip: "ในห้องเรียนจริง แถบนี้ช่วยให้ติวเตอร์เตรียมจังหวะและเวลาของแต่ละช่วง",
        phase: phase - 1,
        action: "none",
      };
      const focusSteps: TutorGuideStep[] = (phaseFocusGuidance[phase] || [])
        .map(resolveFocusTarget)
        .map((focus) => ({
          ...focus,
          phase: phase - 1,
          action: focus.action || "none",
        }));
      const studentStatusStep: TutorGuideStep[] = preparationStudentStatusPhases.has(phase)
        ? [{
            target: `phase-${phase}-student-status`,
            title: "ดูสถานะการตอบของนักเรียน",
            description: "หลังจากสอนหน้าคำถามแล้ว ให้ดูแผงนี้เพื่อเช็กว่านักเรียนกำลังตอบอยู่กี่คนและใครตอบแล้ว",
            tip: "ในห้องเรียนจริง รอให้นักเรียนตอบครบก่อนค่อยเปิดหน้าสรุปผลและชวนวิเคราะห์คำตอบ",
            phase: phase - 1,
            action: "none",
            waitForMockAnswers: true,
          }]
        : [];
      const gameVoteStatusStep: TutorGuideStep[] = isGamePhase
        ? [{
            target: `phase-${phase}-game`,
            title: "รอผลโหวตจากนักเรียน",
            description: "ดูการ์ดเกมและจำนวนโหวตที่ทยอยเข้ามา เมื่อ Mock นักเรียนโหวตครบแล้วจึงค่อยปิดโหวตจากแผงควบคุม Lesson",
            tip: "อย่ากดปิดโหวตระหว่างที่จำนวนโหวตยังไม่ครบ เพราะในห้องจริงควรรอให้นักเรียนเลือกเกมก่อน",
            phase: phase - 1,
            action: "none" as const,
            waitForMockVotes: true,
          }]
        : [];
      return [
        progressStep,
        ...focusSteps,
        ...gameVoteStatusStep,
        ...studentStatusStep,
        {
          ...step,
          target: "phase-content",
          action: "none" as const,
          autoAdvance: false,
        },
      ];
    });

    return [...introductionSteps, ...detailedPhaseSteps];
  }, [articleData]);

  useEffect(() => {
    if (!guideOpen) return;
    const step = guideSteps[guideIndex];
    if (step) setCurrentPhase(step.phase + 1);
  }, [guideIndex, guideOpen, guideSteps]);

  useEffect(() => {
    setPreparationAnswersCompletePhase(null);
    setPreparationGameVotesCompletePhase(null);
    setPreparationGameResultsCompletePhase(null);
    setPreparationGuideReadyPhase(null);
    setPreparationGameResultsReadyFallbackPhase(null);
    guideResultTransitionPhaseRef.current = null;
  }, [currentPhase]);

  const openGuide = () => {
    setGuideIndex(0);
    setCurrentPhase(1);
    setGuideOpen(true);
  };

  const moveGuide = useCallback((direction: -1 | 1) => {
    const nextIndex = Math.max(0, Math.min(guideSteps.length - 1, guideIndex + direction));
    setGuideIndex(nextIndex);
  }, [guideIndex, guideSteps.length]);

  const currentGuideStep = guideSteps[guideIndex];
  const currentGuidePhase = currentGuideStep ? currentGuideStep.phase + 1 : null;
  const preparationGuideMockReady = Boolean(
    currentGuidePhase !== null &&
    (currentGuideStep?.waitForMockAnswers
      ? preparationAnswersCompletePhase === currentGuidePhase || preparationGuideReadyPhase === currentGuidePhase
      : currentGuideStep?.waitForMockVotes
        ? preparationGameVotesCompletePhase === currentGuidePhase
        : currentGuideStep?.waitForGameResults
          ? preparationGameResultsCompletePhase === currentGuidePhase || preparationGameResultsReadyFallbackPhase === currentGuidePhase
          : false),
  );
  const waitingForMockAnswers = Boolean(
    guideOpen &&
    currentGuideStep?.waitForMockAnswers &&
    !preparationGuideMockReady,
  );
  const waitingForMockVotes = Boolean(
    guideOpen &&
    currentGuideStep?.waitForMockVotes &&
    !preparationGuideMockReady,
  );
  const waitingForGameResults = Boolean(
    guideOpen &&
    currentGuideStep?.waitForGameResults &&
    !preparationGuideMockReady,
  );
  const waitingForPreparationMock = waitingForMockAnswers || waitingForMockVotes || waitingForGameResults;

  // Keep a small buffer after each mock sequence so the Lesson surface has
  // time to render its updated state before the Guide advances.
  useEffect(() => {
    if (!guideOpen || currentGuidePhase === null || !currentGuideStep) {
      return;
    }

    const isWaitingForAnswers = Boolean(currentGuideStep.waitForMockAnswers);
    const isWaitingForVotes = Boolean(currentGuideStep.waitForMockVotes);
    const isWaitingForResults = Boolean(currentGuideStep.waitForGameResults);
    if (!isWaitingForAnswers && !isWaitingForVotes && !isWaitingForResults) return;
    // The Lesson owns the vote state. Do not release this step on a timer;
    // otherwise the Guide can point at a disabled close-vote button while
    // the last mock votes are still arriving.
    if (isWaitingForVotes) return;

    const interval = isWaitingForResults
      ? PREPARATION_MOCK_GAME_RESULT_INTERVAL_MS
      : PREPARATION_MOCK_ANSWER_INTERVAL_MS;
    const count = isWaitingForResults
      ? PREPARATION_MOCK_GAME_RESULT_COUNT
      : PREPARATION_MOCK_ANSWER_COUNT;

    const timer = window.setTimeout(() => {
      if (isWaitingForAnswers) {
        setPreparationGuideReadyPhase(currentGuidePhase);
      } else {
        setPreparationGameResultsReadyFallbackPhase(currentGuidePhase);
      }
    }, interval * count + PREPARATION_MOCK_WAIT_BUFFER_MS);
    return () => window.clearTimeout(timer);
  }, [currentGuidePhase, currentGuideStep, guideOpen]);

  useEffect(() => {
    const isWaitingStep = Boolean(
      currentGuideStep?.waitForMockAnswers ||
      currentGuideStep?.waitForMockVotes ||
      currentGuideStep?.waitForGameResults,
    );
    if (
      !guideOpen ||
      !isWaitingStep ||
      currentGuidePhase === null ||
      !preparationGuideMockReady
    ) {
      return;
    }

    if (guideResultTransitionPhaseRef.current === guideIndex) return;
    guideResultTransitionPhaseRef.current = guideIndex;

    const timer = window.setTimeout(() => {
      setGuideIndex((previousIndex) =>
        Math.min(guideSteps.length - 1, previousIndex + 1),
      );
    }, 900);
    return () => window.clearTimeout(timer);
  }, [
    currentGuidePhase,
    currentGuideStep?.waitForGameResults,
    currentGuideStep?.waitForMockAnswers,
    currentGuideStep?.waitForMockVotes,
    guideIndex,
    guideOpen,
    guideSteps.length,
    preparationGuideMockReady,
    waitingForPreparationMock,
  ]);

  const handleGuideNext = useCallback(() => {
    if (
      (currentGuideStep?.waitForMockAnswers || currentGuideStep?.waitForMockVotes || currentGuideStep?.waitForGameResults) &&
      !preparationGuideMockReady
    ) {
      return;
    }

    if (guideIndex >= guideSteps.length - 1) {
      setGuideOpen(false);
      return;
    }
    moveGuide(1);
  }, [
    currentGuidePhase,
    currentGuideStep?.waitForGameResults,
    currentGuideStep?.waitForMockAnswers,
    currentGuideStep?.waitForMockVotes,
    guideIndex,
    guideSteps.length,
    moveGuide,
    preparationGuideMockReady,
    preparationAnswersCompletePhase,
  ]);

  return (
    <div className="min-h-screen w-full bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={`/dashboard/classes/${classId}`}>
              <Button variant="ghost" size="icon" className="size-9 shrink-0 rounded-xl">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <GraduationCap className="size-5 shrink-0 text-violet-500" />
                <h1 className="truncate text-base font-black text-foreground sm:text-lg">เตรียมสอน</h1>
                <span className="hidden rounded-full bg-violet-500/10 px-2.5 py-1 text-[10px] font-black text-violet-600 dark:text-violet-300 sm:inline-flex">
                  {mode === "guided" ? "Demo แบบมีไกด์" : "สำรวจอิสระ"}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">{articleData.title}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={guideOpen ? () => setGuideOpen(false) : openGuide}
              className="gap-1.5"
            >
              <Sparkles className="size-3.5" />
              <span className="hidden sm:inline">{guideOpen ? "ปิด Guide" : "เปิด Guide"}</span>
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={closePreparation} className="hidden sm:inline-flex">
              ออก
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
        <div className="min-h-[calc(100vh-150px)] rounded-3xl border border-border/60 bg-card p-3 shadow-sm sm:p-5">
          <PhaseManager
            currentPhase={currentPhase}
            participants={participants}
            totalAnswered={0}
            allAnsweredData={allAnsweredData}
            questionEnded={false}
            articleData={articleData}
            flagCounts={{}}
            sessionData={sessionData}
            changePhase={changePhase}
            syncActiveSentence={syncActiveSentence}
            endQuestion={() => undefined}
            startGameVote={startGameVote}
            lockGameVote={lockGameVote}
            startGameIntro={startGameIntro}
            advanceGameIntro={advanceGameIntro}
            bypassEmptyStudentGuard
            preparationMode
            onPreparationAnswersComplete={handlePreparationAnswersComplete}
            onPreparationGameVotesComplete={handlePreparationGameVotesComplete}
            onPreparationGameResultsComplete={handlePreparationGameResultsComplete}
            preparationMockAnswersStarted={!guideOpen || Boolean(currentGuideStep?.waitForMockAnswers)}
            onFinishSession={closePreparation}
            guideOverlay={guideOpen && currentGuideStep ? (
              <TutorGuideOverlay
                step={currentGuideStep}
                stepIndex={guideIndex}
                totalSteps={guideSteps.length}
                onPrevious={() => moveGuide(-1)}
                canAdvance={!waitingForPreparationMock}
                onNext={handleGuideNext}
                onClose={() => setGuideOpen(false)}
              />
            ) : null}
          />
        </div>
      </main>

    </div>
  );
}
