"use client";

import React, { useEffect, useRef, useState } from "react";
import PotionRushGame from "@/components/games/sentence/potion-rush/PotionRushGame";
import { usePotionRushStore, type Customer, type Ingredient } from "@/store/usePotionRushStore";
import { motion } from "framer-motion";
import {
  Beaker,
  CheckCircle2,
  MousePointer2,
  PauseCircle,
  ShoppingBag,
} from "lucide-react";
import { tx } from "@/lib/games/gameText";
import { demoOrders, walkthroughOrders } from "./demoContent";
import { TEACHING_STAGE_HEIGHT, useStageScale } from "./teachingStageSize";

export type PotionRushTeachingSentence = {
  term: string;
  translation?: string;
  thaiTranslation?: string;
  audioUrl?: string;
};

type TeachingMode = "teacher" | "tutorial";

type PotionRushTeachingGameProps = {
  vocabulary: PotionRushTeachingSentence[];
  mode: TeachingMode;
  fullscreen?: boolean;
  teacherDemoCompleted?: boolean;
  onTeacherDemoComplete?: () => void;
};

type TutorialMove = {
  word: string;
  from: { left: string; top: string };
  to: { left: string; top: string };
};

const FALLBACK_SENTENCES: PotionRushTeachingSentence[] = [
  {
    term: "Students read the article carefully",
    translation: "นักเรียนอ่านบทความอย่างละเอียด",
    thaiTranslation: "นักเรียนอ่านบทความอย่างละเอียด",
  },
  {
    term: "The teacher asks a follow up question",
    translation: "คุณครูถามคำถามติดตามผลเพิ่มเติม",
    thaiTranslation: "คุณครูถามคำถามติดตามผลเพิ่มเติม",
  },
];

const TUTORIAL_STEPS = [
  {
    title: "1. อ่านออเดอร์ของลูกค้า",
    detail: "กรอบด้านบนบอกประโยคที่ลูกค้าอยากได้ ลูกศรชี้ว่าเป็นของลูกค้าคนไหน",
    icon: ShoppingBag,
    target: { left: "50%", top: "24%", width: "94%", height: "46%" },
  },
  {
    title: "2. ลากคำทีละคำลงหม้อ",
    detail: "ลากคำจากสายพานลงหม้อใต้ลูกค้า เรียงตามลำดับประโยค คำผิดจะเด้งกลับมา",
    icon: MousePointer2,
    target: { left: "50%", top: "50%", width: "96%", height: "96%" },
  },
  {
    title: "3. คำครบแล้ว ยาเสิร์ฟเอง",
    detail: "เมื่อคำครบ หม้อจะขึ้นว่า “เสร็จ!” แล้วเสิร์ฟให้ลูกค้าเอง คะแนนมาจากคำที่วางถูก",
    icon: Beaker,
    target: { left: "50%", top: "30%", width: "94%", height: "58%" },
  },
] as const;

const wait = (duration: number) => new Promise<void>((resolve) => window.setTimeout(resolve, duration));

const TUTORIAL_TIMING = {
  readOrder: 3000,
  dragIngredient: 2200,
  inspectDroppedWord: 700,
  inspectCompletedPotion: 3000,
  completionSummary: 4000,
} as const;

const SCENE_HEIGHT = 844;
const MIN_SCENE_WIDTH = 390;

/** The game's scene width on this stage: words are placed in it, and this keeps them on the belt. */
const getTutorialSceneWidth = (stage: HTMLElement | null) => {
  if (typeof window === "undefined" || !stage) return MIN_SCENE_WIDTH;
  const sidebarWidth = window.innerWidth >= 1024
    ? Math.min(300, Math.max(220, window.innerWidth * 0.18))
    : 0;
  const boardWidth = stage.clientWidth - sidebarWidth;
  const boardHeight = stage.clientHeight;
  if (boardWidth <= 0 || boardHeight <= 0) return MIN_SCENE_WIDTH;
  const scale = boardWidth >= boardHeight
    ? boardHeight / SCENE_HEIGHT
    : Math.min(boardWidth / MIN_SCENE_WIDTH, boardHeight / SCENE_HEIGHT);
  return Math.max(MIN_SCENE_WIDTH, boardWidth / scale);
};

