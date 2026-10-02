import { cookies } from "next/headers";
import { Page, PageHeader } from "@/components/app";
import { LEARNING_URL } from "@/lib/service-urls";
import { t } from "@/lib/i18n";
import type { BookOption } from "../components/book-options";
import { NewClassForm } from "./NewClassForm";

/** Same request as the `getBooks` action, done on the server so the form renders with its options. */
async function getBookOptions(): Promise<BookOption[]> {
  const token = (await cookies()).get("tutor_session")?.value;
  if (!token) return [];
  try {
    const res = await fetch(`${LEARNING_URL}/v1/books`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to fetch books");
    const data = (await res.json()) as { books?: BookOption[] };
    return data.books || [];
  } catch (error) {
    console.error("Error loading books:", error);
    return [];
  }
}

export default async function NewClassPage() {
  const books = await getBookOptions();
  return (
    <Page width="narrow">
      <PageHeader
        title={t("tutorClass.newClass.title")}
        description={t("tutorClass.newClass.subtitle")}
        backHref="/dashboard/classes"
        backLabel={t("tutorClass.classes.title")}
      />
      <NewClassForm books={books} />
    </Page>
  );
}
