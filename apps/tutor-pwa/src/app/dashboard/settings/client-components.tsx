"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LogOut, Save, X, ChevronRight, Bell, Wallet, MapPin, Moon, Sun, TrendingUp } from "lucide-react";
import { useState, useEffect, useTransition } from "react";
import { useTheme } from "next-themes";
import { updateSettingsAction } from "../actions";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export function SettingsInteractiveElements({ type }: { type: string }) {
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
    return <ThemeToggleRow />;
  }

  if (type === "logoutSection") {
    const handleLogout = () => {
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

function ThemeToggleRow() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = theme === "dark";

  return (
    <div className="flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
          {(!mounted || !isDark) ? <Sun className="h-5 w-5 text-indigo-500" /> : <Moon className="h-5 w-5 text-indigo-500" />}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            ลักษณะที่ปรากฏ (Theme)
          </p>
          <p className="text-xs text-muted-foreground">สลับโหมดสว่าง/มืด</p>
        </div>
      </div>
      <div>
        {mounted && (
          <Switch 
            checked={isDark} 
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} 
          />
        )}
      </div>
    </div>
  );
}

const iconMap: Record<string, any> = { Bell, Wallet, MapPin, TrendingUp };

export function EditableSettingToggle({ title, description, iconName, value, settingKey, iconBgClass, iconColorClass }: any) {
  const Icon = iconMap[iconName] || Bell;
  const [isPending, startTransition] = useTransition();
  const [checked, setChecked] = useState(value === true);

  const handleToggle = (newVal: boolean) => {
    setChecked(newVal);
    startTransition(async () => {
      try {
        await updateSettingsAction({ [settingKey]: newVal });
      } catch (e) {
        setChecked(!newVal); // revert
      }
    });
  };

  return (
    <div className="flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${iconBgClass} flex items-center justify-center shrink-0`}>
          <Icon className={`h-5 w-5 ${iconColorClass}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div>
        <Switch checked={checked} onCheckedChange={handleToggle} disabled={isPending} />
      </div>
    </div>
  );
}

export function EditableSettingText({ title, description, iconName, value, settingKey, iconBgClass, iconColorClass, placeholder }: any) {
  const Icon = iconMap[iconName] || MapPin;
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(value || "");

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateSettingsAction({ [settingKey]: text });
        setIsEditing(false);
      } catch (e) {
        console.error(e);
      }
    });
  };

  if (isEditing) {
    return (
      <div className="p-4 sm:p-5 bg-muted/10 transition-colors">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-lg ${iconBgClass} flex items-center justify-center shrink-0`}>
            <Icon className={`h-5 w-5 ${iconColorClass}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            placeholder={placeholder}
            disabled={isPending}
            className="flex-1"
          />
          <Button size="icon" variant="ghost" onClick={() => setIsEditing(false)} disabled={isPending}>
            <X className="h-4 w-4" />
          </Button>
          <Button size="icon" onClick={handleSave} disabled={isPending}>
            <Save className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-colors group cursor-pointer"
      onClick={() => setIsEditing(true)}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${iconBgClass} flex items-center justify-center shrink-0`}>
          <Icon className={`h-5 w-5 ${iconColorClass}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{text || description}</p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
    </div>
  );
}
