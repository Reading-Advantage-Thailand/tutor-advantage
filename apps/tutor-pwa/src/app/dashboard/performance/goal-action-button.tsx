"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ArrowUpRight, CheckCircle2, BookOpen, MessageSquare, Users, Star } from "lucide-react";
import Link from "next/link";

type GoalDetails = {
  code: string;
  label: string;
};

const GOAL_ACTIONS: Record<string, { tips: string[]; link?: { href: string; label: string }; icon: any }> = {
  "RISING_STAR": {
    icon: Star,
    tips: [
      "เพิ่มรอบเรียนในปฏิทินของคุณเพื่อให้รับจำนวนชั่วโมงสอนสะสมได้ไวขึ้น",
      "วางแผนตารางสอนล่วงหน้าอย่างน้อย 2 สัปดาห์ให้นักเรียนสามารถจัดสรรเวลาได้สะดวก",
      "เน้นกิจกรรมเสริมในคลาสเพื่อคงความสนใจของนักเรียนจนจบคลาส"
    ],
    link: { href: "/dashboard/schedule", label: "ไปที่ตารางสอน" }
  },
  "FAST_RESPONDER": {
    icon: MessageSquare,
    tips: [
      "คอยหมั่นตรวจสอบแท็บ 'แชท' เป็นประจำเพื่อไม่พลาดข้อความสอบถามจากนักเรียน",
      "ให้ข้อมูลเพิ่มเติมหลังจบคลาสเรียนผ่านแชทกลุ่มเพื่อสร้างความเป็นกันเอง",
      "ตอบรับการแจ้งเตือนโดยเร็วที่สุดเพื่อรักษามาตรฐานเวลาเฉลี่ยของคุณ"
    ],
    link: { href: "/dashboard/chat", label: "เปิดดูแชท" }
  },
  "TOP_RATED": {
    icon: AwardIcon,
    tips: [
      "ใช้ฟีเจอร์ Live Interactive Session ทุกคลาสเพื่อกระตุ้นความสนุกระหว่างเรียน",
      "หมั่นใช้ Real-time Leaderboard เพื่อชมเชยนักเรียนที่ทำคะแนนได้ดีทันที",
      "สร้างปฏิสัมพันธ์กับนักเรียนผ่าน Group Chat อย่างต่อเนื่องเพื่อเพิ่มความประทับใจ"
    ],
    link: { href: "/dashboard/classes", label: "จัดการคลาสเรียน" }
  },
  "NETWORK_BUILDER": {
    icon: Users,
    tips: [
      "คัดลอก 'ลิงก์เชิญ' จากหน้าเครือข่ายและส่งผ่าน LINE ให้กลุ่มเป้าหมายของคุณ",
      "ตรวจสอบผังโครงสร้างองค์กรในหน้า 'เครือข่าย' เพื่อติดตามสถานะทีมของคุณ",
      "สนับสนุนให้ติวเตอร์ในเครือข่ายเปิดคลาสแรกเพื่อสะสมยอด Volume ร่วมกัน"
    ],
    link: { href: "/dashboard/network", label: "ไปที่เครือข่าย" }
  },
  "CLASS_MASTER": {
    icon: BookOpen,
    tips: [
      "รักษาตารางสอนให้สม่ำเสมอและกดเริ่ม/จบคลาสตามเวลาที่กำหนด",
      "หมั่นเตรียมบทความถัดไปตามแผนการสอน 15 ขั้นตอนของระบบ",
      "จัดสรรจำนวนนักเรียนในคลาสให้เหมาะสมกับศักยภาพการดูแลของคุณ"
    ],
    link: { href: "/dashboard/classes", label: "จัดการคลาสเรียน" }
  },
  "ELITE_EDUCATOR": {
    icon: Star,
    tips: [
      "ใช้ Interactive Sessions ร่วมวัดความเข้าใจระหว่างเรียนอยู่เสมอ",
      "ให้เวลาในการอธิบายซ้ำในช่วงการตรวจข้อสอบที่ AI ประเมินให้",
      "หมั่นติดตามแท็บ 'ผลงาน' เพื่อดูอัตราความสำเร็จรวมของนักเรียนคุณ"
    ]
  },
  "AI_PIONEER": {
    icon: Star,
    tips: [
      "เปิด Interactive Session ในทุกบทความเพื่อสร้างสภาพแวดล้อมการเรียนที่ล้ำสมัย",
      "ลองนำคำถามแบบเขียนบรรยาย (SAQ) ให้นักเรียนฝึกใช้และรับคำแนะนำจาก AI",
      "ตรวจสอบลำดับความถูกต้องของคำตอบในหน้าระบบหลังสอนจบ"
    ]
  }
};

// Temporary inner wrapper to bypass recursion for dynamic icon import
function AwardIcon(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/></svg>
}

export function GoalActionButton({ goal }: { goal: GoalDetails }) {
  const [open, setOpen] = useState(false);
  
  const config = GOAL_ACTIONS[goal.code] || {
    icon: Star,
    tips: ["พยายามพัฒนาขีดความสามารถในการสอนและการบริหารจัดการคลาสอย่างต่อเนื่อง", "ติดตามข่าวสารกิจกรรมเทรนนิ่งใหม่ๆ ของแพลตฟอร์ม"]
  };

  const Icon = config.icon;

  return (
    <>
      <Button 
        onClick={() => setOpen(true)}
        variant="outline" 
        className="w-full sm:w-auto border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 shrink-0 shadow-sm group"
      >
        พัฒนาต่อยอด <ArrowUpRight className="ml-2 h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 rounded-full bg-amber-500/10">
                <Icon className="h-5 w-5 text-amber-600" />
              </div>
              แผนพัฒนา: {goal.label}
            </DialogTitle>
            <DialogDescription>
              คำแนะนำแนวทางปฏิบัติ (Best Practices) เพื่อให้คุณพิชิตเป้าหมายนี้ได้ไวขึ้น
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 my-2">
            {config.tips.map((tip, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl border border-border/40">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-foreground leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between items-center">
            {config.link ? (
              <Link href={config.link.href} className="w-full sm:w-auto" onClick={() => setOpen(false)}>
                <Button className="w-full">
                  {config.link.label} <ArrowUpRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            ) : <div />}
            <Button variant="ghost" onClick={() => setOpen(false)} className="w-full sm:w-auto text-muted-foreground">
              เข้าใจแล้ว
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
