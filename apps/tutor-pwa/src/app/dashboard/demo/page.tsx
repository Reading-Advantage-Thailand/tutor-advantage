import { Gift, Sparkles } from "lucide-react";
import { CardHeader, Chip, IconTile, Page, PageHeader, Surface } from "@/components/app";
import { t } from "@/lib/i18n";
import { getBooks, getMyDemoClasses, type Book, type DemoClass } from "./actions";
import { DemoWorkspace } from "./components/DemoWorkspace";

export default async function DemoPage() {
  // Server-side reads (previously two server-action POSTs from a useEffect).
  let books: Book[] = [];
  let demoClasses: DemoClass[] = [];
  let loadError = false;
  try {
    [books, demoClasses] = await Promise.all([getBooks(), getMyDemoClasses()]);
  } catch (err) {
    console.error(err);
    loadError = true;
  }

  return (
    <Page width="medium">
      <PageHeader
        title={t("demo.pageTitle")}
        description={t("demo.pageDescription")}
        meta={
          <Chip tone="brand" icon={Gift}>
            {t("demo.freeBadge")}
          </Chip>
        }
      />

      <DemoWorkspace books={books} initialClasses={demoClasses} loadError={loadError} />

      <Surface padding="md" tone="muted">
        <CardHeader
          className="mb-3"
          icon={<IconTile icon={Sparkles} tone="brand" size="sm" />}
          title={t("demo.infoTitle")}
        />
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-fg-muted marker:text-brand-fg">
          <li>{t("demo.howLine1")}</li>
          <li>{t("demo.howLine2")}</li>
          <li>{t("demo.howLine3")}</li>
        </ul>
      </Surface>
    </Page>
  );
}
