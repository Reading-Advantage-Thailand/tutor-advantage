import { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ - Tutor PWA",
  description: "เข้าสู่ระบบสำหรับครูผู้สอน Tutor Advantage",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      {/* Left panel — brand hero, desktop only */}
      <div className="relative hidden lg:flex flex-col bg-sidebar text-sidebar-foreground p-10">
        {/* Decorative gradient circle */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-64 h-64 rounded-full bg-primary/10 blur-2xl" />
        </div>
        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center font-bold text-sm text-primary-foreground">
            TA
          </div>
          <div>
            <p className="font-bold text-base text-sidebar-foreground">
              Tutor Advantage
            </p>
            <p className="text-xs text-sidebar-foreground/50">
              ระบบจัดการครูผู้สอน
            </p>
          </div>
        </div>
        {/* Main copy */}
        <div className="relative flex-1 flex flex-col justify-center max-w-sm">
          <h2 className="text-3xl font-bold text-sidebar-foreground leading-snug mb-4">
            สอนอย่างมืออาชีพ
            <br />
            <span className="text-primary">รายได้มั่นคงและโปร่งใส</span>
          </h2>
          <ul className="space-y-3 text-sm text-sidebar-foreground/70">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-primary">✓</span>
              แผนการสอน 15 ขั้นตอนพร้อมใช้ทันที
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-primary">✓</span>
              ระบบคำนวณรายได้และโบนัสเครือข่ายชัดเจน ตรวจสอบได้ทุกบาท
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-primary">✓</span>
              สร้าง QR Referral ใน 10 วินาที แชร์ให้ผู้ปกครองสมัครทันที
            </li>
          </ul>
        </div>
        {/* Footer quote */}
        <p className="relative text-xs text-sidebar-foreground/40 mt-auto">
          &ldquo;ราคา การลงทะเบียน และคอมมิชชั่น — โปร่งใสทุกขั้นตอน&rdquo;
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex flex-col min-h-screen lg:min-h-0">
        {/* Top bar — mobile only */}
        <div className="lg:hidden flex items-center justify-between px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center font-bold text-xs text-primary-foreground">
              TA
            </div>
            <span className="font-semibold text-sm">Tutor Advantage</span>
          </div>
          <ThemeToggle className="text-foreground hover:bg-muted" />
        </div>
        {/* Form area */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-sm space-y-6">
            <div className="space-y-1 text-center">
              <h1 className="text-2xl font-bold text-foreground">
                ยินดีต้อนรับกลับ
              </h1>
              <p className="text-sm text-muted-foreground">
                เข้าสู่ระบบบัญชีครูผู้สอนเพื่อจัดการคลาสเรียน
              </p>
            </div>

            <LoginForm />

            <p className="text-center text-xs text-muted-foreground">
              การเข้าสู่ระบบหมายความว่าคุณยอมรับ{" "}
              <a
                href="/terms"
                className="underline underline-offset-4 hover:text-foreground transition-colors"
              >
                ข้อตกลงการให้บริการ
              </a>{" "}
              และ{" "}
              <a
                href="/privacy"
                className="underline underline-offset-4 hover:text-foreground transition-colors"
              >
                นโยบายความเป็นส่วนตัว
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
