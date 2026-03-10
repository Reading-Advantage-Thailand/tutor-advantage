import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight, BookOpen, Users } from "lucide-react";

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
  }
> = {
  open: { label: "รับสมัครอยู่", variant: "default" },
  full: { label: "เต็มแล้ว", variant: "secondary" },
  closed: { label: "ปิดแล้ว", variant: "destructive" },
};

export default function ClassesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">คลาสเรียน</h1>
          <p className="text-sm text-slate-500 mt-1">
            จัดการคลาสเรียนและแชร์ลิงก์เชิญนักเรียน
          </p>
        </div>
        <Link href="/dashboard/classes/new">
          <Button
            id="btn-create-class-list"
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
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
            <Link key={cls.id} href={`/dashboard/classes/${cls.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                        <BookOpen className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {cls.name}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          หนังสือ: {cls.book}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          คลาสต่อไป: {cls.nextSession}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge variant={s.variant} className="text-xs">
                        {s.label}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Users className="h-3 w-3" />
                        {cls.students}/{cls.maxStudents} คน
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
