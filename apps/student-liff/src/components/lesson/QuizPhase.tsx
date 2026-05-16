"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Award,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  Medal,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const OPTION_LABELS = ["A", "B", "C", "D"] as const;
const POINTS_CORRECT = 10;
const POINTS_FAST_BONUS = 3;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
}

export interface StudentScore {
  id: string;
  name: string;
  avatarColor: string;
  score: number;
  correct: number;
  total: number;
  isCurrentUser?: boolean;
}

interface QuizPhaseProps {
  questions: QuizQuestion[];
  students: StudentScore[];
  lessonTitle?: string;
  subject?: string;
  timePerQuestion?: number;
  onComplete?: (result: { score: number; correct: number; total: number }) => void;
}

type AnswerState = "idle" | "selected" | "revealed";

// ── Main Component ────────────────────────────────────────────────────────────
export function QuizPhase({
  questions,
  students: initialStudents,
  lessonTitle = "Lesson Quiz",
  subject = "English",
  timePerQuestion = 30,
  onComplete,
}: QuizPhaseProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>("idle");
  const [timeLeft, setTimeLeft] = useState(timePerQuestion);
  const [students, setStudents] = useState<StudentScore[]>(initialStudents);
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeLeftRef = useRef(timePerQuestion);

  const currentQuestion = questions[currentIndex];
  const sortedStudents = [...students].sort((a, b) => b.score - a.score);
  const currentUser = students.find((s) => s.isCurrentUser);
  const currentUserRank = sortedStudents.findIndex((s) => s.isCurrentUser) + 1;
  const maxPossibleScore = questions.length * (POINTS_CORRECT + POINTS_FAST_BONUS);

  const simulateOtherStudents = useCallback(
    (qIndex: number) => {
      const others = initialStudents.filter((s) => !s.isCurrentUser);
      others.forEach((s, i) => {
        const delay = 800 + i * 700 + Math.random() * 1800;
        setTimeout(() => {
          const correct = Math.random() > 0.3;
          setStudents((prev) =>
            prev.map((p) =>
              p.id === s.id && p.total === qIndex
                ? {
                    ...p,
                    score: correct ? p.score + POINTS_CORRECT : p.score,
                    correct: correct ? p.correct + 1 : p.correct,
                    total: p.total + 1,
                  }
                : p
            )
          );
          setAnimatingId(s.id);
          setTimeout(() => setAnimatingId(null), 700);
        }, delay);
      });
    },
    [initialStudents]
  );

  const reveal = useCallback(
    (autoReveal = false) => {
      if (answerState === "revealed") return;
      clearInterval(timerRef.current!);
      setAnswerState("revealed");

      const isCorrect = !autoReveal && selectedOption === currentQuestion.correctAnswer;
      const fastBonus =
        isCorrect && timeLeftRef.current > timePerQuestion / 2 ? POINTS_FAST_BONUS : 0;
      const earned = isCorrect ? POINTS_CORRECT + fastBonus : 0;

      setEarnedPoints(isCorrect ? earned : null);
      setStudents((prev) =>
        prev.map((s) =>
          s.isCurrentUser
            ? {
                ...s,
                score: s.score + earned,
                correct: isCorrect ? s.correct + 1 : s.correct,
                total: s.total + 1,
              }
            : s
        )
      );
      simulateOtherStudents(currentIndex);
    },
    [answerState, selectedOption, currentQuestion, currentIndex, timePerQuestion, simulateOtherStudents]
  );

  useEffect(() => {
    if (timePerQuestion <= 0 || answerState !== "idle") return;
    timeLeftRef.current = timePerQuestion;
    setTimeLeft(timePerQuestion);

    timerRef.current = setInterval(() => {
      timeLeftRef.current -= 1;
      setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) {
        clearInterval(timerRef.current!);
        reveal(true);
      }
    }, 1000);

    return () => clearInterval(timerRef.current!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, timePerQuestion]);

  useEffect(() => {
    if (answerState === "selected") clearInterval(timerRef.current!);
  }, [answerState]);

  const handleNext = useCallback(() => {
    const next = currentIndex + 1;
    setEarnedPoints(null);
    if (next >= questions.length) {
      setIsComplete(true);
      const user = students.find((s) => s.isCurrentUser);
      onComplete?.({ score: user?.score ?? 0, correct: user?.correct ?? 0, total: questions.length });
    } else {
      setCurrentIndex(next);
      setSelectedOption(null);
      setAnswerState("idle");
    }
  }, [currentIndex, questions.length, students, onComplete]);

  if (isComplete) {
    return (
      <QuizComplete
        students={sortedStudents}
        lessonTitle={lessonTitle}
        totalQuestions={questions.length}
      />
    );
  }

  const progressPct = (currentIndex / questions.length) * 100;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      {/* ── Left Panel: Quiz ──────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <div className="border-b border-slate-200 bg-white px-8 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                {subject}
              </p>
              <h1 className="text-lg font-bold text-slate-900">{lessonTitle}</h1>
            </div>
            <div className="flex items-center gap-4">
              {currentUser && (
                <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2">
                  <Zap className="size-4 text-indigo-500" />
                  <span className="text-sm font-bold text-indigo-700">
                    {currentUser.score} pts
                  </span>
                </div>
              )}
              {timePerQuestion > 0 && (
                <TimerDisplay timeLeft={timeLeft} total={timePerQuestion} />
              )}
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs font-medium text-slate-400">
              {currentIndex + 1} / {questions.length}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-400">
              {Math.round(progressPct)}%
            </span>
          </div>
        </div>

        {/* Question + options */}
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-12 py-8">
          <div className="w-full max-w-2xl space-y-5">
            {/* Question card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                  ข้อที่ {currentIndex + 1}
                </span>
                <span className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-400">
                  ปรนัย
                </span>
              </div>
              <p className="text-2xl font-semibold leading-relaxed text-slate-800">
                {currentQuestion.text}
              </p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {currentQuestion.options.map((option, i) => {
                let state: OptionState = "idle";
                if (answerState === "revealed") {
                  if (i === currentQuestion.correctAnswer) state = "correct";
                  else if (i === selectedOption) state = "wrong";
                } else if (answerState === "selected" && i === selectedOption) {
                  state = "selected";
                }
                return (
                  <OptionButton
                    key={i}
                    index={i}
                    label={option}
                    state={state}
                    disabled={answerState !== "idle"}
                    onClick={() => {
                      setSelectedOption(i);
                      setAnswerState("selected");
                    }}
                  />
                );
              })}
            </div>

            {/* Feedback */}
            {earnedPoints !== null && answerState === "revealed" && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-3 text-emerald-700">
                <CheckCircle2 className="size-5" />
                <span className="font-semibold">
                  +{earnedPoints} คะแนน
                  {earnedPoints > POINTS_CORRECT && (
                    <span className="ml-1 text-xs text-emerald-500">
                      (ตอบไว +{POINTS_FAST_BONUS})
                    </span>
                  )}
                </span>
              </div>
            )}
            {earnedPoints === null && answerState === "revealed" && selectedOption !== null && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-rose-50 py-3 text-rose-600">
                <XCircle className="size-5" />
                <span className="font-semibold">ตอบผิด — ไม่ได้คะแนน</span>
              </div>
            )}
            {answerState === "revealed" && selectedOption === null && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 py-3 text-slate-500">
                <Clock className="size-5" />
                <span className="font-semibold">หมดเวลา</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              {answerState === "selected" && (
                <Button
                  onClick={() => reveal(false)}
                  size="lg"
                  className="gap-2 bg-indigo-600 px-8 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700"
                >
                  ตรวจคำตอบ <ChevronRight className="size-4" />
                </Button>
              )}
              {answerState === "revealed" && (
                <Button
                  onClick={handleNext}
                  size="lg"
                  className="gap-2 bg-slate-900 px-8 text-white hover:bg-slate-800"
                >
                  {currentIndex + 1 >= questions.length ? "ดูผลลัพธ์" : "ข้อถัดไป"}
                  <ChevronRight className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel: Leaderboard ──────────────────────────────── */}
      <div className="flex w-[380px] shrink-0 flex-col border-l border-slate-200 bg-white shadow-xl">
        <LeaderboardPanel
          students={sortedStudents}
          animatingId={animatingId}
          currentUserRank={currentUserRank}
          maxPossibleScore={maxPossibleScore}
          answeredCount={currentIndex + (answerState === "revealed" ? 1 : 0)}
          totalQuestions={questions.length}
        />
      </div>
    </div>
  );
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function TimerDisplay({ timeLeft, total }: { timeLeft: number; total: number }) {
  const pct = (timeLeft / total) * 100;
  const isLow = timeLeft <= 10;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const display = mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : String(secs);

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border-2 px-4 py-2 transition-all duration-300",
        isLow ? "border-rose-300 bg-rose-50 shadow-md shadow-rose-100" : "border-slate-200 bg-slate-50"
      )}
    >
      <svg className="-rotate-90" width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="11" fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle
          cx="14" cy="14" r="11" fill="none"
          stroke={isLow ? "#f43f5e" : "#6366f1"}
          strokeWidth="3"
          strokeDasharray={`${2 * Math.PI * 11}`}
          strokeDashoffset={`${2 * Math.PI * 11 * (1 - pct / 100)}`}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <span className={cn("text-xl font-bold tabular-nums", isLow ? "text-rose-600" : "text-slate-700")}>
        {display}
      </span>
    </div>
  );
}

