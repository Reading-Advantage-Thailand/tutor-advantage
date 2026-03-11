import { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ - Tutor PWA",
  description: "เข้าสู่ระบบสำหรับครูผู้สอน Tutor Advantage",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col lg:grid lg:grid-cols-2">
      {/* Brand Hero Panel */}
      <div className="relative flex flex-col bg-sidebar text-sidebar-foreground p-6 lg:p-10 shrink-0">
        {/* Decorative gradient circle */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-64 h-64 rounded-full bg-primary/10 blur-2xl" />
        </div>

        {/* Top Bar with Logo & Theme Toggle (Mobile + Desktop) */}
        <div className="relative flex items-center justify-between mb-8 lg:mb-auto">
          <div className="flex items-center gap-3">
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
          {/* Theme toggle directly in the hero for both mobile and desktop */}
          <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-accent" />
        </div>

        {/* Main copy */}
        <div className="relative flex-1 flex flex-col justify-center max-w-sm mt-4 lg:mt-0">
          <h2 className="text-2xl lg:text-3xl font-bold text-sidebar-foreground leading-snug mb-3 lg:mb-4">
            สอนอย่างมืออาชีพ
            <br />
            <span className="text-primary">รายได้มั่นคงและโปร่งใส</span>
          </h2>
          <ul className="space-y-2 lg:space-y-3 text-sm text-sidebar-foreground/70 hidden sm:block">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-primary">✓</span>
              แผนการสอน 15 ขั้นตอนพร้อมใช้ทันที
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-primary">✓</span>
              ระบบคำนวณรายได้และโบนัสเครือข่ายชัดเจน คุยสอบได้ทุกบาท
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-primary">✓</span>
              สร้าง QR Referral ใน 10 วินาที แชร์ให้ผู้ปกครองสมัครทันที
            </li>
          </ul>
        </div>

        {/* Footer quote - hidden on smaller than sm to save space */}
        <p className="relative hidden sm:block text-xs text-sidebar-foreground/40 mt-8 lg:mt-auto">
          &ldquo;ราคา การลงทะเบียน และคอมมิชชั่น — โปร่งใสทุกขั้นตอน&rdquo;
        </p>
      </div>

      {/* Login Form Panel */}
      <div className="flex-1 flex flex-col bg-background relative rounded-t-3xl -mt-6 lg:mt-0 lg:rounded-none overflow-hidden shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] lg:shadow-none">
        {/* Helper spacing for desktop since top bar was moved */}
        <div className="hidden lg:block py-6"></div>
        
        {/* Form area */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-8 pt-10 lg:pt-8 relative z-10 bg-background">
          <div className="w-full max-w-sm space-y-6">
            <div className="space-y-1 text-center lg:text-left">
              <h1 className="text-2xl font-bold text-foreground">
                เข้าสู่ระบบ
              </h1>
              <p className="text-sm text-muted-foreground">
                ยินดีต้อนรับกลับเพื่อจัดการคลาสเรียนของคุณ
              </p>
            </div>

            <LoginForm />

            <p className="text-center text-xs text-muted-foreground mt-8">
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
