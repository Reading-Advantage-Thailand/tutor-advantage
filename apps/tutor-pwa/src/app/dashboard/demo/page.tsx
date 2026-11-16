import { unstable_rethrow } from "next/navigation";
import { Gift, Sparkles } from "lucide-react";
import { CardHeader, Chip, IconTile, Page, PageHeader, SplitLayout, Surface } from "@/components/app";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { getBooks, getMyDemoClasses, type Book, type DemoClass } from "./actions";
import { DemoWorkspace } from "./components/DemoWorkspace";

/**
 * Demo rooms: the create card (or the active room) in the main column, and
 * "Demo ทำงานยังไง" as three numbered steps in the side rail (below on phones).
 */
export default async function DemoPage() {
  // Server-side reads (previously two server-action POSTs from a useEffect).
  let books: Book[] = [];
  let demoClasses: DemoClass[] = [];
  let loadError = false;
  try {
    [books, demoClasses] = await Promise.all([getBooks(), getMyDemoClasses()]);
  } catch (err) {
    // Let Next.js handle its own control-flow errors (dynamic bailout, redirect).
    unstable_rethrow(err);
    console.error(err);
    loadError = true;
  }

  const steps = [t("demo.howLine1"), t("demo.howLine2"), t("demo.howLine3")];

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

      <SplitLayout
        main={<DemoWorkspace books={books} initialClasses={demoClasses} loadError={loadError} />}
        side={
          <Surface padding="md" as="section" aria-labelledby="demo-how-title">
            <CardHeader id="demo-how-title" icon={<IconTile icon={Sparkles} tone="brand" />} title={t("demo.infoTitle")} />
            <ol className="flex flex-col gap-3">
              {steps.map((line, index) => (
                <li key={line} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-soft-fg tabular"
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 type-body-s text-fg">{thaiCopy(line)}</span>
                </li>
              ))}
            </ol>
          </Surface>
        }
      />
    </Page>
  );
}
