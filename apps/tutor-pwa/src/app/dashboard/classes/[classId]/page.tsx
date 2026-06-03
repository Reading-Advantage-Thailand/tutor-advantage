import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import {
  Video,
  Users,
  ChevronRight,
  ExternalLink,
  ArrowLeft,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { LEARNING_URL } from "@/lib/service-urls";
import { ReferralLink, ArticleSelector, ClassStatusToggle, MeetingUrlEditor, RescheduleClassButton, StudentAvatars, DevClassSimulator } from "./client-components";
import { notFound } from "next/navigation";

async function getClassData(classId: string, token: string) {
  const res = await fetch(`${LEARNING_URL}/v1/classes/${classId}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  return res.json();
}

// In Next.js 15, `params` is a Promise
export default async function ClassDetailPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";

  const response = await getClassData(classId, token);
  if (!response || !response.class) {
    return notFound();
  }

  const cls = response.class;

  return (
    <div className="w-full max-w-5xl space-y-5 pb-24 lg:pb-0">
      {/* Breadcrumb + header */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <Link
            href="/dashboard/classes"
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" /> {t("tutorClass.classes.title")}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{cls.name}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {cls.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {cls.book} / {cls.schedule}
            </p>
          </div>
          <ClassStatusToggle classId={classId} initialStatus={cls.status} />
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:gap-8">
        
        {/* Top Section: Meta Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 items-stretch">
          {/* Meeting URL Editor */}
          <MeetingUrlEditor classId={classId} initialUrl={cls.meetingUrl} />

          <ReferralLink referralLink={cls.referralLink} />

          {/* Schedule & Dates */}
          <Card className="border-border/60 h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                {t("tutorClass.classes.scheduleLabel")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm flex-1 flex flex-col pb-4">
              <p className="text-foreground font-medium">{cls.schedule || t("tutorClass.classes.notSet")}</p>
              <div className="flex gap-6 text-muted-foreground text-xs mt-1">
                <span>
                  <span className="font-medium text-foreground">{t("tutorClass.classes.startsAt")}: </span>
                  {cls.startsAt
                    ? new Date(cls.startsAt).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })
                    : t("tutorClass.classes.notSet")}
                </span>
                <span>
                  <span className="font-medium text-foreground">{t("tutorClass.classes.endsAt")}: </span>
                  {cls.endsAt
                    ? new Date(cls.endsAt).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })
                    : t("tutorClass.classes.notSet")}
                </span>
              </div>
              <div className="pt-4 mt-auto">
                <RescheduleClassButton
                  classId={classId}
                  className={cls.name}
                  currentSchedule={cls.schedule}
                  scheduleData={(cls as any).scheduleData}
                  initialStartsAt={cls.startsAt}
                  initialEndsAt={cls.endsAt}
                />
              </div>
            </CardContent>
          </Card>

          {/* Students */}
          <Card className="border-border/60 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                {t("tutorClass.classes.studentsTitle")} ({cls.students}/{cls.maxStudents} {t("tutorClass.classes.peopleUnit")})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <StudentAvatars enrolledStudents={cls.enrolledStudents} />
            </CardContent>
          </Card>
        </div>

        {/* Bottom Section: Article Selector (Full Width) */}
        <div className="space-y-4 lg:space-y-6">
          <ArticleSelector classId={classId} bookCycles={cls.bookCycles || []} />
          {process.env.NODE_ENV === "development" && (
            <DevClassSimulator classId={classId} />
          )}
        </div>
      </div>
    </div>
  );
}
