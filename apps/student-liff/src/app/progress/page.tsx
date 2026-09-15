"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight, Clock3, Flame, LockKeyhole, Mic2, Play, Sparkles, Target } from "lucide-react";
import { useLiff } from "@/components/providers/LiffProvider";
import { Button } from "@/components/ui/button";
import { studentApi } from "@/lib/api";
import { waitForSession } from "@/lib/cookieUtils";
import { t } from "@/lib/i18n";
import styles from "./progress.module.css";

interface ProgressStats { level: string; cefr: string; seriesColor: string; totalArticles: number; articlesRead: number; weekStreak: number; totalMinutes: number; nextMilestone: { at: number; reward: string }; isBookComplete?: boolean }
interface WeeklyActivity { day: string; minutes: number; active: boolean }
interface ProgressArticle { id: string; no: number; title: string; minutes: number; done: boolean; assessmentSupported: boolean; assessmentDone: boolean }
interface EnrolledClassOption { classId: string; name: string; cefr: string; bookTitle: string | null; seriesColor: string }
interface BookCycleOption { id: string; title: string; cefr: string; sequence: number; status: string; hasAccess: boolean; completedArticles: number; totalArticles: number; percent: number; isComplete: boolean }
interface ProgressData { enrolledClasses?: EnrolledClassOption[]; selectedClassId?: string | null; selectedBookCycleId?: string | null; bookCycles?: BookCycleOption[]; nextAvailableBookCycleId?: string | null; stats: ProgressStats; weeklyActivity: WeeklyActivity[]; articles: ProgressArticle[] }

function LoadingScreen() {
  return <div className={styles.loadingScreen} aria-label="กำลังโหลด"><div className={styles.loadingMark}><BookOpen size={24} /></div><div className={styles.loadingBar}><span /></div></div>;
}

