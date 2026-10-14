import Link from "next/link";
import { cookies } from "next/headers";
import { BookOpen, Megaphone, Plus } from "lucide-react";
import { EmptyState, Page, PageHeader, Section } from "@/components/app";
import { LEARNING_URL } from "@/lib/service-urls";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ClassCard, type ClassListItem } from "./components/ClassCard";

async function getClassesData(token: string) {
  const res = await fetch(`${LEARNING_URL}/v1/classes`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  return res.json();
}

// Server components can't use buttonVariants (client module), so the link
// buttons share these token classes with ui/button.
const linkButton =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/40 pointer-coarse:h-10 [&_svg]:size-4";

export default async function ClassesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";
  const showDevDelete = process.env.NODE_ENV === "development";

  const response = await getClassesData(token);
  const classesList: ClassListItem[] = response?.classes || [];
  const active = classesList.filter((cls) => cls.status !== "closed");
  const closed = classesList.filter((cls) => cls.status === "closed");

  const createLink = (
    <Link
      href="/dashboard/classes/new"
      id="btn-create-class-list"
      className={cn(linkButton, "bg-brand-solid text-on-brand shadow-xs hover:bg-brand-solid-pressed")}
    >
      <Plus aria-hidden="true" />
      {t("tutorClass.classes.create")}
    </Link>
  );

  return (
    <Page>
      <PageHeader
        title={t("tutorClass.classes.title")}
        description={t("tutorClass.classes.subtitle")}
        actions={
          <>
            <Link
              href="/dashboard/classes/auction"
              className={cn(linkButton, "border border-field-border bg-surface text-fg hover:bg-surface-muted dark:border-hairline-strong")}
            >
              <Megaphone aria-hidden="true" />
              {t("tutorClass.ui.auctionLink")}
            </Link>
            {createLink}
          </>
        }
      />

      {classesList.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          tone="brand"
          title={t("tutorClass.classes.empty")}
          description={t("tutorClass.ui.emptyListDescription")}
          action={createLink}
        />
      ) : (
        <>
          {active.length > 0 ? (
            <Section
              title={t("tutorClass.ui.activeClasses")}
              description={`${active.length} ${t("tutorClass.ui.classesUnit")}`}
            >
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
                {active.map((cls) => (
                  <ClassCard key={cls.id} cls={cls} showDevDelete={showDevDelete} />
                ))}
              </ul>
            </Section>
          ) : null}
          {closed.length > 0 ? (
            <Section
              title={t("tutorClass.ui.closedClasses")}
              description={`${closed.length} ${t("tutorClass.ui.classesUnit")}`}
            >
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
                {closed.map((cls) => (
                  <ClassCard key={cls.id} cls={cls} showDevDelete={showDevDelete} />
                ))}
              </ul>
            </Section>
          ) : null}
        </>
      )}
    </Page>
  );
}
