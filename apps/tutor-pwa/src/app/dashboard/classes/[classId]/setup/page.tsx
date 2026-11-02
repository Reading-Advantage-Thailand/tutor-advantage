import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Notice, Page, PageHeader } from "@/components/app";
import { t } from "@/lib/i18n";
import { LEARNING_URL } from "@/lib/service-urls";
import { bookDisplayLabel } from "../../components/book-options";
import { ClassSetupForm } from "./ClassSetupForm";

/** Fields of GET /v1/classes/:classId (owner view) used by the setup page. */
type SetupClassData = {
  name?: string;
  book?: string;
  bookCode?: string | null;
  meetingUrl?: string;
  freeHours?: number;
  setupRequired?: boolean;
  enrolledStudents?: { paid?: boolean }[];
};

async function getClassData(classId: string, token: string): Promise<SetupClassData | null> {
  const res = await fetch(`${LEARNING_URL}/v1/classes/${classId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { class?: SetupClassData };
  return data.class ?? null;
}

// In Next.js 15, `params` is a Promise
export default async function ClassSetupPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";

  const cls = await getClassData(classId, token);
  if (!cls) {
    return notFound();
  }
  // Already set up (or not an admin-created class): the class page has the edit tools.
  if (!cls.setupRequired) {
    redirect(`/dashboard/classes/${classId}`);
  }

  const name = cls.name ?? "";
  const paidStudents = (cls.enrolledStudents ?? []).filter((student) => student.paid).length;

  return (
    <Page width="narrow">
      <PageHeader
        title={t("tutorClass.setup.title")}
        description={t("tutorClass.setup.subtitle")}
        backHref={`/dashboard/classes/${classId}`}
        backLabel={name || t("tutorClass.view.appBarTitle")}
      />
      <Notice tone="info">
        {`${t("tutorClass.setup.introPrefix")} ${paidStudents} ${t("tutorClass.setup.introSuffix")}`}
      </Notice>
      <ClassSetupForm
        classId={classId}
        initialName={name}
        bookLabel={bookDisplayLabel({ bookCode: cls.bookCode, title: cls.book })}
        initialMeetingUrl={cls.meetingUrl || ""}
        freeHours={cls.freeHours ?? 0}
      />
    </Page>
  );
}