// ── Option Button ─────────────────────────────────────────────────────────────
type OptionState = "idle" | "selected" | "correct" | "wrong";

const OPTION_BASE =
  "relative flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer select-none";

const OPTION_STYLE: Record<OptionState, string> = {
  idle: "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-sm active:translate-y-px",
  selected: "border-indigo-500 bg-indigo-50 text-indigo-900 shadow-md shadow-indigo-100 scale-[1.01]",
  correct: "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md shadow-emerald-100",
  wrong: "border-rose-400 bg-rose-50 text-rose-900",
};

const LABEL_STYLE: Record<OptionState, string> = {
  idle: "bg-slate-100 text-slate-500",
  selected: "bg-indigo-600 text-white",
  correct: "bg-emerald-500 text-white",
  wrong: "bg-rose-400 text-white",
};

function OptionButton({
  index, label, state, disabled, onClick,
}: {
  index: number;
  label: string;
  state: OptionState;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        OPTION_BASE,
        OPTION_STYLE[state],
        disabled && state === "idle" && "cursor-default opacity-60"
      )}
      onClick={!disabled ? onClick : undefined}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-all duration-200",
          LABEL_STYLE[state]
        )}
      >
        {OPTION_LABELS[index]}
      </span>
      <span className="flex-1 text-base font-medium leading-snug">{label}</span>
      {state === "correct" && <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />}
      {state === "wrong" && <XCircle className="size-5 shrink-0 text-rose-400" />}
    </button>
  );
}

