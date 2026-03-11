import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight, BookOpen, Users, Calendar } from "lucide-react";

const mockClasses = [
  {
    id: "cls-1",
    name: "Origins 1 - กลุ่ม A",
    book: "Origins 1",
    status: "open",
    students: 3,
    maxStudents: 5,
    nextSession: "จ. 10 มี.ค. 19:00",
  },
  {
    id: "cls-2",
    name: "Quest 4 - กลุ่ม B",
    book: "Quest 4",
    status: "full",
    students: 5,
    maxStudents: 5,
    nextSession: "อ. 11 มี.ค. 17:00",
  },
  {
    id: "cls-3",
    name: "Origins 2 - กลุ่ม C",
    book: "Origins 2",
    status: "open",
    students: 2,
    maxStudents: 5,
    nextSession: "พ. 12 มี.ค. 18:00",
  },
];

const statusLabel: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className?: string;
  }
> = {
  open: { 
    label: "รับสมัครอยู่", 
    variant: "default",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20"
  },
  full: { 
    label: "เต็มแล้ว", 
    variant: "secondary",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/20"
  },
  closed: { 
    label: "ปิดแล้ว", 
    variant: "outline",
    className: "bg-muted text-muted-foreground border-border" 
  },
};

export default function ClassesPage() {
  return (
    <div className="space-y-6 lg:space-y-8 max-w-4xl mx-auto pb-24 sm:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">คลาสเรียน</h1>
          <p className="text-sm text-muted-foreground mt-1">
            จัดการคลาสเรียนและแชร์ลิงก์เชิญนักเรียน
          </p>
        </div>
        <Link href="/dashboard/classes/new" className="hidden sm:block">
          <Button
            id="btn-create-class-list"
            className="gap-2 shrink-0 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            สร้างคลาสใหม่
          </Button>
        </Link>
      </div>

      <div className="grid gap-4">
        {mockClasses.map((cls) => {
          const s = statusLabel[cls.status];
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
                          <Badge variant={s.variant} className={`text-[10px] px-2 py-0 hidden sm:inline-flex ${s.className || ''}`}>
                            {s.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mb-1.5">
                          หนังสือ: <span className="text-foreground">{cls.book}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-primary/70" />
                            {cls.nextSession}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-primary/70" />
                            {cls.students}/{cls.maxStudents} คน
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-border/50 sm:border-0">
                      <Badge variant={s.variant} className={`text-xs px-2.5 py-0.5 sm:hidden ${s.className || ''}`}>
                        {s.label}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs font-medium text-primary ml-auto sm:ml-0 group-hover:underline">
                        จัดการคลาส
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

      {/* Mobile Fabric/Sticky Create Button */}
      <div className="sm:hidden fixed bottom-[72px] right-4 left-4 z-40">
        <Link href="/dashboard/classes/new" className="block w-full">
          <Button className="w-full shadow-lg h-12 rounded-xl text-base gap-2 font-semibold">
            <Plus className="h-5 w-5" />
            สร้างคลาสใหม่
          </Button>
        </Link>
      </div>
    </div>
  );
}
