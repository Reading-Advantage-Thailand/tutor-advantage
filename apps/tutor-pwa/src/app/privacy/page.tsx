import { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว (Privacy Policy) - Tutor PWA",
  description:
    "นโยบายการจัดเก็บและปกป้องข้อมูลส่วนบุคคลระบบครูผู้สอน Tutor Advantage",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-3xl mx-auto flex h-14 items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              นโยบายความเป็นส่วนตัว
            </h1>
            <p className="text-muted-foreground">
              ปรับปรุงล่าสุด: 11 มีนาคม 2026
            </p>
          </div>

          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p className="lead">
              บริษัทของเราตระหนักถึงความสำคัญของการปกป้องข้อมูลส่วนบุคคลของคุณ
              แพลตฟอร์ม Tutor Advantage ("เรา", "พวกเรา" หรือ "ของเรา")
              ได้จัดทำนโยบายความเป็นส่วนตัวนี้ เพื่ออธิบายวิธีการเก็บรวบรวม ใช้
              เปิดเผย และปกป้องข้อมูลส่วนบุคคลของคุณ
            </p>

            <h2>1. ข้อมูลที่เราเก็บรวบรวม</h2>
            <ul>
              <li>
                <strong>ข้อมูลการติดต่อเบื้องต้น:</strong> เช่น ชื่อ นามสกุล
                อีเมล หมายเลขโทรศัพท์ และข้อมูลที่ใช้ในการยืนยันตัวตน
              </li>
              <li>
                <strong>ข้อมูลทางบัญชีและการเงิน:</strong>{" "}
                รวมถึงบัญชีธนาคารสำหรับรับโอนรายได้
                และหมายเลขประจำตัวผู้เสียภาษี (หากมี)
              </li>
              <li>
                <strong>ประวัติกิจกรรมการใช้งาน:</strong> เช่น คลาสที่สอน,
                ประวัติการเข้าสู่ระบบ, บันทึกการสอน, ข้อมูลลิงก์ผู้แนะนำ
                (Referral URL) ของคุณที่ถูกกดเข้าชม
              </li>
              <li>
                <strong>ข้อมูลอุปกรณ์:</strong> เช่น หมายเลข IP Address,
                ชนิดของเบราว์เซอร์
                ที่ใช้เพื่อวัตถุประสงค์ในการวิเคราะห์ความปลอดภัยและการเข้าถึงแอปพลิเคชัน
                (PWA)
              </li>
            </ul>

            <h2>2. วิธีการนำข้อมูลไปใช้</h2>
            <p>เรานำข้อมูลของคุณไปใช้เพื่อ:</p>
            <ul>
              <li>สร้างและจัดการบัญชีของคุณบนระบบ Tutor PWA</li>
              <li>
                อำนวยความสะดวกในการจัดคลาสเรียน
                และการติดต่อกับนักเรียน/ผู้ปกครอง
              </li>
              <li>
                คำนวณรายได้ คำนวณภาษีหัก ณ ที่จ่าย ประมวลผลและชำระค่าตอบแทน
              </li>
              <li>
                ตรวจสอบ ติดตาม แจ้งเตือน และป้องกันกิจกรรมที่อาจผิดปกติต้องสงสัย
              </li>
              <li>
                ส่งอีเมลหรือข้อความเกี่ยวกับการอัปเดตระบบ
                หรือประกาศสำคัญนโยบายบริษัท
              </li>
            </ul>

            <h2>3. การเปิดเผยข้อมูลสู่บุคคลที่สาม</h2>
            <p>เราอาจแชร์ข้อมูลของท่านเมื่อมีความจำเป็นแก่ส่วนงานต่อไปนี้:</p>
            <ul>
              <li>
                <strong>บริการตัวกลางธุรกรรมการเงิน (Payment Gateways)</strong>{" "}
                เพื่อประมวลผลการจ่ายเงินเข้าสู่บัญชีของคุณ
              </li>
              <li>
                <strong>บุคลากรภายในระดับแอดมิน (Admin Console)</strong>
                ที่ดูแลการจัดการรายได้ คลาสเรียน และโบนัสเครือข่าย
                เพื่ออำนวยความสะดวกในการปฏิบัติงานตามปรกติ
              </li>
              <li>
                <strong>หน่วยงานบังคับใช้กฎหมาย:</strong> เช่น กรมสรรพากร
                หากมีการร้องขอตามกฎหมายที่บังคับใช้
              </li>
            </ul>
            <p>
              เราจะไม่มีการนำข้อมูลส่วนบุคคลไปขายให้กับบุคคลภายนอกโดยเด็ดขาด
            </p>

            <h2>4. สิทธิ์ของคุณ</h2>
            <p>
              ภายใต้เงื่อนไขกฎหมายและประกาศกระทรวงสาธารณสุขหรือกฎหมายข้อมูลส่วนบุคคลของไทย
              (PDPA) ท่านมีสิทธิ์ในการ:
            </p>
            <ol>
              <li>
                การเข้าถึงข้อมูลและขอสำเนารายละเอียดเกี่ยวกับข้อมูลส่วนตัวของคุณในระบบ
              </li>
              <li>
                แก้ไขข้อมูลที่ไม่ถูกต้อง ไม่สมบูรณ์
                หรือล้าหลังได้โดยตรงบนแถบตั้งค่าโปรไฟล์
              </li>
              <li>
                ขอลบ ทำลายข้อมูลของคุณ ในกรณีที่สิ้นสุดสัญญากับทางบริษัท
                และหลังจากระยะเวลาภาษีบังคับ
              </li>
            </ol>

            <h2>5. ความปลอดภัยของข้อมูล</h2>
            <p>
              เรารักษาความปลอดภัยข้อมูลของคุณในระบบเซิร์ฟเวอร์คลาวด์มาตรฐานและใช้ช่องทางการติดต่อที่เข้ารหัส
              (TLS/SSL) เพื่อลดความเสี่ยงจากการเข้าถึงโดยไม่ได้รับอนุญาต
              ถึงกระนั้นผู้ใช้งานก็มีหน้าที่ดูแลเก็บรักษารหัสผ่านของตนเองให้ปลอดภัย
            </p>

            <h2>6. การติดต่อเรา</h2>
            <p>
              หากคุณมีคำถามใดๆ
              หรือมีข้อกังวลเพิ่มเติมเกี่ยวกับนโยบายความเป็นส่วนตัวของเรา
              ท่านสามารถติดต่อฝ่าย สนับสนุน (Support) ได้ที่:
            </p>
            <p className="mt-4 font-semibold text-primary">
              LINE: @readingadvantage <br />
              หัวข้อ: คำร้องขอ PDPA / นโยบายความเป็นส่วนตัว (Tutor PWA)
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
