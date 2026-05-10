"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Bell, MessageSquare, BookOpen, Trophy, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useLiff } from "@/components/providers/LiffProvider";
import { studentApi } from "@/lib/api";

// A custom toggle component for modern look
const Toggle = ({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    style={{
      position: "relative",
      display: "inline-flex",
      height: "24px",
      width: "44px",
      flexShrink: 0,
      cursor: disabled ? "not-allowed" : "pointer",
      borderRadius: "9999px",
      border: "2px solid transparent",
      transition: "background-color 200ms ease-in-out",
      backgroundColor: checked ? "var(--brand-500)" : "var(--neutral-200)",
      opacity: disabled ? 0.6 : 1,
      outline: "none",
    }}
  >
    <span
      style={{
        pointerEvents: "none",
        display: "inline-block",
        height: "20px",
        width: "20px",
        transform: checked ? "translateX(20px)" : "translateX(0px)",
        borderRadius: "9999px",
        backgroundColor: "white",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
        transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    />
  </button>
);

export default function NotificationsPage() {
  const { isReady, profile } = useLiff();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle'|'success'|'error'>('idle');

  // Notification Settings State
  const [settings, setSettings] = useState({
    notifyClassReminders: true,
    notifyScoreUpdates: true,
    notifyLineMessages: true,
    notifyMarketing: false,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!isReady) return;
      try {
        const response = await studentApi.getSettings();
        // Safe load server side structure, default fallback to current local settings
        if (response && response.settings) {
          const serverSettings = response.settings.notifications || {};
          setSettings(prev => ({
            ...prev,
            ...serverSettings
          }));
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [isReady]);

  const updateSetting = (key: keyof typeof settings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      await studentApi.updateSettings({
        notifications: settings
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  if (!isReady || loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-bg)" }}>
        <Loader2 className="animate-spin" style={{ width: 32, height: 32, color: "var(--brand-500)" }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface-bg)", color: "var(--text-primary)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header 
        style={{ 
          position: "sticky", 
          top: 0, 
          zIndex: 50, 
          width: "100%", 
          borderBottom: "1px solid var(--surface-border)", 
          background: "var(--surface-card-trans)", 
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)"
        }}
      >
        <div style={{ maxWidth: "768px", margin: "0 auto", display: "flex", height: "56px", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
          <Link
            href="/profile"
            style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none" }}
          >
            <ChevronLeft size={18} />
            <span>โปรไฟล์</span>
          </Link>
          <ThemeToggle size={16} />
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, maxWidth: "768px", margin: "0 auto", width: "100%", padding: "24px 16px 80px" }}>
        
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
          <div style={{ 
            width: "48px", 
            height: "48px", 
            borderRadius: "14px", 
            background: "var(--accent-blue-light)", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            color: "var(--accent-blue)"
          }}>
            <Bell size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "2px" }}>
              การแจ้งเตือน
            </h1>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
              ตั้งค่าวิธีที่คุณต้องการรับข่าวสาร
            </p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Connected Status Info */}
          <div style={{ 
            padding: "16px", 
            background: "rgba(6, 199, 85, 0.05)", 
            borderRadius: "16px", 
            border: "1px solid rgba(6, 199, 85, 0.15)", 
            display: "flex", 
            gap: "14px", 
            alignItems: "center" 
          }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#06C755", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <MessageSquare size={20} color="white" />
            </div>
            <div>
              <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "2px" }}>
                เชื่อมต่อกับ LINE เรียบร้อย
              </p>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                ส่งข้อความผ่าน LINE OA (Push Message)
              </p>
            </div>
            <CheckCircle2 size={20} style={{ marginLeft: "auto", color: "#06C755" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <h3 style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", paddingLeft: "4px" }}>
              ช่องทางการเรียน
            </h3>
            
            <Card className="glass-card overflow-hidden">
              <div style={{ display: "flex", flexDirection: "column" }}>
                
                {/* Reminders Toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--accent-purple-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--accent-purple)" }}>
                    <BookOpen size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--text-primary)" }}>เตือนคาบเรียน</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>แจ้งเตือนก่อนเริ่มคลาส 15 นาที</p>
                  </div>
                  <Toggle checked={settings.notifyClassReminders} onChange={(v) => updateSetting('notifyClassReminders', v)} />
                </div>

                <Separator style={{ background: "var(--surface-border)" }} />

                {/* Scores Toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--accent-amber-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--accent-amber)" }}>
                    <Trophy size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--text-primary)" }}>สรุปคะแนนหลังเรียน</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>แจ้งผลสรุปและรางวัลหลังจบคลาส</p>
                  </div>
                  <Toggle checked={settings.notifyScoreUpdates} onChange={(v) => updateSetting('notifyScoreUpdates', v)} />
                </div>

              </div>
            </Card>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <h3 style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", paddingLeft: "4px" }}>
              การตลาดและข่าวสาร
            </h3>
            
            <Card className="glass-card overflow-hidden">
              <div style={{ display: "flex", flexDirection: "column" }}>
                
                <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--brand-600)" }}>
                    <AlertCircle size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--text-primary)" }}>ข้อเสนอและส่วนลด</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>รับข่าวสารโปรโมชั่นคอร์สเรียนใหม่</p>
                  </div>
                  <Toggle checked={settings.notifyMarketing} onChange={(v) => updateSetting('notifyMarketing', v)} />
                </div>

              </div>
            </Card>
          </div>

          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {saveStatus === 'success' && (
              <div style={{ textAlign: "center", color: "#059669", fontSize: "0.875rem", fontWeight: 600, animation: "fadeIn 0.3s" }}>
                ✓ บันทึกการตั้งค่าเรียบร้อยแล้ว
              </div>
            )}
            {saveStatus === 'error' && (
              <div style={{ textAlign: "center", color: "#ef4444", fontSize: "0.875rem", fontWeight: 600 }}>
                ✖ ไม่สามารถบันทึกข้อมูลได้ โปรดลองอีกครั้ง
              </div>
            )}

            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="h-12 w-full rounded-xl text-base font-bold"
              style={{
                background: "var(--text-primary)",
                color: "var(--surface-bg)",
                marginTop: "10px"
              }}
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={18} />
                  กำลังบันทึก...
                </>
              ) : "บันทึกการตั้งค่า"}
            </Button>
          </div>

          <div style={{ padding: "16px", marginTop: "20px", borderRadius: "16px", background: "var(--surface-card)", border: "1px solid var(--surface-border)", textAlign: "center" }}>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              <strong>💡 เกร็ดความรู้ LINE LIFF:</strong> การเปิดใช้งานการแจ้งเตือนจะอนุญาตให้ระบบส่งข้อความ Direct Message เข้าหาคุณโดยตรงผ่าน LINE Official Account แม้จะไม่ได้เปิดแอปพลิเคชันอยู่
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