export function PotionRushTeachingGame({
  vocabulary,
  mode,
  fullscreen = false,
  teacherDemoCompleted = false,
  onTeacherDemoComplete,
}: PotionRushTeachingGameProps) {
  const sentences = React.useMemo(() => {
    const usable = demoOrders(vocabulary.filter((s) => s.term));
    return usable.length >= 1 ? usable : FALLBACK_SENTENCES;
  }, [vocabulary]);

  const [scriptStep, setScriptStep] = useState(0);
  const [scriptWordIndex, setScriptWordIndex] = useState(0);
  const [scriptMove, setScriptMove] = useState<TutorialMove | null>(null);
  const [scriptDone, setScriptDone] = useState(false);
  const [tutorialRound, setTutorialRound] = useState(0);
  const { stageRef, scale } = useStageScale<HTMLDivElement>();
  const stageNode = useRef<HTMLDivElement | null>(null);
  const setStage = React.useCallback((node: HTMLDivElement | null) => {
    stageNode.current = node;
    stageRef(node);
  }, [stageRef]);
  const scenePrepared = useRef(false);
  const scriptStarted = useRef(false);
  const tutorialScene = useRef<{ customer: Customer; ingredients: Ingredient[] } | null>(null);

  const gameState = usePotionRushStore((state) => state.gameState);
  const customers = usePotionRushStore((state) => state.customers);
  const conveyorItems = usePotionRushStore((state) => state.conveyorItems);
  const prepareTutorialScene = usePotionRushStore((state) => state.prepareTutorialScene);
  const handleDropIngredient = usePotionRushStore((state) => state.handleDropIngredient);
  const pauseGame = usePotionRushStore((state) => state.pauseGame);

  const formattedVocab = React.useMemo(
    () =>
      sentences.map((s, idx) => ({
        id: `sent-${idx}`,
        term: s.term,
        translation: s.translation || "",
        thaiTranslation: s.thaiTranslation,
        audioUrl: s.audioUrl,
      })),
    [sentences],
  );
  const formattedVocabRef = useRef(formattedVocab);
  formattedVocabRef.current = formattedVocab;

  useEffect(() => {
    scenePrepared.current = false;
    scriptStarted.current = false;
    tutorialScene.current = null;
    setScriptStep(0);
    setScriptWordIndex(0);
    setScriptMove(null);
    setScriptDone(false);
    setTutorialRound(0);
  }, [mode]);

  // Replace the random live scene with a deterministic customer + sentence so
  // the walkthrough can demonstrate every drag without asking the teacher to help.
  useEffect(() => {
    if (mode !== "tutorial" || scenePrepared.current || gameState !== "PLAYING") return;
    scenePrepared.current = true;
    prepareTutorialScene(walkthroughOrders(formattedVocab), "normal", getTutorialSceneWidth(stageNode.current));
  }, [formattedVocab, gameState, mode, prepareTutorialScene]);

  // Capture the initial scene once. The script must keep using this snapshot
  // while the store removes each ingredient after a successful drop.
  useEffect(() => {
    if (mode !== "tutorial" || gameState !== "PAUSED" || !scenePrepared.current || tutorialScene.current) return;

    const customer = customers[0];
    const ingredients = conveyorItems.filter((item) => !item.isHeld);
    if (!customer || ingredients.length === 0) return;
    tutorialScene.current = { customer, ingredients };
  }, [customers, conveyorItems, gameState, mode]);

  // Run the complete walkthrough automatically once the prepared scene is paused.
  useEffect(() => {
    if (mode !== "tutorial" || gameState !== "PAUSED" || !tutorialScene.current || scriptStarted.current) return;

    const { ingredients } = tutorialScene.current;
    const sceneWidth = getTutorialSceneWidth(stageNode.current);
    scriptStarted.current = true;
    let cancelled = false;

    const run = async () => {
      setScriptStep(0);
      await wait(TUTORIAL_TIMING.readOrder);
      if (cancelled) return;

      setScriptStep(1);
      for (let index = 0; index < ingredients.length; index += 1) {
        const ingredient = ingredients[index];
        setScriptWordIndex(index);
        setScriptMove({
          word: ingredient.word,
          // Starts from the word on the belt, so the class sees which word moves.
          from: { left: `${(ingredient.x / sceneWidth) * 100}%`, top: "86%" },
          to: { left: "16.7%", top: "49%" },
        });
        await wait(TUTORIAL_TIMING.dragIngredient);
        if (cancelled) return;
        setScriptMove(null);
        // No drop position: effects would stay frozen, because the scene is paused.
        handleDropIngredient(0, ingredient.id);
        await wait(TUTORIAL_TIMING.inspectDroppedWord);
      }

      // The last word serves the pot, so there is nothing more to drag.
      setScriptStep(2);
      await wait(TUTORIAL_TIMING.inspectCompletedPotion);
      if (cancelled) return;

      setScriptDone(true);
      pauseGame();
      await wait(TUTORIAL_TIMING.completionSummary);
      if (cancelled) return;

      // Loop the walkthrough so the teacher can keep explaining without
      // restarting the phase manually.
      scenePrepared.current = false;
      scriptStarted.current = false;
      tutorialScene.current = null;
      setScriptDone(false);
      setScriptStep(0);
      setScriptWordIndex(0);
      setScriptMove(null);
      prepareTutorialScene(walkthroughOrders(formattedVocabRef.current), "normal", getTutorialSceneWidth(stageNode.current));
      setTutorialRound((round) => round + 1);
    };

    void run();
    return () => {
      cancelled = true;
      // Parent lesson renders create a fresh vocabulary array frequently. If
      // this effect ever has to stop, release the guard so a later PAUSED
      // scene can resume instead of remaining stuck midway through step 2.
      scriptStarted.current = false;
    };
  }, [gameState, handleDropIngredient, mode, pauseGame, prepareTutorialScene, tutorialRound]);

  // Keep the brief completion card paused before the scripted loop prepares
  // the next deterministic scene.
  useEffect(() => {
    if (mode === "tutorial" && scriptDone && gameState === "PLAYING") pauseGame();
  }, [gameState, mode, pauseGame, scriptDone]);

  const currentStep = TUTORIAL_STEPS[scriptStep];
  const StepIcon = currentStep.icon;
  // Keep the result screen visible after the teacher's demo instead of
  // remounting PotionRushGame and starting its timer again.
  const handleComplete = React.useCallback(() => {
    if (mode === "teacher") onTeacherDemoComplete?.();
  }, [mode, onTeacherDemoComplete]);
  // From the captured scene: the belt empties during the walkthrough.
  const totalWords = tutorialScene.current?.ingredients.length ?? conveyorItems.length;
  const stepDetail = scriptStep === 1 && !scriptDone
    ? `กำลังสาธิตคำที่ ${Math.min(scriptWordIndex + 1, Math.max(totalWords, 1))} / ${Math.max(totalWords, 1)} ตามลำดับ`
    : currentStep.detail;

  return (
    <div
      ref={setStage}
      // PotionRushGame fills this frame (not the viewport), so the frame needs a
      // definite height: capped to the screen inline, the stage in fullscreen.
      className={`relative isolate w-full overflow-hidden bg-slate-950 text-white ${
        fullscreen
          ? "h-full min-h-[360px] flex-1 rounded-none shadow-none"
          : `${TEACHING_STAGE_HEIGHT} rounded-[32px] shadow-2xl`
      }`}
      data-testid={`potion-rush-${mode}`}
    >
      <PotionRushGame
        // One game per mode: a demo that timed out would otherwise leave its result
        // screen in the tutorial, with the walkthrough waiting for it to play.
        key={mode}
        vocabList={formattedVocab as any}
        difficulty={mode === "teacher" ? "easy" : "normal"}
        // PhaseManager owns the completion latch. If this game subtree is
        // mounted again while the teacher is still on the same demo, do not
        // silently launch a second timed round.
        autoStart={mode === "tutorial" || !teacherDemoCompleted}
        tutorialMode={mode === "tutorial"}
        manageFullscreen={false}
        onComplete={handleComplete}
        presenterScale={scale}
      />

      {mode === "tutorial" && (
        <div className="absolute inset-y-0 left-0 right-0 z-50 flex items-start justify-center overflow-hidden bg-slate-950/35 px-3 pb-4 pt-3 sm:px-6 sm:pt-6 lg:left-[clamp(220px,18vw,300px)]">
          <motion.div
            key={`spotlight-${scriptStep}`}
            className="pointer-events-none absolute rounded-[28px] border-2 border-violet-300/90"
            style={{
              ...currentStep.target,
              x: "-50%",
              y: "-50%",
              boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.72), 0 0 0 5px rgba(196, 181, 253, 0.18), 0 0 34px rgba(167, 139, 250, 0.82)",
            }}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: [1, 1.025, 1] }}
            transition={{ opacity: { duration: 0.2 }, scale: { duration: 1.8, repeat: Infinity } }}
          />

          {scriptMove && (
            <motion.div
              key={`${scriptMove.word}-${scriptWordIndex}`}
              className="pointer-events-none absolute z-[53] flex items-center gap-2 rounded-2xl border border-amber-200/80 bg-slate-950/95 px-3 py-2 font-black text-amber-100 shadow-2xl"
              style={{
                fontSize: 16 * scale,
                left: scriptMove.from.left,
                top: scriptMove.from.top,
                x: "-50%",
                y: "-50%",
              }}
              animate={{ left: scriptMove.to.left, top: scriptMove.to.top }}
              transition={{ duration: TUTORIAL_TIMING.dragIngredient / 1000, ease: "easeInOut" }}
            >
              <MousePointer2 size={18} />
              <span>{scriptMove.word}</span>
            </motion.div>
          )}

          {/* Between the pots and the belt: the order, the pot and the words all stay in view. */}
          <div className="pointer-events-none absolute inset-x-3 top-[55%] z-[52] flex justify-center sm:inset-x-6">
          <motion.div
            key={`tutorial-card-${scriptStep}-${scriptDone}`}
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25 }}
            style={{ zoom: scale }}
            className="w-full max-w-2xl rounded-[26px] border border-violet-300/45 bg-slate-950/95 p-3 text-white shadow-2xl backdrop-blur-xl sm:p-4"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-violet-200">
                {scriptDone ? <CheckCircle2 size={16} /> : <PauseCircle size={16} />}
                <span>{scriptDone ? "สาธิตเสร็จแล้ว" : "สาธิตอัตโนมัติ · หยุดเวลา"}</span>
              </div>
              <span className="rounded-full border border-violet-400/30 bg-violet-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-violet-200">
                {tx("Step")} {scriptStep + 1} / {TUTORIAL_STEPS.length}
              </span>
            </div>

            <div className="mt-2 flex items-start gap-3 sm:gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-lg shadow-violet-500/30 sm:size-14">
                <StepIcon size={26} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-black leading-tight sm:text-2xl">{scriptDone ? "พร้อมให้เริ่มเกมจริง" : currentStep.title}</h3>
                <p className="mt-1.5 text-sm font-semibold leading-relaxed text-white/70">
                  {scriptDone ? "ระบบสาธิตการลากคำให้ดูครบแล้ว กดเริ่มเกมจากแถบควบคุมด้านล่างได้เลย" : stepDetail}
                </p>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-1.5 border-t border-white/10 pt-2">
              {TUTORIAL_STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`h-2.5 rounded-full transition-all ${
                    index === scriptStep ? "w-8 bg-violet-300 shadow-md shadow-violet-300/50" : index < scriptStep ? "w-2.5 bg-emerald-300" : "w-2.5 bg-white/20"
                  }`}
                />
              ))}
            </div>
          </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}
