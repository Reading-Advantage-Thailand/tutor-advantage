import { Card, CardContent } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import {
  Users,
  ChevronRight,
  ArrowLeft,
  Calendar,
  AlertTriangle,
  Mic2,
} from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { LEARNING_URL } from "@/lib/service-urls";
import {
  ReferralLink,
  ArticleSelector,
  ClassStatusToggle,
  MeetingUrlEditor,
  RescheduleClassButton,
  CouponExtendButton,
  StudentAvatars,
  StudentListButton,
  DevClassSimulator,
} from "./client-components";
import { notFound } from "next/navigation";

async function getClassData(classId: string, token: string) {
  const res = await fetch(`${LEARNING_URL}/v1/classes/${classId}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  return res.json();
}

async function getVoiceSummary(classId: string, token: string) {
  const res = await fetch(`${LEARNING_URL}/v1/classes/${classId}/voice-practice-summary`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json() as { sessions?: any[] };
  return data.sessions || [];
}

// In Next.js 15, `params` is a Promise
export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";

  const [response, voiceSessions] = await Promise.all([
    getClassData(classId, token),
    getVoiceSummary(classId, token),
  ]);
  if (!response || !response.class) {
    return notFound();
  }

  const cls = response.class;
  const detailCardClassName =
    "h-full min-h-[184px] rounded-2xl border-border/60 bg-card/95 shadow-sm";
  const detailCardContentClassName = "flex h-full flex-col p-4 sm:p-5";

  return (
    <div className="w-full space-y-4 pb-24 lg:space-y-6 lg:pb-0 xl:relative xl:left-1/2 xl:w-[calc(100vw-20rem)] xl:max-w-[84rem] xl:-translate-x-1/2">
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link
            href="/dashboard/classes"
            className="flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> {t("tutorClass.classes.title")}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{cls.name}</span>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">{cls.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {cls.book} / {cls.schedule}
            </p>
          </div>
          <ClassStatusToggle classId={classId} initialStatus={cls.status} />
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:gap-6">
        <div className="grid auto-rows-fr grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 xl:gap-4">
          <MeetingUrlEditor
            classId={classId}
            initialUrl={cls.meetingUrl}
            className={detailCardClassName}
          />

          <ReferralLink
            referralLink={cls.referralLink}
            className={detailCardClassName}
          />

          <Card className={detailCardClassName}>
            <CardContent className={detailCardContentClassName}>
              <div className="flex h-full flex-col">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                    <Calendar className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">
                      {t("tutorClass.classes.scheduleLabel")}
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-snug text-foreground">
                      {cls.schedule || t("tutorClass.classes.notSet")}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex-1">
                  {(() => {
                    const freeHours = (cls as any).freeHours ?? 0;
                    if (freeHours <= 0) return null;

                    const scheduleData = (cls as any).scheduleData as
                      | Array<{ start?: string; end?: string }>
                      | undefined;

                    const scheduledHours = Array.isArray(scheduleData)
                      ? scheduleData.reduce((sum, s) => {
                          const [sh, sm] = (s.start || "")
                            .split(":")
                            .map(Number);
                          const [eh, em] = (s.end || "")
                            .split(":")
                            .map(Number);
                          const mins = eh * 60 + em - (sh * 60 + sm);
                          return sum + (Number.isFinite(mins) && mins > 0 ? mins / 60 : 0);
                        }, 0)
                      : 0;

                    const remaining =
                      Math.round((freeHours - scheduledHours) * 100) / 100;

                    if (remaining > 0) {
                      return (
                        <div className="space-y-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2">
                          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            {t("tutorClass.detail.couponUnscheduledWarning")}
                          </p>
                          <p className="text-xs text-amber-700">
                            {t("tutorClass.detail.remainingHoursLabel")}:{" "}
                            <span className="font-bold">
                              {remaining} {t("tutorClass.detail.freeHoursUnit")}
                            </span>
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="flex items-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs font-semibold text-emerald-700">
                        <span className="font-medium text-foreground">
                          {t("tutorClass.detail.freeHoursLabel")}:
                        </span>
                        {freeHours} {t("tutorClass.detail.freeHoursUnit")}
                      </div>
                    );
                  })()}
                </div>

                <div className="mt-4 grid gap-2 border-t border-border/50 pt-4">
                  <RescheduleClassButton
                    classId={classId}
                    className={cls.name}
                    currentSchedule={cls.schedule}
                    scheduleData={(cls as any).scheduleData}
                    initialStartsAt={cls.startsAt}
                    initialEndsAt={cls.endsAt}
                    freeHours={(cls as any).freeHours ?? 0}
                  />
                  <CouponExtendButton classId={classId} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={detailCardClassName}>
            <CardContent className={detailCardContentClassName}>
              <div className="flex h-full flex-col">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                    <Users className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">
                      {t("tutorClass.classes.studentsTitle")} ({cls.students}/
                      {cls.maxStudents} {t("tutorClass.classes.peopleUnit")})
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex-1 content-start">
                  <StudentAvatars enrolledStudents={cls.enrolledStudents} maxVisible={6} />
                </div>

                <div className="mt-4 border-t border-border/50 pt-4">
                  <StudentListButton enrolledStudents={cls.enrolledStudents} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:space-y-5">
          <ArticleSelector classId={classId} bookCycles={cls.bookCycles || []} />
          <Card className="rounded-3xl border-border/60 bg-card shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><Mic2 className="size-5" /></span>
                <div>
                  <h2 className="font-black text-foreground">สรุปการฝึกสนทนากับ AI</h2>
                  <p className="text-xs text-muted-foreground">แสดงเฉพาะผลประเมิน ไม่มีไฟล์เสียงหรือบทสนทนาดิบ</p>
                </div>
              </div>
              {voiceSessions.length === 0 ? (
                <p className="rounded-2xl bg-muted/40 p-5 text-center text-sm text-muted-foreground">ยังไม่มีผลการฝึกสนทนา</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {voiceSessions.slice(0, 20).map((session: any) => {
                    const summary = session.summary || {};
                    const scores = session.scores || {};
                    const values = [scores.fluency, scores.grammar, scores.vocabulary, scores.pronunciation].filter((value: unknown) => typeof value === "number") as number[];
                    const average = values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : "–";
                    return (
                      <article key={session.voiceSessionId} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-foreground">{session.student?.displayName || "นักเรียน"}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{session.articleId} · {Math.ceil(session.consumedSeconds / 60)} นาที</p>
                          </div>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">{average}/5</span>
                        </div>
                        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{summary.summaryTh || "ระบบยังสร้างสรุปไม่สำเร็จ"}</p>
                        {Array.isArray(summary.improvements) && summary.improvements.length > 0 && (
                          <p className="mt-2 text-xs text-amber-700"><strong>ควรฝึกต่อ:</strong> {summary.improvements.join(" · ")}</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          {process.env.NODE_ENV === "development" && (
            <DevClassSimulator classId={classId} />
          )}
        </div>
      </div>
    </div>
  );
}
