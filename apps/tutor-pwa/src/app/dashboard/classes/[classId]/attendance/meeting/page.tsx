import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Notice, Page, PageHeader } from "@/components/app";
import { t } from "@/lib/i18n";
import { loadAttendanceMeetingData } from "../attendance-server";
import { attendanceHistoryHref, parseMeetingParams } from "../attendanceModel";
import { MeetingForm } from "./MeetingForm";

type SearchParams = Promise<{ date?: string | string[]; start?: string | string[]; end?: string | string[] }>;

export default async function AttendanceMeetingPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: SearchParams;
}) {
  const { classId } = await params;
  const query = parseMeetingParams(await searchParams);
  if (!query) return notFound();

  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";

  const result = await loadAttendanceMeetingData(classId, query.date, query.start, token);
  if (result.kind === "notFound") return notFound();
  if (result.kind === "failed") throw new Error("Could not load the attendance meeting");

  const header = {
    title: t("tutorClass.attendance.title"),
    backHref: attendanceHistoryHref(classId),
    backLabel: t("tutorClass.attendance.historyTitle"),
  };

  if (result.kind === "unavailable") {
    return (
      <Page width="narrow">
        <PageHeader {...header} />
        <Notice tone="info">{t("tutorClass.attendance.errorNotAvailable")}</Notice>
      </Page>
    );
  }

  return (
    <Page width="narrow">
      <MeetingForm classId={classId} initial={result.data} initialEnd={query.end} header={header} />
    </Page>
  );
}
