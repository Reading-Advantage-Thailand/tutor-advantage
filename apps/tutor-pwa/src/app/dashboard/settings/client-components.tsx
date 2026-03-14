"use client";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function SettingsInteractiveElements({ type }: { type: string }) {
  const router = useRouter();

  if (type === "editProfileButton") {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full sm:w-auto mt-2 sm:mt-0"
      >
        แก้ไขโปรไฟล์
      </Button>
    );
  }

  if (type === "themeToggleRow") {
    return (
      <div className="flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
            <div className="text-indigo-500">
              <ThemeToggle className="hover:bg-transparent" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              ลักษณะที่ปรากฏ (Theme)
            </p>
            <p className="text-xs text-muted-foreground">สลับโหมดสว่าง/มืด</p>
          </div>
        </div>
      </div>
    );
  }

  if (type === "logoutSection") {
    const handleLogout = () => {
      // Redirect to the server-side logout route which will clear the httpOnly cookie
      window.location.href = "/api/auth/logout";
    };

    return (
      <div className="pt-4 pb-8 flex justify-center">
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 w-full sm:w-auto"
        >
          <LogOut className="w-4 h-4" />
          ออกจากระบบ
        </Button>
      </div>
    );
  }

  return null;
}
