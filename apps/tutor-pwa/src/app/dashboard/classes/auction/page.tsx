import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, Calendar, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { LEARNING_URL } from "@/lib/service-urls";
import { ClaimButton } from "./claim-button";
import { t } from "@/lib/i18n";

async function getAuctions() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) return [];

  try {
    const res = await fetch(`${LEARNING_URL}/v1/classes/auction`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      next: { tags: ['auctions'] }
    });
    
    if (!res.ok) return [];
    
    const data = await res.json();
    return data.auctions || [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

export default async function AuctionPage() {
  const abandonedClasses = await getAuctions();

  return (
    <div className="space-y-6 lg:space-y-8 max-w-4xl mx-auto pb-24 sm:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            {t("tutorClass.auction.title")} <AlertTriangle className="h-5 w-5 text-amber-500" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("tutorClass.auction.subtitle")}
          </p>
        </div>
        <Link href="/dashboard/classes" className="hidden sm:block">
          <Button variant="outline" className="gap-2 shrink-0">
            {t("tutorClass.auction.back")}
          </Button>
        </Link>
      </div>

      <div className="grid gap-4">
        {abandonedClasses.length === 0 && (
          <div className="py-12 text-center border rounded-xl border-dashed">
            <p className="text-muted-foreground">{t("tutorClass.auction.empty")}</p>
          </div>
        )}
        
        {abandonedClasses.map((cls: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
          <Card key={cls.id} className="overflow-hidden bg-card/50 backdrop-blur-sm sm:bg-card border-amber-500/20 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/10">
                    <BookOpen className="h-6 w-6 text-amber-500" />
                  </div>
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-base text-foreground truncate">
                        {cls.title}
                      </p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">
                        {t("tutorClass.auction.urgent")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mb-1.5">
                      {t("tutorClass.auction.subjectLabel")} <span className="text-foreground">{cls.subject}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-2">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-primary/70" />
                        {t("tutorClass.auction.expiresLabel")} {cls.expiresAt ? new Date(cls.expiresAt).toLocaleDateString('th-TH') : t("tutorClass.auction.noExpiry")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-primary/70" />
                        {cls.students} {t("tutorClass.classes.peopleUnit")}
                      </span>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      {t("tutorClass.auction.bonusPrefix")} {cls.networkBonusRate}% • {t("tutorClass.auction.reasonLabel")} {cls.reason}
                    </p>
                  </div>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-border/50 sm:border-0">
                  <ClaimButton transferId={cls.id} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
