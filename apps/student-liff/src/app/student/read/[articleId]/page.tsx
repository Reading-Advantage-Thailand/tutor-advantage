"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useLiff } from "@/components/providers/LiffProvider";
import { studentApi } from "@/lib/api";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  MessageSquare,
  RefreshCw,
  Star,
  Volume2,
  XCircle,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface ArticleWord {
  vocabulary?: string;
  word?: string;
  text?: string;
  definition?: { th?: string };
  translation?: string;
}

interface MCQ {
  id: string;
  question: string;
  option1?: string;
  option2?: string;
  option3?: string;
  option4?: string;
  options?: Record<string, string>;
  answer: string;
}

interface SAQ {
  id: string;
  question: string;
  answer: string;
}

interface ArticleData {
  id?: string;
  title?: string;
  passage?: string;
  summary?: string;
  cefr_level?: string;
  ra_level?: string;
  words?: ArticleWord[];
  sentences?: (string | { sentences: string })[];
  multipleChoiceQuestions?: MCQ[];
  shortAnswerQuestions?: SAQ[];
}

interface SessionAnswer {
  phase: number;
  questionText?: string;
  answerText?: string;
  correctAnswer?: string;
  isCorrect?: boolean;
  score: number;
  aiFeedback?: string;
}

interface SessionData {
  sessionId: string;
  score: number;
  finishedAt: string;
  answers: SessionAnswer[];
}

