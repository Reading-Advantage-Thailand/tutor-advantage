import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Video,
  Users,
  ChevronRight,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { ReferralLink, ArticleSelector, ClassStatusToggle, MeetingUrlEditor, StudentAvatars } from "./client-components";
import { notFound } from "next/navigation";

async function getClassData(classId: string, token: string) {
  const res = await fetch(`http://localhost:3002/v1/classes/${classId}`, {
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
            <ArrowLeft className="h-3 w-3" /> คลาสเรียน
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
              {cls.book} · {cls.schedule}
            </p>
          </div>
          <ClassStatusToggle classId={classId} initialStatus={cls.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        
        {/* Left Column (Info, Meeting, Link, Students) */}
        <div className="lg:col-span-5 space-y-4 lg:space-y-6">
          {/* Meeting URL Editor */}
          <MeetingUrlEditor classId={classId} initialUrl={cls.meetingUrl} />

          <ReferralLink referralLink={cls.referralLink} />


          {/* Students */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                นักเรียน ({cls.students}/{cls.maxStudents} คน)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <StudentAvatars enrolledStudents={cls.enrolledStudents} />
            </CardContent>
          </Card>
        </div>

        {/* Right Column (Article Selector) */}
        <div className="lg:col-span-7">
          <ArticleSelector classId={classId} />
        </div>
      </div>
    </div>
  );
}
