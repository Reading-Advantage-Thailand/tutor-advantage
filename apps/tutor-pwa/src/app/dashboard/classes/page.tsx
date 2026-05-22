import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight, BookOpen, Users, Calendar } from "lucide-react";
import { cookies } from "next/headers";
import { DeleteClassButton } from "./[classId]/client-components";
import { t } from "@/lib/i18n";
import { PageTransition } from "@/components/ui/page-transition";

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
    <PageTransition variant="slide-up" stagger className="space-y-6 lg:space-y-8 max-w-4xl mx-auto pb-24 sm:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">{t("tutorClass.classes.title")}</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            {t("tutorClass.classes.subtitle")}
          </p>
        </div>
        <Link href="/dashboard/classes/new" className="hidden sm:block">
          <Button
            id="btn-create-class-list"
            className="h-10 px-6 rounded-xl font-bold bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all gap-2 shrink-0"
          >
            <Plus className="h-4 w-4" />
            {t("tutorClass.classes.create")}
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 stagger">
        {classesList.length === 0 && (
          <div className="py-16 text-center border-2 border-dashed border-border/60 rounded-3xl bg-muted/15 flex flex-col items-center justify-center gap-3 animate-scale-in">
            <BookOpen className="h-10 w-10 text-muted-foreground/30 animate-float" />
            <p className="text-muted-foreground font-semibold">{t("tutorClass.classes.empty")}</p>
          </div>
        )}
        {classesList.map((cls: any, index: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          const status = statusLabel[cls.status] || statusLabel.closed;
          return (
            <Link 
              key={cls.id} 
              href={`/dashboard/classes/${cls.id}`} 
              className="group block focus:outline-none rounded-3xl animate-slide-up"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <Card className="hover-lift press-scale border border-border/40 hover:shadow-lg hover:border-brand-500/20 transition-all duration-300 cursor-pointer overflow-hidden bg-card bg-gradient-to-br from-card via-card to-brand-500/2 dark:to-brand-500/5 rounded-3xl shadow-sm">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center shrink-0 border border-brand-500/10 group-hover:bg-brand-500 group-hover:text-white group-hover:border-brand-500 transition-all duration-300">
                        <BookOpen className="h-6 w-6 text-brand-600 dark:text-brand-400 group-hover:text-white transition-colors" />
                      </div>
                      <div className="min-w-0 pr-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-lg text-foreground truncate group-hover:text-primary transition-colors">
                            {cls.name}
                          </p>
                          <Badge variant={status.variant} className={`text-[10px] font-bold px-2 py-0.5 rounded-full hidden sm:inline-flex ${status.className || ""}`}>
                            {status.label}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-muted-foreground truncate">
                          {t("tutorClass.classes.bookLabel")} <span className="text-foreground font-semibold">{cls.book}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                          <span className="flex items-center gap-1.5 bg-muted/60 dark:bg-neutral-800/80 px-2 py-1 rounded-md">
                            <Calendar className="h-3.5 w-3.5 text-brand-500" />
                            {cls.nextSession}
                          </span>
                          <span className="flex items-center gap-1.5 bg-muted/60 dark:bg-neutral-800/80 px-2 py-1 rounded-md">
                            <Users className="h-3.5 w-3.5 text-brand-500" />
                            {cls.students}/{cls.maxStudents} {t("tutorClass.classes.peopleUnit")}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-border/40 sm:border-0 gap-2 shrink-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={status.variant} className={`text-xs px-2.5 py-0.5 sm:hidden ${status.className || ""}`}>
                          {status.label}
                        </Badge>
                        <DeleteClassButton classId={cls.id} />
                      </div>
                      <div className="flex items-center gap-1 text-xs font-bold text-primary ml-auto sm:ml-0 group-hover:underline">
                        {t("tutorClass.classes.manage")}
                        <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="sm:hidden fixed bottom-[88px] right-4 left-4 z-40">
        <Link href="/dashboard/classes/new" className="block w-full">
          <Button className="w-full shadow-lg h-12 rounded-xl text-base gap-2 font-bold bg-primary hover:bg-primary/95 text-white animate-bounce-in">
            <Plus className="h-5 w-5" />
            {t("tutorClass.classes.create")}
          </Button>
        </Link>
      </div>
    </PageTransition>
  );
}
