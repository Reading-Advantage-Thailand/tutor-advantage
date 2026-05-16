import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight, BookOpen, Users, Calendar } from "lucide-react";
import { cookies } from "next/headers";
import { DeleteClassButton } from "./[classId]/client-components";
import { t } from "@/lib/i18n";

async function getClassesData(token: string) {
  const res = await fetch("http://localhost:3002/v1/classes", {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  return res.json();
}

const statusLabel: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className?: string;
  }
> = {
  open: {
    label: t("tutorClass.classes.statusOpen"),
    variant: "default",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20",
  },
  full: {
    label: t("tutorClass.classes.statusFull"),
    variant: "secondary",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/20",
  },
  closed: {
    label: t("tutorClass.classes.statusClosed"),
    variant: "outline",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export default async function ClassesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";

  const response = await getClassesData(token);
  const classesList = response?.classes || [];

  return (
    <div className="space-y-6 lg:space-y-8 max-w-4xl mx-auto pb-24 sm:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("tutorClass.classes.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("tutorClass.classes.subtitle")}
          </p>
        </div>
        <Link href="/dashboard/classes/new" className="hidden sm:block">
          <Button
            id="btn-create-class-list"
            className="gap-2 shrink-0 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            {t("tutorClass.classes.create")}
          </Button>
        </Link>
      </div>

      <div className="grid gap-4">
        {classesList.length === 0 && (
          <div className="py-12 text-center border rounded-xl border-dashed">
            <p className="text-muted-foreground">{t("tutorClass.classes.empty")}</p>
          </div>
        )}
        {classesList.map((cls: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          const status = statusLabel[cls.status] || statusLabel.closed;
          return (
            <Link key={cls.id} href={`/dashboard/classes/${cls.id}`} className="group block focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent rounded-xl">
              <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer overflow-hidden bg-card/50 backdrop-blur-sm sm:bg-card">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/10 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors">
                        <BookOpen className="h-6 w-6 text-primary group-hover:text-primary-foreground transition-colors" />
                      </div>
                      <div className="min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-base text-foreground truncate group-hover:text-primary transition-colors">
                            {cls.name}
                          </p>
                          <Badge variant={status.variant} className={`text-[10px] px-2 py-0 hidden sm:inline-flex ${status.className || ""}`}>
                            {status.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mb-1.5">
                          {t("tutorClass.classes.bookLabel")} <span className="text-foreground">{cls.book}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-primary/70" />
                            {cls.nextSession}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-primary/70" />
                            {cls.students}/{cls.maxStudents} {t("tutorClass.classes.peopleUnit")}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-border/50 sm:border-0 gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={status.variant} className={`text-xs px-2.5 py-0.5 sm:hidden ${status.className || ""}`}>
                          {status.label}
                        </Badge>
                        <DeleteClassButton classId={cls.id} />
                      </div>
                      <div className="flex items-center gap-1 text-xs font-medium text-primary ml-auto sm:ml-0 group-hover:underline">
                        {t("tutorClass.classes.manage")}
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="sm:hidden fixed bottom-[72px] right-4 left-4 z-40">
        <Link href="/dashboard/classes/new" className="block w-full">
          <Button className="w-full shadow-lg h-12 rounded-xl text-base gap-2 font-semibold">
            <Plus className="h-5 w-5" />
            {t("tutorClass.classes.create")}
          </Button>
        </Link>
      </div>
    </div>
  );
}
