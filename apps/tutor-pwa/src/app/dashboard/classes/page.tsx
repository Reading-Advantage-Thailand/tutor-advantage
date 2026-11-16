import Link from "next/link";
import { cookies } from "next/headers";
import { Megaphone, Plus } from "lucide-react";
import { EmptyState, Page, PageHeader } from "@/components/app";
import { buttonVariants } from "@/components/ui/button-variants";
import { LEARNING_URL } from "@/lib/service-urls";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ClassListView } from "./components/ClassListView";
import type { ClassListItem } from "./components/ClassRow";

async function getClassesData(token: string) {
  const res = await fetch(`${LEARNING_URL}/v1/classes`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  return res.json();
}

// Links drawn as the shared button (buttonVariants from the server-safe module).
const primaryLink = buttonVariants();
const secondaryLink = buttonVariants({ variant: "outline" });

export default async function ClassesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";
  const showDevDelete = process.env.NODE_ENV === "development";

  const response = await getClassesData(token);
  // Only the fields the list shows go to the client component (no prices, schedule data or tutor id).
  const classesList: ClassListItem[] = ((response?.classes || []) as ClassListItem[]).map(
    ({ id, name, book, status, students, maxStudents, nextSession, cefrLevel, setupRequired }) => ({
      id,
      name,
      book,
      status,
      students,
      maxStudents,
      nextSession,
      cefrLevel,
      setupRequired,
    }),
  );
  const isEmpty = classesList.length === 0;

  const createLink = (className?: string) => (
    <Link href="/dashboard/classes/new" id="btn-create-class-list" className={cn(primaryLink, className)}>
      <Plus aria-hidden="true" />
      {t("tutorClass.classes.create")}
    </Link>
  );

  return (
    <Page>
      <PageHeader
        title={t("tutorClass.classes.title")}
        description={t("tutorClass.classes.subtitle")}
        // Phones: the create action is the app bar "+"; the page keeps one primary.
        appBarAction={{ href: "/dashboard/classes/new", label: t("tutorClass.classes.create") }}
        actions={
          <>
            <Link href="/dashboard/classes/auction" className={secondaryLink}>
              <Megaphone aria-hidden="true" />
              {t("tutorClass.ui.auctionLink")}
            </Link>
            {/* With no classes the empty card carries the create action instead. Hidden below 768px in px, the width the app bar (and its "+") shows at. */}
            {isEmpty ? null : createLink("max-[768px]:hidden")}
          </>
        }
      />

      {isEmpty ? (
        <EmptyState
          mascot
          title={t("tutorClass.classes.empty")}
          description={t("tutorClass.ui.emptyListDescription")}
          action={createLink()}
        />
      ) : (
        <ClassListView classes={classesList} showDevDelete={showDevDelete} />
      )}
    </Page>
  );
}
