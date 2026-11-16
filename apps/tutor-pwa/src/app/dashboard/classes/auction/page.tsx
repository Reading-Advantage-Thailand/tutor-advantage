import Link from "next/link";
import { cookies } from "next/headers";
import { EmptyState, Page, PageHeader } from "@/components/app";
import { buttonVariants } from "@/components/ui/button-variants";
import { LEARNING_URL } from "@/lib/service-urls";
import { t } from "@/lib/i18n";
import { AuctionList, type AuctionItem } from "./AuctionList";

async function getAuctions() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;

  if (!token) return [];

  try {
    const res = await fetch(`${LEARNING_URL}/v1/classes/auction`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      next: { tags: ["auctions"] },
    });

    if (!res.ok) return [];

    const data = await res.json();
    return data.auctions || [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

// Secondary link-button: the shared "outline" button look (server-safe buttonVariants).
const secondaryLink = buttonVariants({ variant: "outline" });

export default async function AuctionPage() {
  const abandonedClasses: AuctionItem[] = await getAuctions();

  return (
    <Page width="medium">
      <PageHeader
        title={t("tutorClass.auction.title")}
        description={t("tutorClass.auction.subtitle")}
        backHref="/dashboard/classes"
        backLabel={t("tutorClass.classes.title")}
        meta={
          abandonedClasses.length > 0 ? (
            <span className="type-body-s text-fg-muted tabular">
              {abandonedClasses.length} {t("tutorClass.ui.classesUnit")}
            </span>
          ) : undefined
        }
      />

      {abandonedClasses.length === 0 ? (
        <EmptyState
          mascot
          title={t("tutorClass.auction.empty")}
          description={t("tutorClass.ui.auctionEmptyDescription")}
          action={
            <Link href="/dashboard/classes" className={secondaryLink}>
              {t("tutorClass.auction.back")}
            </Link>
          }
        />
      ) : (
        <AuctionList auctions={abandonedClasses} />
      )}
    </Page>
  );
}