export default function ProgressPage() {
  const { isReady } = useLiff();
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedBookCycleId, setSelectedBookCycleId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      if (!isReady) return;
      try {
        setError(null);
        if (!data) setLoading(true); else setSwitching(true);
        if (!(await waitForSession())) throw new Error("Session unavailable");
        const result = await studentApi.getStudentProgress(selectedClassId || undefined, selectedBookCycleId || undefined) as ProgressData;
        if (!mounted) return;
        setData(result);
        setSelectedClassId(result.selectedClassId ?? null);
        setSelectedBookCycleId(result.selectedBookCycleId ?? null);
      } catch (err) {
        console.error(err);
        if (mounted) setError(t("progress.loadFailed"));
      } finally {
        if (mounted) { setLoading(false); setSwitching(false); }
      }
    }
    fetchData();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, selectedClassId, selectedBookCycleId]);

  if (!isReady || loading) return <LoadingScreen />;
  if (error || !data) return <main className={styles.errorState}><AlertCircle size={40} /><h1>โหลดความก้าวหน้าไม่สำเร็จ</h1><p>{error || t("progress.noData")}</p><Button onClick={() => window.location.reload()}>{t("progress.retry")}</Button></main>;

  const { stats, articles, weeklyActivity, bookCycles = [] } = data;
  const hasData = stats.totalArticles > 0 || articles.length > 0;
  const progressPct = stats.totalArticles ? Math.round((stats.articlesRead / stats.totalArticles) * 100) : 0;
  const currentIndex = articles.findIndex((article) => !article.done);
  const currentArticle = currentIndex >= 0 ? articles[currentIndex] : articles.at(-1);
  const maxMinutes = Math.max(...weeklyActivity.map((day) => day.minutes), 1);
  const themeStyle = { "--series-color": stats.seriesColor || "#06c755" } as CSSProperties;

  const chooseClass = (classId: string) => {
    if (switching || classId === selectedClassId) return;
    setSelectedBookCycleId(null);
    setSelectedClassId(classId);
  };

  return (
    <main className={styles.page} style={themeStyle}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>MY LEARNING</span><h1>{t("progress.title")}</h1></div>
        {hasData && <div className={styles.levelPill}><Sparkles size={14} /> {stats.cefr}</div>}
      </header>

      {(data.enrolledClasses?.length ?? 0) > 1 && <div className={styles.scroller} aria-label="เลือกคลาส">
        {data.enrolledClasses!.map((item) => <button key={item.classId} className={`${styles.filterChip} ${item.classId === selectedClassId ? styles.filterChipActive : ""}`} onClick={() => chooseClass(item.classId)} disabled={switching}><span style={{ background: item.seriesColor }} />{item.name}<small>{item.cefr}</small></button>)}
      </div>}

      {bookCycles.length > 1 && <div className={styles.scroller} aria-label="เลือกหนังสือ">
        {bookCycles.map((book) => <button key={book.id} className={`${styles.bookChip} ${book.id === selectedBookCycleId ? styles.bookChipActive : ""}`} disabled={!book.hasAccess || switching} onClick={() => book.hasAccess && !switching && setSelectedBookCycleId(book.id)}>{book.hasAccess ? <BookOpen size={14} /> : <LockKeyhole size={14} />}<span>{book.title}</span><small>{book.completedArticles}/{book.totalArticles}</small></button>)}
      </div>}

      <div className={`${styles.content} ${switching ? styles.switching : ""}`}>
        {hasData ? <section className={styles.hero}>
          <div className={styles.heroOrbOne} /><div className={styles.heroOrbTwo} />
          <div className={styles.heroTop}><span><BookOpen size={14} /> หนังสือที่กำลังเรียน</span><strong>{progressPct}%</strong></div>
          <h2>{stats.level}</h2>
          <div className={styles.progressMeta}><span>เรียนแล้ว {stats.articlesRead} จาก {stats.totalArticles} บท</span><span>{Math.max(0, stats.totalArticles - stats.articlesRead)} บทที่เหลือ</span></div>
          <div className={styles.progressTrack}><span style={{ width: `${progressPct}%` }} /></div>
          <div className={styles.heroFooter}>
            <div><Target size={17} /><span>{stats.isBookComplete ? "เยี่ยมมาก เรียนจบเล่มนี้แล้ว" : `เป้าหมายถัดไป · ${stats.nextMilestone.reward}`}</span></div>
            {currentArticle && <Link href={`/student/read/${currentArticle.id}`}>{stats.isBookComplete ? "ทบทวน" : "เรียนต่อ"}<ArrowRight size={15} /></Link>}
          </div>
        </section> : <section className={styles.emptyHero}><BookOpen size={30} /><h2>{t("progress.noEnrollment")}</h2><p>{t("progress.noEnrollmentSub")}</p><Link href="/classes">{t("progress.findClass")}</Link></section>}

        <section className={styles.statsGrid} aria-label="สถิติการเรียน">
          <div className={styles.statCard}><span className={styles.fireIcon}><Flame size={19} /></span><div><strong>{stats.weekStreak}</strong><small>สัปดาห์ต่อเนื่อง</small></div></div>
          <div className={styles.statCard}><span className={styles.timeIcon}><Clock3 size={19} /></span><div><strong>{stats.totalMinutes}</strong><small>นาทีที่เรียน</small></div></div>
          <div className={styles.statCard}><span className={styles.bookIcon}><CheckCircle2 size={19} /></span><div><strong>{stats.articlesRead}</strong><small>บทที่สำเร็จ</small></div></div>
        </section>

        <section className={styles.activityCard}>
          <div className={styles.sectionHeading}><div><span>ACTIVITY</span><h2>สัปดาห์นี้</h2></div><small>{weeklyActivity.reduce((sum, day) => sum + day.minutes, 0)} นาที</small></div>
          <div className={styles.weekChart}>{weeklyActivity.map((day) => <div key={day.day} className={styles.dayColumn} title={`${day.day} ${day.minutes} นาที`}><div className={styles.barTrack}><span className={day.active ? styles.activeBar : ""} style={{ height: `${Math.max(8, (day.minutes / maxMinutes) * 100)}%` }} /></div><small>{day.day}</small></div>)}</div>
        </section>

        <section className={styles.lessonsSection}>
          <div className={styles.sectionHeading}><div><span>COURSE CONTENT</span><h2>{t("progress.allLessons")}</h2></div><small>{stats.articlesRead}/{stats.totalArticles}</small></div>
          <div className={styles.lessonList}>
            {articles.length === 0 && <div className={styles.noLessons}><BookOpen size={26} /><p>{t("progress.noLessonsYet")}</p></div>}
            {articles.map((article, index) => {
              const current = index === currentIndex;
              const unlocked = article.done || current;
              return <article key={article.id} className={`${styles.lessonCard} ${current ? styles.currentLesson : ""} ${!unlocked ? styles.lockedLesson : ""}`}>
                {unlocked ? <Link className={styles.lessonMain} href={`/student/read/${article.id}`}>
                  <div className={`${styles.lessonNumber} ${article.done ? styles.lessonDone : current ? styles.lessonCurrent : ""}`}>{article.done ? <Check size={17} /> : !unlocked ? <LockKeyhole size={15} /> : article.no}</div>
                  <div className={styles.lessonCopy}>
                    <div className={styles.lessonMeta}><span>บทที่ {article.no}</span>{article.done && <small><Clock3 size={11} /> {article.minutes} นาที</small>}</div>
                    <h3>{article.title}</h3>
                    {unlocked && article.assessmentSupported && <div className={`${styles.assessment} ${article.assessmentDone ? styles.assessmentDone : styles.assessmentPending}`}>{article.assessmentDone ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}{article.assessmentDone ? "ทำแบบประเมินแล้ว" : "ยังไม่ได้ทำแบบประเมิน"}</div>}
                  </div>
                  {unlocked && <ChevronRight size={19} className={styles.chevron} />}
                </Link> : <div className={styles.lessonMain} aria-disabled="true">
                  <div className={styles.lessonNumber}><LockKeyhole size={15} /></div>
                  <div className={styles.lessonCopy}><div className={styles.lessonMeta}><span>บทที่ {article.no}</span></div><h3>{article.title}</h3></div>
                </div>}
                {current && <Link className={styles.continueButton} href={`/student/read/${article.id}`}><Play size={15} fill="currentColor" /> เรียนบทนี้ต่อ</Link>}
                {article.done && data.selectedBookCycleId && <Link className={styles.voiceButton} href={`/voice-practice?cycleId=${encodeURIComponent(data.selectedBookCycleId)}&articleId=${encodeURIComponent(article.id)}`}><span><Mic2 size={18} /></span><div><strong>ฝึกสนทนากับ AI</strong><small>ฝึกพูดจากเนื้อหาในบทนี้</small></div><ArrowRight size={17} /></Link>}
              </article>;
            })}
          </div>
        </section>

        {stats.isBookComplete && data.nextAvailableBookCycleId && <button className={styles.nextBook} onClick={() => setSelectedBookCycleId(data.nextAvailableBookCycleId ?? null)}>ไปเรียนเล่มถัดไป <ArrowRight size={17} /></button>}
      </div>
    </main>
  );
}
