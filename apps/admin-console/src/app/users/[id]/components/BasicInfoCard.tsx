import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { User as UserIcon } from "lucide-react";
import { UserDetail } from "../types";

interface BasicInfoCardProps {
  user: UserDetail;
}

export function BasicInfoCard({ user }: BasicInfoCardProps) {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-card">
      <CardHeader className="pb-3 px-5 pt-5">
        <CardTitle className="text-sm font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
          <UserIcon className="h-4 w-4" />
          ข้อมูลพื้นฐาน
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-3">
        {[
          {
            label: "User ID",
            value: (
              <span className="font-mono text-xs break-all">
                {user.id}
              </span>
            ),
          },
          { label: "ชื่อ-นามสกุล", value: user.name },
          { label: "อีเมล", value: user.email },
          { label: "เบอร์โทรศัพท์", value: user.phone || "—" },
          {
            label: "บทบาท",
            value: user.role === "TUTOR" ? "ติวเตอร์" : "นักเรียน",
          },
          {
            label: "สถานะบัญชี",
            value: user.status === "ACTIVE" ? "ใช้งานอยู่" : "ถูกระงับ",
          },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            <p className="text-sm font-medium text-foreground mt-0.5">
              {value}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
