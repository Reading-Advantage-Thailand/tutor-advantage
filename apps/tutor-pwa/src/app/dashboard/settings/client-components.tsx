"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LogOut, Save, X, ChevronRight, Bell, Wallet, MapPin, Moon, Sun, TrendingUp, Volume2, VolumeX } from "lucide-react";
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

  if (type === "soundToggleRow") {
    return <SoundToggleRow />;
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

function SoundToggleRow() {
  const [isMuted, setIsMuted] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setIsMuted(localStorage.getItem("app-notif-muted") === "true");
    }
  }, []);

  const toggleMute = (checked: boolean) => {
    const mute = !checked; // checked = true means NOT muted
    setIsMuted(mute);
    localStorage.setItem("app-notif-muted", String(mute));
  };

  return (
    <div className="flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
          {isMuted ? <VolumeX className="h-5 w-5 text-emerald-500" /> : <Volume2 className="h-5 w-5 text-emerald-500" />}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            เสียงแจ้งเตือนแอพ
          </p>
          <p className="text-xs text-muted-foreground">เปิด/ปิดเสียงเมื่อมีข้อความเข้า</p>
        </div>
      </div>
      <div>
        {mounted && (
          <Switch 
            checked={!isMuted} 
            onCheckedChange={toggleMute} 
          />
        )}
      </div>
    </div>
  );
}

function ThemeToggleRow() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Use resolvedTheme to correctly identify active theme even when set to 'system'
  const isDark = mounted ? resolvedTheme === "dark" : false;

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

  // Sync state if prop changes externally
  useEffect(() => {
    setChecked(value === true);
  }, [value]);

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
  const [inputValue, setInputValue] = useState(value || "");

  // Sync from external value prop
  useEffect(() => {
    const currentVal = value || "";
    setText(currentVal);
    if (!isEditing) {
      setInputValue(currentVal);
    }
  }, [value, isEditing]);

  const handleStartEditing = () => {
    setInputValue(text);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setInputValue(text);
    setIsEditing(false);
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        // Optimistic update locally
        const newText = inputValue.trim();
        setText(newText);
        await updateSettingsAction({ [settingKey]: newText });
        setIsEditing(false);
      } catch (e) {
        console.error(e);
        // If failed, it will eventually re-sync from server props via useEffect
        // For immediate UX, we keep input open or could show toast.
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
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)} 
            placeholder={placeholder}
            disabled={isPending}
            className="flex-1"
            autoFocus
          />
          <Button size="icon" variant="ghost" onClick={handleCancel} disabled={isPending}>
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
      onClick={handleStartEditing}
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