// ── Leaderboard Panel ─────────────────────────────────────────────────────────
const RANK_CONFIG = [
  { icon: Crown, bg: "from-amber-50 to-yellow-50", border: "border-amber-300", iconColor: "text-amber-500", scoreColor: "text-amber-600", barColor: "bg-amber-400" },
  { icon: Medal, bg: "from-slate-50 to-gray-100", border: "border-slate-300", iconColor: "text-slate-400", scoreColor: "text-slate-600", barColor: "bg-slate-400" },
  { icon: Medal, bg: "from-orange-50 to-amber-50", border: "border-orange-200", iconColor: "text-orange-400", scoreColor: "text-orange-600", barColor: "bg-orange-400" },
];

function LeaderboardPanel({
  students, animatingId, currentUserRank, maxPossibleScore, answeredCount, totalQuestions,
}: {
  students: StudentScore[];
  animatingId: string | null;
  currentUserRank: number;
  maxPossibleScore: number;
  answeredCount: number;
  totalQuestions: number;
}) {
  return (
    <>
      <div className="border-b border-slate-100 bg-linear-to-r from-slate-900 to-indigo-950 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-400/20">
              <Trophy className="size-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Leaderboard</h2>
              <p className="text-xs text-slate-400">{students.length} นักเรียน</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">Live</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-indigo-400 transition-all duration-700"
              style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
            />
          </div>
          <span className="text-xs text-slate-400">{answeredCount}/{totalQuestions} ข้อ</span>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {students.map((student, i) => {
          const rank = i + 1;
          const cfg = rank <= 3 ? RANK_CONFIG[rank - 1] : null;
          const isAnimating = animatingId === student.id;
          const pct = maxPossibleScore > 0 ? (student.score / maxPossibleScore) * 100 : 0;

          return (
            <div
              key={student.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border-2 p-3 transition-all duration-500",
                cfg
                  ? `bg-linear-to-r ${cfg.bg} ${cfg.border}`
                  : student.isCurrentUser
                    ? "border-indigo-300 bg-indigo-50"
                    : "border-slate-100 bg-slate-50 hover:bg-slate-100",
                isAnimating && "scale-[1.025] shadow-lg"
              )}
            >
              {/* Rank */}
              <div className="flex w-7 shrink-0 items-center justify-center">
                {rank === 1 && <Crown className="size-5 text-amber-500" />}
                {rank === 2 && <Medal className="size-5 text-slate-400" />}
                {rank === 3 && <Medal className="size-5 text-orange-400" />}
                {rank > 3 && <span className="text-xs font-bold text-slate-400">#{rank}</span>}
              </div>

              {/* Avatar */}
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-sm",
                  student.avatarColor
                )}
              >
                {student.name.slice(0, 2)}
              </div>

              {/* Name + bar */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "truncate text-sm font-semibold",
                      student.isCurrentUser ? "text-indigo-700" : "text-slate-700"
                    )}
                  >
                    {student.name}
                  </span>
                  {student.isCurrentUser && (
                    <span className="shrink-0 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      คุณ
                    </span>
                  )}
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      cfg ? cfg.barColor : student.isCurrentUser ? "bg-indigo-500" : "bg-slate-400"
                    )}
                    style={{ width: `${Math.max(pct, student.score > 0 ? 4 : 0)}%` }}
                  />
                </div>
              </div>

              {/* Score */}
              <div className="shrink-0 text-right">
                <div
                  className={cn(
                    "text-base font-bold tabular-nums transition-all duration-300",
                    cfg ? cfg.scoreColor : student.isCurrentUser ? "text-indigo-600" : "text-slate-700",
                    isAnimating && "scale-110"
                  )}
                >
                  {student.score}
                </div>
                <div className="text-[10px] font-medium text-slate-400">pts</div>
              </div>
            </div>
          );
        })}
      </div>

      {currentUserRank > 5 && (
        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-2.5 rounded-xl bg-indigo-50 px-4 py-3">
            <Award className="size-4 shrink-0 text-indigo-500" />
            <span className="text-sm font-medium text-indigo-700">
              คุณอยู่อันดับ <strong className="font-bold">#{currentUserRank}</strong> — ไม่ยอมแพ้!
            </span>
          </div>
        </div>
      )}
    </>
  );
}

