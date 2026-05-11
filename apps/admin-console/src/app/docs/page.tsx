"use client";

import { useState } from "react";
import { 
  BookOpen, 
  ChevronRight, 
  FileText, 
  ShieldCheck, 
  Zap, 
  MessageSquare, 
  ArrowLeft 
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const DOCS_CONTENT: Record<string, { title: string, content: React.ReactNode }> = {
  "settlement-approval": {
    title: "ขั้นตอนการอนุมัติชำระเงิน",
    content: (
      <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
        <p>การชำระเงินให้กับติวเตอร์ในระบบ Tutor Advantage ใช้หลักการ <strong>Maker-Checker</strong> เพื่อความโปร่งใสและป้องกันข้อผิดพลาด:</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li><strong>Maker (ผู้สร้างรายการ):</strong> ทำหน้าที่เข้าไปที่เมนู &quot;การชำระเงิน&quot; และสร้าง &quot;ตัวอย่างรอบบิล (Preview)&quot; ระบบจะดึงยอดการสอนทั้งหมด และคอมมิชชันจากเครือข่าย (MLM) โดยอัตโนมัติ</li>
          <li><strong>Checker (ผู้อนุมัติ):</strong> บัญชีที่มีสิทธิ์เป็น Finance Checker เข้ามาตรวจสอบยอดรวม หากถูกต้องให้กดปุ่ม &quot;อนุมัติ & โอนเงิน&quot;</li>
          <li>เมื่ออนุมัติแล้ว สถานะจะเปลี่ยนเป็น APPROVED และระบบจะล็อกบัญชีเหล่านั้นไม่ให้มีการแก้ไขย้อนหลัง (Immutable)</li>
        </ol>
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl mt-4">
          <strong>ข้อควรระวัง:</strong> ผู้ที่กดสร้างรายการ (Maker) จะไม่มีสิทธิ์กดอนุมัติรายการของตนเองได้ ต้องให้ผู้ดูแลระบบท่านอื่นเป็นคนกดอนุมัติเสมอ
        </div>
      </div>
    )
  },
  "payout-exceptions": {
    title: "การจัดการข้อผิดพลาดของการจ่ายเงิน",
    content: (
      <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
        <p>ในระหว่างการโอนเงินอาจมีข้อผิดพลาดเกิดขึ้น (เช่น บัญชี PromptPay ปลายทางถูกระงับ หรือข้อมูลไม่ถูกต้อง):</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>รายการที่เกิดปัญหาจะถูกส่งไปที่เมนู <strong>ข้อผิดพลาดระบบ (Exceptions)</strong></li>
          <li>ให้ผู้ดูแลระบบติดต่อติวเตอร์เพื่อแก้ไขข้อมูลบัญชีให้ถูกต้อง</li>
          <li>เมื่อทำการโอนเงินชดเชยให้ติวเตอร์นอกระบบสำเร็จแล้ว ให้กลับมากดปุ่ม <strong>&quot;บังคับสำเร็จ (Force Active)&quot;</strong> เพื่อเคลียร์สถานะในระบบ</li>
          <li>หากรายการนั้นเป็นรายการที่ผิดพลาดและไม่ต้องการโอนเงิน ให้กด <strong>&quot;ยกเลิก / โมฆะ (Void Cancel)&quot;</strong></li>
        </ul>
      </div>
    )
  },
  "manual-adjustments": {
    title: "แนวทางการปรับปรุงยอดด้วยตนเอง",
    content: (
      <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
        <p>ฟีเจอร์ ปรับปรุงยอด (Adjustments) ใช้สำหรับการแก้ไขยอดเงินกรณีพิเศษ เช่น การหักค่าปรับ หรือเพิ่มโบนัสให้ติวเตอร์:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>ไปที่เมนู <strong>ปรับปรุงยอด (Adjustments)</strong></li>
          <li>กรอก รหัสติวเตอร์ (Tutor ID) และ รอบบิลเป้าหมาย ที่ต้องการให้ยอดไปปรากฏ</li>
          <li>ระบุจำนวนเงินในหน่วย <strong>สตางค์</strong> (ใส่เครื่องหมาย <code>-</code> ด้านหน้าหากต้องการหักเงิน)</li>
          <li>จำเป็นต้องระบุเหตุผลทุกครั้ง เพื่อให้มีประวัติในระบบ (Audit Trail)</li>
          <li>คำขอจะอยู่ในสถานะ &quot;รออนุมัติ&quot; จนกว่าจะมีแอดมินคนอื่นเข้ามากดอนุมัติให้</li>
        </ul>
      </div>
    )
  },
  "fraud-flags": {
    title: "เกณฑ์การตรวจสอบทุจริต (Fraud Flags)",
    content: (
      <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
        <p>ระบบตรวจจับความเสี่ยงอัตโนมัติ (Automated Risk System) จะทำงานเบื้องหลังตลอดเวลาเพื่อปกป้องระบบการเงิน:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>ระดับ LOW/MEDIUM:</strong> พฤติกรรมน่าสงสัยเล็กน้อย แอดมินควรเข้ามากด &quot;เฝ้าระวัง (Monitor)&quot; หรือถ้าตรวจสอบแล้วปกติ ให้กด &quot;เคลียร์ (Clear)&quot;</li>
          <li><strong>ระดับ HIGH:</strong> พฤติกรรมที่มีความเสี่ยงทางการเงิน เช่น ยอดคอมมิชชันเครือข่ายเติบโตผิดปกติ หรือสร้างคลาสซ้อนกันมากเกินไป (Velocity limit)</li>
          <li><strong>ระดับ CRITICAL:</strong> การกระทำที่เข้าข่ายทุจริตชัดเจน ระบบอาจระงับบัญชี (Freeze) โดยอัตโนมัติ แอดมินต้องตรวจสอบสาเหตุอย่างละเอียดก่อนทำการปลดล็อก</li>
        </ul>
      </div>
    )
  },
  "kyc-process": {
    title: "ขั้นตอนการยืนยันตัวตน (KYC)",
    content: (
      <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
        <p>เพื่อให้ Tutor Advantage เป็นแพลตฟอร์มที่ปลอดภัย ผู้ใช้งานทุกคนต้องได้รับการยืนยัน:</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li><strong>ติวเตอร์ (Tutor):</strong> ต้องอัปโหลดบัตรประชาชน (ID Card) และใบรับรองประวัติอาชญากรรม แอดมินมีหน้าที่ตรวจสอบความถูกต้องก่อนอนุมัติสิทธิ์การสอน</li>
          <li><strong>นักเรียน (Student):</strong> ต้องมีการให้ความยินยอม (Consent) จากผู้ปกครอง หากยังไม่มีการยืนยัน นักเรียนจะไม่สามารถซื้อคลาสเรียนได้</li>
        </ol>
        <p className="mt-2 text-muted-foreground text-xs italic">สามารถตรวจสอบเอกสารที่รออนุมัติได้ในเมนู &quot;ผู้ใช้งาน & ความยินยอม&quot;</p>
      </div>
    )
  },
  "data-privacy": {
    title: "นโยบายความเป็นส่วนตัวของข้อมูล (ภายใน)",
    content: (
      <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
        <p>ข้อควรปฏิบัติสำหรับผู้ดูแลระบบเกี่ยวกับข้อมูลส่วนบุคคล (PDPA):</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>ห้ามส่งออก (Export) ข้อมูลส่วนบุคคลของนักเรียนหรือติวเตอร์ออกจากระบบ โดยไม่มีเหตุผลอันควรด้านการปฏิบัติงาน</li>
          <li>การกด Export ไฟล์ CSV หรือข้อมูลทางการเงินใดๆ ระบบจะทำการบันทึกประวัติ (Audit Trail) โดยอัตโนมัติแบบหลีกเลี่ยงไม่ได้</li>
          <li>ห้ามถ่ายภาพหน้าจอที่มีข้อมูลส่วนตัวของผู้ใช้งานส่งต่อไปยังช่องทางภายนอกเด็ดขาด</li>
        </ul>
      </div>
    )
  },
  "service-architecture": {
    title: "ความสัมพันธ์ของ Service ต่างๆ",
    content: (
      <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
        <p>Tutor Advantage ถูกออกแบบมาในรูปแบบ Microservices เพื่อการรองรับผู้ใช้จำนวนมาก:</p>
        <ul className="list-disc pl-5 space-y-3">
          <li><strong>Identity Service:</strong> บริหารจัดการผู้ใช้งาน การล็อกอิน เช็คสิทธิ์ (Role) และจัดการเอกสาร Consent</li>
          <li><strong>Learning Service:</strong> บริหารจัดการระบบห้องเรียน การสมัครเรียน ตารางเวลาสอน และระบบแชทพูดคุย</li>
          <li><strong>Finance-MLM Service:</strong> ดึงข้อมูลจาก Learning Service มาประมวลผลยอดเงินที่ติวเตอร์ทำได้ และคำนวณโบนัสค่าแนะนำ (MLM) ก่อนส่งเรื่องให้ Admin อนุมัติการจ่ายเงิน</li>
        </ul>
      </div>
    )
  },
  "api-limits": {
    title: "ข้อจำกัดการเรียกใช้งาน API (Rate Limiting)",
    content: (
      <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
        <p>ระบบมีการควบคุมปริมาณการเรียกข้อมูล (Rate Limiting) เพื่อป้องกันเซิร์ฟเวอร์ทำงานหนักเกินไป:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>บัญชีผู้ดูแลระบบ (Admin) จะมีเพดานข้อจำกัดที่สูงกว่าบัญชีผู้ใช้ทั่วไป เพื่อความคล่องตัวในการทำงาน</li>
          <li>หากมีการเรียกใช้หน้าเว็บซ้ำๆ อย่างรวดเร็ว อาจเจอกับข้อผิดพลาด <strong>429 Too Many Requests</strong></li>
          <li>ระบบสร้างและโหลดรายงาน (Report Export) ถูกตั้งค่าให้ทำได้ทีละรายการ เพื่อป้องกันไม่ให้ฐานข้อมูลถูกทำงานหนักพร้อมๆ กัน</li>
        </ul>
      </div>
    )
  },
  "db-schema": {
    title: "โครงสร้างฐานข้อมูล (Database Schema)",
    content: (
      <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
        <p>ฐานข้อมูลหลักของโครงการเป็น PostgreSQL บริหารจัดการด้วย Prisma ORM โดยแบ่งตารางออกเป็น 3 โดเมน:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li><code>identity.sql</code>: เก็บข้อมูล Users, Roles และ Guardians</li>
          <li><code>learning.sql</code>: เก็บข้อมูล Classes, Enrollments, Chat Messages</li>
          <li><code>finance_mlm.sql</code>: เก็บข้อมูล Settlements, Payouts, Adjustments และ Fraud Flags</li>
        </ul>
        <p className="mt-4 text-[10px] uppercase font-bold tracking-widest text-muted-foreground p-3 bg-muted/50 rounded-lg">
          Reference: packages/database/schemas/*
        </p>
      </div>
    )
  }
};

const DOCS_SECTIONS = [
  {
    title: "คู่มือการปฏิบัติงาน",
    description: "ขั้นตอนมาตรฐานสำหรับการชำระเงิน, การปรับปรุงยอด และการจัดการข้อผิดพลาด",
    icon: Zap,
    items: [
      { id: "settlement-approval", name: "ขั้นตอนการอนุมัติชำระเงิน" },
      { id: "payout-exceptions", name: "การจัดการข้อผิดพลาดของการจ่ายเงิน" },
      { id: "manual-adjustments", name: "แนวทางการปรับปรุงยอดด้วยตนเอง" },
    ]
  },
  {
    title: "กฎระเบียบและความเสี่ยง",
    description: "แนวทางการตรวจสอบการทุจริตและการยืนยันตัวตนของผู้ใช้",
    icon: ShieldCheck,
    items: [
      { id: "fraud-flags", name: "เกณฑ์การตรวจสอบทุจริต (Fraud Flags)" },
      { id: "kyc-process", name: "ขั้นตอนการยืนยันตัวตน (KYC)" },
      { id: "data-privacy", name: "นโยบายความเป็นส่วนตัวของข้อมูล (สำหรับภายใน)" },
    ]
  },
  {
    title: "สถาปัตยกรรมระบบ",
    description: "ภาพรวมเชิงเทคนิคของระบบ Tutor Advantage",
    icon: FileText,
    items: [
      { id: "service-architecture", name: "ความสัมพันธ์ของ Service ต่างๆ" },
      { id: "api-limits", name: "ข้อจำกัดการเรียกใช้งาน API (Rate Limiting)" },
      { id: "db-schema", name: "โครงสร้างฐานข้อมูล (Database Schema)" },
    ]
  }
];

export default function DocsPage() {
  const [openDocId, setOpenDocId] = useState<string | null>(null);

  const activeDoc = openDocId ? DOCS_CONTENT[openDocId] : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-foreground">คู่มือระบบภายใน</h2>
          <p className="text-muted-foreground font-medium">ศูนย์รวมความรู้และวิธีการทำงานสำหรับผู้ดูแลระบบ Tutor Advantage</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {DOCS_SECTIONS.map((section) => (
          <Card key={section.title} className="border-none shadow-sm rounded-3xl overflow-hidden bg-card transition-all hover:shadow-md">
            <CardHeader className="pb-4">
              <div className="p-3 bg-brand-50 dark:bg-brand-900/20 rounded-2xl text-brand-600 dark:text-brand-400 w-fit mb-2">
                <section.icon className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl font-bold">{section.title}</CardTitle>
              <CardDescription className="font-medium text-sm leading-relaxed">
                {section.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <button 
                      onClick={() => setOpenDocId(item.id)}
                      className="w-full group flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                    >
                      <span className="text-sm font-semibold text-foreground/80 group-hover:text-brand-600 transition-colors">
                        {item.name}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-600 transition-all group-hover:translate-x-1" />
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-lg rounded-3xl p-8 bg-gradient-to-r from-brand-600 to-brand-800 text-white relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <h3 className="text-2xl font-black mb-2">ยังต้องการความช่วยเหลือ?</h3>
          <p className="text-brand-100 font-medium mb-6">
            หากคุณไม่พบข้อมูลที่ต้องการ กรุณาติดต่อทีมงาน Support โดยตรงผ่านช่องทาง LINE
          </p>
          <Button variant="secondary" className="rounded-xl font-bold bg-white text-brand-900 hover:bg-brand-50 px-8 h-12" asChild>
            <Link href="https://lin.ee/zqTz6feg" target="_blank">
              <MessageSquare className="h-5 w-5 mr-2" />
              ติดต่อเจ้าหน้าที่
            </Link>
          </Button>
        </div>
        <BookOpen className="absolute -right-8 -bottom-8 h-48 w-48 text-white/10 -rotate-12" />
      </Card>

      <Sheet open={!!openDocId} onOpenChange={(open) => !open && setOpenDocId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {activeDoc && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle className="text-2xl font-black leading-tight text-brand-700 dark:text-brand-400">
                  {activeDoc.title}
                </SheetTitle>
                <SheetDescription className="font-medium text-xs uppercase tracking-widest">
                  คู่มือสำหรับแอดมิน Tutor Advantage
                </SheetDescription>
              </SheetHeader>
              <div className="py-2">
                {activeDoc.content}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}