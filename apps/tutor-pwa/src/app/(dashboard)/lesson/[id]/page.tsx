"use client";

import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, BookOpen, Play, Settings } from "lucide-react";
import Link from "next/link";

export default function LessonDetailPage() {
  const params = useParams();
  const classId = params.id as string;

  return (
    <div className="w-full max-w-4xl pb-24 lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/classes">
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            จัดการบทเรียน
          </h1>
          <p className="text-sm text-muted-foreground">
            เลือก เริ่มต้น หรือตั้งค่าเซสชันการเรียน
          </p>
        </div>
      </div>

      {/* Main Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Start Teaching Button */}
        <Link href={`/dashboard/classes/${classId}/select`} className="block">
          <Card className="cursor-pointer border-2 hover:border-primary hover:shadow-md transition-all h-full">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center min-h-[200px]">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Play className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                เริ่มสอน
              </h3>
              <p className="text-sm text-muted-foreground">
                เลือกบทเรียนและเริ่มเซสชันการเรียน
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* View Settings Button */}
        <Link href={`/dashboard/classes/${classId}`} className="block">
          <Card className="cursor-pointer border-2 hover:border-primary hover:shadow-md transition-all h-full">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center min-h-[200px]">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Settings className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                ตั้งค่าคลาส
              </h3>
              <p className="text-sm text-muted-foreground">
                ดูรายละเอียด ลิงค์เชิญ และจัดการนักเรียน
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Info Card */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            วิธีการใช้งาน
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 font-semibold text-primary text-xs">
              1
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">เลือกบทเรียน</p>
              <p>กดปุ่ม "เริ่มสอน" เพื่อเลือกบทความที่จะสอนในวันนี้</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 font-semibold text-primary text-xs">
              2
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">แชร์ PIN</p>
              <p>ระบบจะสร้าง PIN 6 หลัก ให้นักเรียนป้อน PIN เพื่อเข้าร่วม</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 font-semibold text-primary text-xs">
              3
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">สอน</p>
              <p>ใช้ Phase Manager เพื่อควบคุมการไหลของบทเรียน 15 ขั้นตอน</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