// ── Quiz Complete ─────────────────────────────────────────────────────────────
function QuizComplete({
  students, lessonTitle, totalQuestions,
}: {
  students: StudentScore[];
  lessonTitle: string;
  totalQuestions: number;
}) {
  const currentUser = students.find((s) => s.isCurrentUser);
  const rank = students.findIndex((s) => s.isCurrentUser) + 1;
  const accuracy = currentUser ? Math.round((currentUser.correct / totalQuestions) * 100) : 0;
  const rankEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

  return (
    <div className="flex h-screen items-center justify-center bg-linear-to-br from-indigo-50 via-white to-slate-50 p-8">
      <div className="flex w-full max-w-4xl gap-8">
        {/* Left: your result */}
        <div className="flex flex-1 flex-col gap-5">
          <div className="text-center">
            <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-amber-100">
              <Trophy className="size-10 text-amber-500" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900">Quiz เสร็จแล้ว!</h1>
            <p className="mt-1 text-slate-500">{lessonTitle}</p>
          </div>

          {currentUser && (
            <div className="rounded-2xl border-2 border-indigo-200 bg-white p-6 shadow-lg">
              <p className="mb-1 text-sm font-medium text-slate-400">คะแนนของคุณ</p>
              <div className="flex items-end gap-3">
                <span className="text-6xl font-black text-indigo-600">{currentUser.score}</span>
                <span className="mb-2 text-2xl font-medium text-slate-300">pts</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <StatBox label="ถูก" value={`${currentUser.correct}/${totalQuestions}`} color="text-emerald-600" />
                <StatBox label="ความแม่นยำ" value={`${accuracy}%`} color="text-indigo-600" />
                <StatBox label="อันดับ" value={rankEmoji} color="text-amber-600" />
              </div>
            </div>
          )}
        </div>

        {/* Right: final leaderboard */}
        <div className="flex w-[380px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="bg-linear-to-r from-slate-900 to-indigo-950 px-6 py-4">
            <div className="flex items-center gap-2">
              <Trophy className="size-5 text-amber-400" />
              <h2 className="font-bold text-white">ผลการแข่งขัน</h2>
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-4">
            {students.map((student, i) => {
              const r = i + 1;
              return (
                <div
                  key={student.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border-2 p-3",
                    r === 1 && "border-amber-300 bg-amber-50",
                    r === 2 && "border-slate-300 bg-slate-50",
                    r === 3 && "border-orange-200 bg-orange-50",
                    r > 3 && "border-slate-100 bg-white",
                    student.isCurrentUser && "ring-2 ring-indigo-400 ring-offset-1"
                  )}
                >
                  <span className="w-8 text-center text-sm font-bold text-slate-500">
                    {r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : `#${r}`}
                  </span>
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                      student.avatarColor
                    )}
                  >
                    {student.name.slice(0, 2)}
                  </div>
                  <span className="flex-1 text-sm font-semibold text-slate-700">{student.name}</span>
                  {student.isCurrentUser && (
                    <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      คุณ
                    </span>
                  )}
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-800">{student.score}</div>
                    <div className="text-[10px] text-slate-400">pts</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <div className={cn("text-2xl font-bold", color)}>{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