interface PageData {
  article: ArticleData;
  mode: "pre-class" | "review";
  session: SessionData | null;
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function getWordText(w: ArticleWord): string {
  return w.vocabulary ?? w.word ?? w.text ?? "";
}

function getWordThai(w: ArticleWord): string {
  return w.definition?.th ?? w.translation ?? "";
}

function getMcqOptions(q: MCQ): string[] {
  if (q.options) return Object.values(q.options);
  return [q.option1, q.option2, q.option3, q.option4].filter(Boolean) as string[];
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/* ─── Sub-components ─────────────────────────────────────────────────────────── */

function ModeBanner({ mode, session }: { mode: "pre-class" | "review"; session: SessionData | null }) {
  if (mode === "pre-class") {
    return (
      <div
        style={{
          borderRadius: "var(--radius-xl)",
          background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
          border: "1px solid #fcd34d",
          padding: "14px 16px",
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <span style={{ fontSize: "1.5rem", flexShrink: 0 }}>📚</span>
        <div>
          <div style={{ fontSize: "0.875rem", fontWeight: 800, color: "#92400e", marginBottom: 2 }}>
            เตรียมตัวก่อนเรียน
          </div>
          <div style={{ fontSize: "0.75rem", color: "#a16207", lineHeight: 1.5 }}>
            อ่านบทความและทำความเข้าใจคำศัพท์ก่อนเข้าคลาส เมื่อครูพาเรียนเสร็จแล้ว หน้านี้จะแสดงผลคะแนนและสรุปบทเรียนของคุณ
          </div>
        </div>
      </div>
    );
  }

  const correctCount = session?.answers.filter(a => a.isCorrect).length ?? 0;
  const totalCount = session?.answers.length ?? 0;

  return (
    <div
      style={{
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(135deg, #dcfce8 0%, #bbf7d2 100%)",
        border: "1px solid #86efb0",
        padding: "14px 16px",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <span style={{ fontSize: "1.5rem", flexShrink: 0 }}>✅</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.875rem", fontWeight: 800, color: "#065f28", marginBottom: 2 }}>
          ทบทวนบทเรียน
        </div>
        <div style={{ fontSize: "0.75rem", color: "#047d36", lineHeight: 1.5 }}>
          คุณได้เรียนบทนี้กับครูแล้ว เมื่อ {session ? formatDate(session.finishedAt) : ""}
        </div>
        {session && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(6,199,85,0.15)", borderRadius: "var(--radius-full)", padding: "3px 10px" }}>
              <Star size={12} style={{ color: "#f59e0b", fill: "#f59e0b" }} />
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#047d36" }}>
                {session.score} คะแนน
              </span>
            </div>
            {totalCount > 0 && (
              <span style={{ fontSize: "0.6875rem", color: "#047d36" }}>
                ตอบถูก {correctCount}/{totalCount} ข้อ
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function VocabularySection({ words }: { words: ArticleWord[] }) {
  if (!words.length) return null;
  return (
    <section>
      <h2 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
        <BookOpen size={16} style={{ color: "var(--brand-600)" }} />
        คำศัพท์สำคัญ
      </h2>
      <div className="glass-card" style={{ overflow: "hidden" }}>
        {words.map((w, idx) => {
          const wordText = getWordText(w);
          const thai = getWordThai(w);
          if (!wordText) return null;
          return (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderTop: idx > 0 ? "1px solid var(--surface-border)" : "none",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "var(--radius-md)",
                  background: "var(--brand-50)",
                  border: "1px solid var(--brand-100)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: "1rem",
                }}
              >
                📖
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)", fontFamily: "var(--font-latin)" }}>
                  {wordText}
                </div>
                {thai && (
                  <div style={{ fontSize: "0.8125rem", color: "var(--brand-700)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {thai}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PreClassQuestions({ mcqs, saqs }: { mcqs: MCQ[]; saqs: SAQ[] }) {
  const all = [...mcqs, ...saqs];
  if (!all.length) return null;
  return (
    <section>
      <h2 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
        <MessageSquare size={16} style={{ color: "var(--accent-blue)" }} />
        คำถามทบทวน
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {all.map((q, i) => (
          <div
            key={q.id ?? i}
            className="glass-card"
            style={{ padding: "14px 16px", border: "1px solid var(--accent-blue-light)" }}
          >
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--accent-blue)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              คำถาม {i + 1}
            </div>
            <p style={{ fontSize: "0.9375rem", color: "var(--text-primary)", fontWeight: 500, marginBottom: 10, fontFamily: "var(--font-latin)", lineHeight: 1.6 }}>
              {q.question}
            </p>
            {"option1" in q || "options" in q ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {getMcqOptions(q as MCQ).map((opt, oi) => (
                  <div key={oi} style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", padding: "6px 10px", borderRadius: "var(--radius-sm)", background: "var(--neutral-50)", border: "1px solid var(--surface-border)", fontFamily: "var(--font-latin)" }}>
                    {String.fromCharCode(65 + oi)}. {opt}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

const PHASE_LABEL: Record<number, string> = {
  7: "MCQ", 8: "Short Answer 1", 10: "คำศัพท์",
  11: "Fill in the Blank", 12: "Sentence Order", 13: "Short Answer 2",
};

function ReviewAnswers({ answers }: { answers: SessionAnswer[] }) {
  const interactive = answers.filter(a => a.questionText);
  if (!interactive.length) return null;
  return (
    <section>
      <h2 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
        <Star size={16} style={{ color: "#f59e0b" }} />
        ผลการตอบคำถาม
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {interactive.map((a, i) => (
          <div
            key={i}
            className="glass-card"
            style={{
              padding: "14px 16px",
              border: `1px solid ${a.isCorrect === true ? "var(--brand-200)" : a.isCorrect === false ? "#fecaca" : "var(--surface-border)"}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                Phase {a.phase} · {PHASE_LABEL[a.phase] ?? "Interactive"}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {a.isCorrect === true && <CheckCircle2 size={14} style={{ color: "var(--brand-500)" }} />}
                {a.isCorrect === false && <XCircle size={14} style={{ color: "#ef4444" }} />}
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: a.isCorrect === true ? "var(--brand-600)" : a.isCorrect === false ? "#ef4444" : "var(--text-tertiary)" }}>
                  +{a.score}
                </span>
              </div>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--text-primary)", fontFamily: "var(--font-latin)", marginBottom: 8, lineHeight: 1.5 }}>
              {a.questionText}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", background: a.isCorrect === false ? "#fee2e2" : "var(--brand-50)", fontSize: "0.75rem", fontFamily: "var(--font-latin)", color: a.isCorrect === false ? "#b91c1c" : "var(--brand-700)", fontWeight: 600 }}>
                คำตอบ: {a.answerText || "—"}
              </div>
              {a.isCorrect === false && a.correctAnswer && (
                <div style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", background: "var(--brand-50)", fontSize: "0.75rem", fontFamily: "var(--font-latin)", color: "var(--brand-700)", fontWeight: 600 }}>
                  เฉลย: {a.correctAnswer}
                </div>
              )}
            </div>
            {a.aiFeedback && (
              <div style={{ marginTop: 8, padding: "8px 10px", background: "var(--accent-blue-light)", borderRadius: "var(--radius-sm)", fontSize: "0.75rem", color: "var(--accent-blue)", lineHeight: 1.5 }}>
                💡 {a.aiFeedback}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */

export default function ArticleReaderPage() {
  const { articleId } = useParams<{ articleId: string }>();
  const { isReady } = useLiff();
  const router = useRouter();

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!isReady) return;

    async function load() {
      try {
        setLoading(true);
        let token = (document.cookie.match(/(?:^|; )student-session=([^;]*)/) ?? [])[1] ?? null;
        let retries = 0;
        while (!token && retries < 10) {
          await new Promise(r => setTimeout(r, 400));
          token = (document.cookie.match(/(?:^|; )student-session=([^;]*)/) ?? [])[1] ?? null;
          retries++;
        }
        const result = await studentApi.getStudentArticle(articleId) as PageData;
        if (mounted) setData(result);
      } catch {
        if (mounted) setError("ไม่สามารถโหลดบทความได้");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [isReady, articleId]);

  if (!isReady || loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-bg)" }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: "3px solid var(--neutral-200)", borderTopColor: "var(--brand-500)", borderRadius: "50%" }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
        <AlertCircle size={40} style={{ color: "#ef4444" }} />
        <p style={{ color: "var(--text-secondary)" }}>{error ?? "ไม่พบบทความ"}</p>
        <button
          onClick={() => router.back()}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: "var(--radius-full)", background: "var(--brand-500)", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer", fontSize: "0.875rem" }}
        >
          <RefreshCw size={14} /> ลองอีกครั้ง
        </button>
      </div>
    );
  }

  const { article, mode, session } = data;
  const words = article.words ?? [];
  const mcqs = article.multipleChoiceQuestions ?? [];
  const saqs = article.shortAnswerQuestions ?? [];
  const paragraphs = (article.passage ?? article.summary ?? "").split("\n\n").filter(Boolean);

  return (
    <div style={{ background: "var(--surface-bg)", minHeight: "100dvh" }}>
      {/* Top bar */}
      <div className="top-bar" style={{ background: "var(--surface-card)", backdropFilter: "blur(12px)" }}>
        <button
          onClick={() => router.back()}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "var(--radius-md)", background: "var(--neutral-100)", border: "none", cursor: "pointer", color: "var(--text-primary)", flexShrink: 0 }}
          aria-label="กลับ"
        >
          <ChevronLeft size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }} className="text-ellipsis">
            {article.title ?? articleId}
          </div>
          {(article.cefr_level || article.ra_level) && (
            <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginTop: 1 }}>
              {[article.cefr_level, article.ra_level].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "var(--radius-full)",
              fontSize: "0.6875rem",
              fontWeight: 700,
              background: mode === "review" ? "var(--brand-50)" : "#fef3c7",
              color: mode === "review" ? "var(--brand-700)" : "#92400e",
              border: `1px solid ${mode === "review" ? "var(--brand-200)" : "#fcd34d"}`,
              flexShrink: 0,
            }}
          >
            {mode === "review" ? "✅ ทบทวน" : "📚 เตรียมตัว"}
          </span>
          <button
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: "var(--radius-md)", background: "var(--brand-50)", border: "1px solid var(--brand-100)", cursor: "pointer", color: "var(--brand-600)", flexShrink: 0 }}
            aria-label="ฟังเสียง"
          >
            <Volume2 size={16} />
          </button>
        </div>
      </div>

      <div style={{ padding: "16px 16px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

        <ModeBanner mode={mode} session={session} />

        {/* Article body */}
        <section>
          <h2 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
            <BookOpen size={16} style={{ color: "var(--brand-600)" }} />
            บทความ
          </h2>
          <div className="glass-card" style={{ padding: "18px 16px" }}>
            <h1 style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 14, lineHeight: 1.35, fontFamily: "var(--font-latin)" }}>
              {article.title}
            </h1>
            <div style={{ fontSize: "1rem", lineHeight: 2, color: "var(--text-secondary)", fontFamily: "var(--font-latin)" }}>
              {paragraphs.map((para, i) => (
                <p key={i} style={{ marginBottom: i < paragraphs.length - 1 ? 14 : 0 }}>
                  {para}
                </p>
              ))}
            </div>
          </div>
        </section>

        <VocabularySection words={words} />

        {/* Pre-class: self-check questions */}
        {mode === "pre-class" && (
          <PreClassQuestions mcqs={mcqs} saqs={saqs} />
        )}

        {/* Review: scored answers */}
        {mode === "review" && session && (
          <ReviewAnswers answers={session.answers} />
        )}

        {/* Bottom CTA */}
        {mode === "pre-class" ? (
          <div
            style={{
              borderRadius: "var(--radius-xl)",
              background: "var(--surface-card)",
              border: "1px solid #fcd34d",
              padding: "18px 16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1.75rem", marginBottom: 6 }}>⏳</div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
              รอเข้าคลาสกับครู
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", marginBottom: 16, lineHeight: 1.6 }}>
              เมื่อครูเปิดบทเรียน คุณจะเข้าร่วม Interactive Lesson ได้จากหน้าหลัก
            </div>
            <Link
              href="/dashboard"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "11px 28px",
                borderRadius: "var(--radius-full)",
                background: "var(--brand-500)",
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.875rem",
                textDecoration: "none",
              }}
            >
              กลับหน้าหลัก
            </Link>
          </div>
        ) : (
          <Link
            href="/progress"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 24px",
              borderRadius: "var(--radius-full)",
              background: "linear-gradient(135deg, var(--brand-500), var(--brand-600))",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.9375rem",
              textDecoration: "none",
              boxShadow: "var(--shadow-green)",
            }}
          >
            ดูแผนที่การเรียน →
          </Link>
        )}

      </div>
    </div>
  );
}
