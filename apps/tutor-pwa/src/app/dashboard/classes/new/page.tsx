"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, BookOpen, Calendar, Link2 } from "lucide-react";
import Link from "next/link";

const BOOKS = [
  { value: "origins-1", label: "Origins 1 (Level 1)" },
  { value: "origins-2", label: "Origins 2 (Level 2)" },
  { value: "origins-3-1", label: "Origins 3.1 (Level 3)" },
  { value: "origins-3-2", label: "Origins 3.2 (Level 3)" },
  { value: "quest-4", label: "Quest 4 (Level 4)" },
  { value: "quest-5", label: "Quest 5 (Level 5)" },
  { value: "quest-6-1", label: "Quest 6.1 (Level 6)" },
  { value: "quest-6-2", label: "Quest 6.2 (Level 6)" },
];

import { createClass } from "../actions";

export default function NewClassPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [form, setForm] = useState({
    name: "",
    book: "",
    schedule: "",
    meetingUrl: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorText("");
    
    try {
      await createClass(form);
      router.push("/dashboard/classes");
      router.refresh();
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setErrorText(error.message || "เกิดข้อผิดพลาดในการสร้างคลาส");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl pb-24 lg:pb-0">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/classes">
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            สร้างคลาสเรียนใหม่
          </h1>
          <p className="text-sm text-muted-foreground">
            กรอกรายละเอียดคลาสเพื่อเริ่มรับสมัครนักเรียน
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 flex-1">
          {/* Class name */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                ข้อมูลคลาส
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="class-name">ชื่อคลาส</Label>
                <Input
                  id="class-name"
                  placeholder="เช่น Origins 1 - กลุ่ม A"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="book">หนังสือเรียน</Label>
                <select
                  id="book"
                  value={form.book}
                  onChange={(e) => setForm({ ...form, book: e.target.value })}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">เลือกหนังสือ...</option>
                  {BOOKS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                ตารางเรียน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <Label htmlFor="schedule">วัน/เวลาเรียน</Label>
                <Input
                  id="schedule"
                  placeholder="เช่น ทุกวันจันทร์ 19:00-21:00"
                  value={form.schedule}
                  onChange={(e) =>
                    setForm({ ...form, schedule: e.target.value })
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  ตารางนี้จะแสดงให้นักเรียนเห็นก่อนสมัคร
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Meeting URL */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                ลิงก์ห้องเรียนออนไลน์
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <Label htmlFor="meeting-url">Google Meet / Zoom URL</Label>
                <Input
                  id="meeting-url"
                  type="url"
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  value={form.meetingUrl}
                  onChange={(e) =>
                    setForm({ ...form, meetingUrl: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  ลิงก์นี้จะแสดงให้นักเรียนกดเข้าเรียนได้เฉพาะนักเรียนที่ชำระเงินแล้วเท่านั้น
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit Button - Sticky on Mobile, Natural on Desktop */}
        <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 p-4 lg:p-0 bg-background/80 backdrop-blur-md border-t border-border lg:border-none lg:static lg:bg-transparent lg:mt-8 z-40">
          {errorText && (
            <p className="text-destructive text-sm font-medium mb-3 text-center lg:text-left">
              {errorText}
            </p>
          )}
          <Button
            id="btn-submit-create-class"
            type="submit"
            size="lg"
            className="w-full lg:w-auto lg:px-8 font-semibold shadow-md"
            disabled={loading}
          >
            {loading ? "กำลังสร้างคลาส..." : "สร้างคลาสและรับ Referral Link"}
          </Button>
        </div>
      </form>
    </div>
  );
}
