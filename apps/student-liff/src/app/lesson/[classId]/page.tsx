"use client";

import React, { useState, useEffect, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Users, CheckCircle2, Loader2, AlertCircle, Play, ShieldCheck, Bell } from "lucide-react";
import { studentApi } from "@/lib/api";
import { useLiff } from "@/components/providers/LiffProvider";
import { useLessonSocket } from "@/hooks/useLessonSocket";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { playSound } from "@/lib/sounds";

interface PageProps {
  params: Promise<{ classId: string }>;
}

interface ClassInfo {
  name?: string;
  tutor?: {
    name?: string;
  };
  isEnrolled?: boolean;
  enrollmentStatus?: string | null;
}

export default function LessonLobbyPage({ params }: PageProps) {
  const { classId } = use(params);
  const router = useRouter();
  const { profile, isReady: liffReady } = useLiff();
  
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [fetchingClass, setFetchingClass] = useState(true);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);

  const studentId = profile?.userId || "";
  const studentName = profile?.displayName || "Student";
  const pictureUrl = profile?.pictureUrl;

  // Use socket for lobby
  const {
    sessionData,
    participants,
    error,
    toggleReady,
    nudgeMessage,
    kicked
  } = useLessonSocket(classInfo?.isEnrolled ? classId : undefined, studentId, studentName, pictureUrl);

  useEffect(() => {
    if (liffReady && classId) {
      studentApi.getClassDetails(classId)
        .then(data => {
          if (!data.class?.isEnrolled || data.class?.enrollmentStatus !== "ACTIVE") {
            setAccessDenied(t("lessonLobby.paymentRequired"));
            setClassInfo(data.class);
            setFetchingClass(false);
            return;
          }
          setClassInfo(data.class);
          setFetchingClass(false);
        })
        .catch(err => {
          console.error("Failed to fetch class info:", err);
          setFetchingClass(false);
        });
    }
  }, [liffReady, classId]);

  // Handle auto-redirect when phase changes (Lesson Starts)
  useEffect(() => {
    if (sessionData && sessionData.currentPhase > 0) {
      router.push(`/interactive/play?classId=${classId}&studentName=${studentName}`);
    }
  }, [sessionData, router, classId, studentName]);

  // Play sound when nudge arrives
  useEffect(() => {
    if (nudgeMessage) {
      playSound('nudged');
    }
  }, [nudgeMessage]);

  if (!liffReady || fetchingClass) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface-bg)",
          padding: "max(24px, var(--safe-top)) 24px max(24px, var(--safe-bottom))",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 280,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: 24,
            borderRadius: 20,
            background: "var(--surface-card)",
            border: "1px solid var(--surface-border)",
            boxShadow: "var(--shadow-sm)",
            textAlign: "center",
          }}
        >
          <Loader2 className="animate-spin" size={36} style={{ color: "var(--brand-500)" }} />
          <p style={{ color: "var(--text-primary)", fontSize: "0.875rem", fontWeight: 800 }}>{t("lessonLobby.preparingTitle")}</p>
          <p style={{ color: "var(--text-tertiary)", fontSize: "0.75rem", lineHeight: 1.5 }}>{t("lessonLobby.preparingDescription")}</p>
        </div>
      </div>
    );
  }

  if (kicked) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--surface-bg)", padding: 24, textAlign: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: 30, background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
           <AlertCircle size={40} style={{ color: "#ef4444" }} />
        </div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 12 }}>{kicked}</h2>
        <p style={{ color: "var(--text-tertiary)", marginBottom: 32 }}>{t("lessonLobby.contactTutorIfMistake")}</p>
        <Link href="/dashboard" className="btn btn-secondary btn-lg btn-full" style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>{t("lessonLobby.backHome")}</Link>
      </div>
    );
  }

  if (!classInfo) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--surface-bg)", padding: 24, textAlign: "center" }}>
        <AlertCircle size={48} style={{ color: "var(--accent-red)", marginBottom: 16 }} />
        <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>{t("lessonLobby.classNotFoundTitle")}</h2>
        <p style={{ color: "var(--text-tertiary)", marginBottom: 24 }}>{t("lessonLobby.classNotFoundDescription")}</p>
        <Link href="/dashboard" className="btn btn-primary" style={{ padding: "0 24px", height: 48, borderRadius: 12 }}>{t("lessonLobby.backHome")}</Link>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--surface-bg)", padding: 24, textAlign: "center" }}>
        <AlertCircle size={48} style={{ color: "var(--accent-red)", marginBottom: 16 }} />
        <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>{accessDenied}</h2>
        <p style={{ color: "var(--text-tertiary)", marginBottom: 24 }}>{t("lessonLobby.enrollmentInactive")}</p>
        <Link href={`/payment?classId=${classId}`} className="btn btn-primary" style={{ padding: "0 24px", height: 48, borderRadius: 12 }}>{t("lessonLobby.goPayment")}</Link>
      </div>
    );
  }

  const myParticipant = participants.find(p => p.studentId === studentId);
  const isReady = myParticipant?.isReady || false;
  const readyCount = participants.filter(p => p.isReady).length;

  return (
    <div className="page-shell" style={{ background: "var(--surface-bg)", minHeight: "100dvh" }}>
      {/* Nudge Alert */}
      {nudgeMessage && (
        <div style={{
          position: "fixed", top: 72, left: 16, right: 16, zIndex: 200,
          background: "linear-gradient(135deg, #f97316 0%, #ef4444 100%)",
          color: "#fff",
          borderRadius: 20,
          boxShadow: "0 8px 32px rgba(249,115,22,0.55), 0 2px 8px rgba(0,0,0,0.18)",
          display: "flex", alignItems: "center", gap: 14,
          padding: "14px 18px",
          animation: "nudgePop 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          border: "2px solid rgba(255,255,255,0.25)",
        }}>
          {/* Bell icon with pulse ring */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              position: "absolute", inset: -6,
              borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.4)",
              animation: "nudgeRing 0.8s ease-out",
            }} />
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: "rgba(255,255,255,0.22)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Bell size={20} fill="white" color="white" />
            </div>
          </div>
          {/* Message */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8, marginBottom: 2 }}>
              แจ้งเตือนจากครู
            </p>
            <p style={{ fontSize: "0.9rem", fontWeight: 700, lineHeight: 1.3 }}>{nudgeMessage}</p>
          </div>
          {/* Emoji accent */}
          <span style={{ fontSize: "1.6rem", flexShrink: 0 }}>👀</span>
        </div>
      )}

      {/* Header */}
      <div className="top-bar" style={{ background: "var(--surface-card)" }}>
        <Link href="/dashboard" style={{ background: "var(--neutral-100)", border: "none", borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", textDecoration: "none" }}>
          <ChevronLeft size={18} />
        </Link>
        <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>{t("lessonLobby.lobbyTitle")}</h1>
      </div>

      <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
        
        {/* Class Banner */}
        <div className="glass-card" style={{ padding: "20px", background: "linear-gradient(135deg, #06c755 0%, #037d36 100%)", border: "none", position: "relative", overflow: "hidden" }}>
           <div style={{ position: "absolute", right: -20, top: -20, opacity: 0.1 }}>
              <Play size={120} color="#fff" fill="#fff" />
           </div>
           <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ background: "rgba(255,255,255,0.2)", padding: "4px 10px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <ShieldCheck size={14} color="#fff" />
                <span style={{ color: "#fff", fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase" }}>Live Lesson</span>
              </div>
              <h2 style={{ color: "#fff", fontSize: "1.25rem", fontWeight: 800, marginBottom: 4 }}>{classInfo.name}</h2>
              <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.875rem" }}>{t("lessonLobby.tutorPrefix")} {classInfo.tutor?.name || t("lessonLobby.defaultTutor")}</p>
           </div>
        </div>

        {/* Participants Count */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={18} style={{ color: "var(--brand-500)" }} />
            {t("lessonLobby.classmates")} ({participants.length})
          </h3>
          <span style={{ fontSize: "0.8125rem", color: "var(--brand-600)", fontWeight: 700 }}>
             {t("lessonLobby.readyPrefix")} {readyCount}/{participants.length}
          </span>
        </div>

        {/* Participant List */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {participants.length === 0 ? (
             <div className="glass-card" style={{ gridColumn: "span 3", padding: "40px 20px", textAlign: "center", border: "2px dashed var(--neutral-200)", background: "transparent" }}>
                <div style={{ fontSize: "2rem", marginBottom: 10 }}>👋</div>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>{t("lessonLobby.waitingClassmates")}</p>
             </div>
          ) : (
            [...participants]
              .sort((a, b) => a.studentId === studentId ? -1 : b.studentId === studentId ? 1 : 0)
              .map((p) => {
                const isMe = p.studentId === studentId;
                return (
                  <div key={p.studentId} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div style={{ position: "relative" }}>
                       <div style={{ 
                         width: 72, height: 72, borderRadius: 24, position: "relative",
                         background: isMe ? "var(--brand-50)" : "var(--neutral-100)", 
                         display: "flex", alignItems: "center", justifyContent: "center",
                         border: isMe ? "3px solid var(--brand-500)" : p.isReady ? "3px solid var(--brand-300)" : "3px solid transparent",
                         boxShadow: isMe ? "0 0 15px rgba(6,199,85,0.2)" : "none",
                         transition: "all 0.3s ease",
                         overflow: "hidden"
                       }}>
                         <Image
                           src={p.pictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`} 
                           alt={p.name} 
                           fill
                           sizes="72px"
                           unoptimized
                           style={{ width: "100%", height: "100%", objectFit: "cover" }}
                         />
                       </div>
                       {p.isReady && (
                         <div style={{ position: "absolute", bottom: -2, right: -2, background: "var(--brand-500)", borderRadius: "50%", padding: 3, border: "2px solid var(--surface-bg)", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                           <CheckCircle2 size={16} color="#fff" />
                         </div>
                       )}
                    </div>
                    <div style={{ textAlign: "center", width: "100%" }}>
                      <div style={{ 
                        fontSize: "0.75rem", 
                        fontWeight: 800, 
                        color: isMe ? "var(--brand-600)" : p.isReady ? "var(--text-primary)" : "var(--text-secondary)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                      }}>
                        {isMe ? t("lessonLobby.me") : p.name}
                      </div>
                      {isMe && <div style={{ fontSize: "0.625rem", color: "var(--brand-500)", fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>You</div>}
                    </div>
                  </div>
                );
              })
          )}
        </div>

        {/* Status Message */}
        <div style={{ marginTop: 20 }}>
           {error ? (
              <div className="glass-card" style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", display: "flex", gap: 10, alignItems: "center" }}>
                <AlertCircle size={18} style={{ color: "#ef4444" }} />
                <p style={{ fontSize: "0.8125rem", color: "#991b1b" }}>{error}</p>
              </div>
           ) : !sessionData ? (
              <div className="glass-card" style={{ padding: "16px", textAlign: "center", border: "1px solid var(--surface-border)" }}>
                <Loader2 className="animate-spin" size={20} style={{ color: "var(--brand-500)", margin: "0 auto 8px" }} />
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{t("lessonLobby.connectingLesson")}</p>
              </div>
           ) : (
              <div className="glass-card" style={{ padding: "16px", textAlign: "center", border: "1px solid var(--surface-border)" }}>
                <p style={{ fontSize: "0.875rem", color: "var(--text-primary)", fontWeight: 500 }}>
                  {isReady ? t("lessonLobby.waitingTutor") : t("lessonLobby.readyInstruction")}
                </p>
              </div>
           )}
        </div>

        {/* Action Button */}
        <div style={{ position: "fixed", bottom: 24, left: 20, right: 20, zIndex: 10 }}>
           <Button 
             onClick={toggleReady} 
             disabled={!sessionData || !!error}
             className={isReady ? "btn-secondary btn-lg btn-full" : "btn-primary btn-lg btn-full shine-effect"}
             style={{ 
               height: 60, borderRadius: 20, fontSize: "1.125rem", fontWeight: 800,
               boxShadow: isReady ? "none" : "0 10px 25px rgba(6,199,85,0.3)"
             }}
           >
             {isReady ? t("lessonLobby.cancelReady") : t("lessonLobby.readyCta")}
           </Button>
        </div>

      </div>
    </div>
  );
}
