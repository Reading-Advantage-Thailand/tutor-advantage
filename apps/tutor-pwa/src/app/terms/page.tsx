import { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export const metadata: Metadata = {
  title: "ข้อตกลงการให้บริการ (Terms of Service) - Tutor PWA",
  description: "ข้อตกลงและเงื่อนไขการใช้บริการระบบจัดการครูผู้สอน Tutor Advantage",
};

export default function TermsPage() {
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
            <h1 className="text-3xl font-bold tracking-tight mb-2">ข้อตกลงการให้บริการ</h1>
            <p className="text-muted-foreground">
              ปรับปรุงล่าสุด: 11 มีนาคม 2026
            </p>
          </div>

          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p className="lead">
              ยินดีต้อนรับสู่ Tutor Advantage ข้อตกลงการให้บริการนี้ ("ข้อตกลง") 
              เป็นสัญญาระหว่างคุณ ("ครูผู้สอน" หรือ "ผู้ใช้งาน") และระบบจัดการครูผู้สอน 
              Tutor Advantage ("เรา" หรือ "แพลตฟอร์ม")
            </p>

            <h2>1. การยอมรับข้อตกลง</h2>
            <p>
              โดยการเข้าถึงหรือใช้งานแอปพลิเคชัน Tutor PWA 
              รวมถึงการสร้างบัญชีและการใช้บริการต่างๆ ของเรา 
              คุณตกลงที่จะปฏิบัติตามและผูกพันตามข้อตกลงนี้ทุกประการ 
              หากคุณไม่เห็นด้วยกับส่วนใดส่วนหนึ่งของข้อตกลงนี้ 
              โปรดงดเว้นการใช้งานแพลตฟอร์มของเรา
            </p>

            <h2>2. ขอบเขตบริการ</h2>
            <p>
              Tutor Advantage ให้บริการระบบเครื่องมือสำหรับครูผู้สอน รวมถึงแต่ไม่จำกัดเพียง:
            </p>
            <ul>
              <li>การจัดการคลาสเรียนและรายชื่อนักเรียน</li>
              <li>การเข้าถึงแผนการสอนและสื่อประกอบการสอน (origins, quests, ฯลฯ)</li>
              <li>ระบบคำนวณรายได้ คอมมิชชั่น และโบนัสเครือข่าย</li>
              <li>การสร้างลิงก์และ QR Code แนะนำ (Referral) เพื่อเชิญนักเรียน</li>
            </ul>

            <h2>3. บัญชีผู้ใช้และความปลอดภัย</h2>
            <ol>
              <li>การสร้างบัญชีจะต้องใช้ข้อมูลที่เป็นความจริงและเป็นปัจจุบัน</li>
              <li>คุณมีหน้าที่รับผิดชอบแต่เพียงผู้เดียวในการรักษาความลับของรหัสผ่านและข้อมูลบัญชีของคุณ</li>
              <li>การกระทำใดๆ ที่เกิดขึ้นภายใต้บัญชีของคุณ ถือเป็นความรับผิดชอบของคุณเอง</li>
              <li>หากสงสัยว่ามีการเข้าถึงบัญชีโดยไม่ได้รับอนุญาต ต้องแจ้งให้เราทราบทันที</li>
            </ol>

            <h2>4. นโยบายค่าตอบแทนและคอมมิชชั่น</h2>
            <p>
              เรามุ่งมั่นในความโปร่งใสเรื่องผลตอบแทน นโยบายดังต่อไปนี้จะบังคับใช้:
            </p>
            <ul>
              <li>
                <strong>รายได้จากการสอน:</strong> คำนวณเป็นเปอร์เซ็นต์ (ตามเรทคอมมิชชั่นของคุณ)
                จากค่าลงทะเบียนของนักเรียนในคลาสที่คุณเป็นผู้สอน
              </li>
              <li>
                <strong>โบนัสทีม/เครือข่าย:</strong> คุณอาจได้รับโบนัสส่วนต่าง (Roll-up bonus) 
                จากลูกข่ายหรือนักเรียนที่สมัครผ่านลิงก์แนะนำของคุณ ตามโครงสร้างที่กำหนดในคู่มือบริษัท
              </li>
              <li>
                <strong>การปรับลดยอด (Clawback):</strong> ในกรณีที่นักเรียนมีการยกเลิก 
                ขอเงินคืน (Refund) หรือการชำระเงินถูกปฏิเสธ 
                ระบบจะทำการหักค่าคอมมิชชั่นส่วนนั้นคืนจากการจ่ายเงินในรอบถัดไป
              </li>
              <li>
                การคำนวณและประมวลผลการจ่ายเงินจะกระทำเป็นรายเดือน 
                หรือตามรอบบิลที่ระบุไว้ในหน้า "รายได้" ของคุณ
              </li>
            </ul>

            <h2>5. หน้าที่ของผู้สอน</h2>
            <p>คุณตกลงที่จะ:</p>
            <ul>
              <li>ดำเนินการสอนอย่างเป็นมืออาชีพและตรงต่อเวลา</li>
              <li>ใช้เนื้อหาและแผนการสอนของ Tutor Advantage ตามวัตถุประสงค์ที่กำหนดเท่านั้น</li>
              <li>ไม่เผยแพร่ แจกจ่าย หรือทำซ้ำเนื้อหาอันมีลิขสิทธิ์ของบริษัทให้แก่บุคคลภายนอกโดยไม่ได้รับอนุญาต</li>
              <li>ไม่กระทำการใดๆ ที่อาจทำให้เสื่อมเสียชื่อเสียงของแพลตฟอร์ม</li>
            </ul>

            <h2>6. การระงับและการยกเลิกบัญชี</h2>
            <p>
              เราสงวนสิทธิ์ในการระงับหรือยกเลิกบัญชีผู้ใช้ของคุณเมื่อใดก็ได้ โดยไม่ต้องแจ้งให้ทราบล่วงหน้า 
              หากพบว่ามีการละเมิดข้อตกลงใดๆ ในที่นี้ หรือกระทำการทุจริตในระบบ
            </p>

            <h2>7. การเปลี่ยนแปลงข้อตกลง</h2>
            <p>
              เราอาจปรับปรุงหรือเปลี่ยนแปลงข้อตกลงนี้เป็นระยะ 
              การแก้ไขจะมีผลทันทีที่ประกาศบนแพลตฟอร์ม 
              การใช้งานอย่างต่อเนื่องของคุณจะถือเป็นการยอมรับข้อตกลงฉบับปรับปรุง
            </p>

            <div className="mt-12 py-6 border-t text-sm text-muted-foreground text-center">
              <p>หากมีข้อสงสัยเกี่ยวกับข้อตกลงนี้ กรุณาติดต่อ LINE @readingadvantage</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
