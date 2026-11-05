import { redirect } from "next/navigation";
import { Page, PageHeader } from "@/components/app";
import { t } from "@/lib/i18n";
import { draftFromSearchParams } from "../lib/support";
import { fetchTutorClassOptions, getTutorToken } from "../lib/support-server";
import { NewTicketForm } from "./NewTicketForm";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function NewTicketPage({ searchParams }: { searchParams: SearchParams }) {
  const token = await getTutorToken();
  if (!token) redirect("/");

  const params = await searchParams;
  const classOptions = await fetchTutorClassOptions(token);
  const prefill = draftFromSearchParams({ category: first(params.category), classId: first(params.classId) });
  // Only prefill a class the tutor actually has.
  const classId = classOptions.some((option) => option.value === prefill.classId) ? prefill.classId : "";

  return (
    <Page width="narrow">
      <PageHeader
        title={t("dashboardSupport.newTitle")}
        description={t("dashboardSupport.newSubtitle")}
        backHref="/dashboard/support"
        backLabel={t("dashboardSupport.backToList")}
      />
      <NewTicketForm classOptions={classOptions} initialCategory={prefill.category} initialClassId={classId} />
    </Page>
  );
}
