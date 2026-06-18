import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, CalendarDays, Users } from "lucide-react";
import { UserClass, CLASS_STATUS_CONFIG } from "../types";

interface ClassesCardProps {
  role: string;
  classes: UserClass[];
}

export function ClassesCard({ role, classes }: ClassesCardProps) {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-card">
      <CardHeader className="px-6 pt-6 pb-4">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-brand-600" />
          {role === "TUTOR" ? "คลาสที่รับผิดชอบ" : "คลาสที่ลงเรียน"}
          <Badge
            variant="secondary"
            className="ml-auto rounded-full font-bold"
          >
            {classes.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {classes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <BookOpen className="h-10 w-10 opacity-20 mb-2" />
            <p className="text-sm">ยังไม่มีคลาส</p>
          </div>
        ) : (
          <div className="space-y-2">
            {classes.map((cls, index) => (
              <div
                key={`${cls.id}-${index}`}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate text-foreground">
                    {cls.name}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    {cls.bookTitle && <span>{cls.bookTitle}</span>}
                    {cls.startsAt && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(cls.startsAt).toLocaleDateString(
                          "th-TH",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {cls.students} คน
                    </span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`shrink-0 ml-3 text-[10px] font-bold ${CLASS_STATUS_CONFIG[cls.status] || ""}`}
                >
                  {cls.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
