"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, AlertCircle, Lock } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const ROLE_DESCRIPTIONS: Record<
  string,
  { label: string; description: string; access: string[] }
> = {
  ADMIN: {
    label: "ผู้ดูแลระบบสูงสุด (Super Admin)",
    description: "เข้าถึงได้ทุกส่วนของระบบ พร้อมอำนาจในการตรวจสอบทั้งหมด",
    access: [
      "ดูภาพรวมแผงควบคุม (Dashboard Overview)",
      "จัดการและอนุมัติรอบบิล (Settlement Management)",
      "จัดการบัญชีผู้ใช้งาน (User & Tutor Management)",
      "ตรวจสอบประวัติการทำรายการ (Finance Audit Log)",
    ],
  },
  FINANCE_CHECKER: {
    label: "ผู้ตรวจสอบการเงิน (Finance Checker)",
    description: "มีสิทธิ์อ่านข้อมูลเพื่อตรวจสอบรอบบิลและดูประวัติเท่านั้น",
    access: [
      "ตรวจสอบรอบบิล (Settlement Review)",
      "ดูประวัติการจ่ายเงิน (Payout Audit Trail)",
      "ตรวจสอบที่มาของค่าคอมมิชชัน (Commission Traceability)",
    ],
  },
};

export default function LoginPage() {
  const [role, setRole] = useState("ADMIN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("admin_role", data.role);

      router.push("/");
    } catch (error) {
      const err = error as Error;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedRole = ROLE_DESCRIPTIONS[role];

  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(to right, currentColor 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Reused ThemeToggle component */}
      <ThemeToggle className="absolute top-4 right-4 text-muted-foreground hover:text-foreground" />

      <div className="relative z-10 w-full max-w-sm sm:max-w-md flex flex-col items-center gap-6 sm:gap-8">
        {/* Branding */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Tutor Advantage
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Admin Console
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-xs font-medium px-3 py-1"
          >
            โหมดนักพัฒนา / ตรวจสอบ (Dev/Audit Mode)
          </Badge>
        </div>

        {/* Login Card */}
        <Card className="w-full shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              เข้าสู่ระบบ (Sign In)
            </CardTitle>
            <CardDescription>
              เลือกบทบาทแอดมินของคุณเพื่อสร้าง JWT Token
              จำกัดสิทธิ์สำหรับการทดสอบในเซสชันนี้
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 sm:space-y-5">
              <div className="space-y-2">
                <Label htmlFor="role">บทบาทของแอดมิน</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger id="role" className="w-full">
                    <SelectValue placeholder="เลือกบทบาท" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Super Admin (ADMIN)</SelectItem>
                    <SelectItem value="FINANCE_CHECKER">
                      Finance Checker (FINANCE_CHECKER)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Role Description Panel */}
              {selectedRole && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 sm:p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="font-semibold text-primary">
                      {selectedRole.label}
                    </span>
                    <span className="text-muted-foreground text-xs">—</span>
                    <span className="text-muted-foreground text-xs">
                      {selectedRole.description}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {selectedRole.access.map((item: string) => (
                      <li
                        key={item}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <span className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </CardContent>

            <CardFooter className="pt-2 flex flex-col gap-3">
              <Button
                type="submit"
                disabled={loading}
                className="w-full font-medium"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    กำลังเข้าสู่ระบบ…
                  </span>
                ) : (
                  "เข้าสู่ระบบด้วย Mock JWT"
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                Token จะถูกจำกัดสิทธิ์ตามบทบาทที่เลือก
                ทุกการทำรายการทางการเงินจะถูกบันทึกและสามารถตรวจสอบย้อนหลังได้เสมอ
              </p>
              <p className="text-xs text-muted-foreground/60 text-center leading-relaxed border-t border-border pt-3">
                การกดเข้าสู่ระบบถือเป็นการรับทราบว่าทุกการกระทำในแผงควบคุมนี้จะถูกเก็บ
                Log เพื่อนำไป Audit อย่างถาวร
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
