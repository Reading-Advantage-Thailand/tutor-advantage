"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Search, ChevronRight, MessageCircle, BookOpen, User, Users, Loader2 } from "lucide-react";
import { useLiff } from "@/components/providers/LiffProvider";
import { studentApi } from "@/lib/api";
import { t } from "@/lib/i18n";
import { toast } from "sonner";

const ChatAvatar = ({ src, title, size = 48 }: { src?: string | null, title: string, size?: number }) => {
  const [hasError, setHasError] = useState(false);
  
  if (src && !hasError) {
    return (
      <Image 
        src={src} 
        onError={() => setHasError(true)} 
        alt="" 
        unoptimized
        width={size}
        height={size}
        style={{ borderRadius: "50%", objectFit: "cover" }} 
      />
    );
  }
  
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-600)", fontWeight: 700 }}>
      {title?.charAt(0) || "?"}
    </div>
  );
};

const playNotificationSound = () => {
  try {
    if (typeof window !== "undefined" && localStorage.getItem("app-notif-muted") === "true") return;
    const win = window as unknown as { __globalAudioCtx?: AudioContext };
    const ctx = win.__globalAudioCtx;
    if (!ctx || ctx.state !== "running") {
      if (ctx) ctx.resume().catch(() => {});
      if (!ctx || ctx.state !== "running") return;
    }
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    osc2.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime + 0.1);
    osc1.stop(ctx.currentTime + 0.6);
    osc2.stop(ctx.currentTime + 0.6);
  } catch {
    // Silently catch
  }
};

interface Conversation {
  id: string;
  image?: string | null;
  title: string;
  unreadCount: number;
  updatedAt: string;
  lastMessage?: {
    sender: string;
    content: string;
  };
  type: 'DIRECT' | 'GROUP';
}

interface EnrolledClass {
  id: string;
  name: string;
  tutorName: string;
  tutorUserId: string;
}

export default function ChatListPage() {
  const { profile, isReady } = useLiff();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [classes, setClasses] = useState<EnrolledClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<'recent' | 'classes'>('classes');
  const [initiatingChat, setInitiatingChat] = useState<string | null>(null);
  const prevTotalUnread = useRef<number | undefined>(undefined);

  // Handle sound alert effect when total unread from convo list increases
  useEffect(() => {
    const currentTotal = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
    if (prevTotalUnread.current !== undefined && currentTotal > prevTotalUnread.current) {
      playNotificationSound();
    }
    prevTotalUnread.current = currentTotal;
  }, [conversations]);

  useEffect(() => {
    let isMounted = true;
    let pollingId: NodeJS.Timeout;

    if (isReady && profile) {
      const fetchData = async (showLoading = true) => {
        try {
          if (showLoading) setLoading(true);
          
          let token = localStorage.getItem("student_session_token");
          let retries = 0;
          while (!token && retries < 10 && isMounted) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            token = localStorage.getItem("student_session_token");
            retries++;
          }
          if (!token && isMounted) throw new Error(t("chat.sessionUnavailable"));

          if (!isMounted) return;

          const [convRes, classesRes] = await Promise.all([
            studentApi.getConversations().catch(() => ({ conversations: [] })),
            studentApi.getEnrolledClasses().catch(() => ({ classes: [] }))
          ]);

          if (isMounted) {
            setConversations(convRes.conversations || []);
            setClasses(classesRes.classes || []);
          }
        } catch (err: unknown) {
          console.error("Failed to fetch chat data:", err);
          if (isMounted && showLoading) setError(t("chat.loadConversationsFailed"));
        } finally {
          if (isMounted && showLoading) setLoading(false);
        }
      };

      fetchData(true);
      
      // Poll conversations every 5 seconds for realtime updates
      pollingId = setInterval(() => {
        fetchData(false);
      }, 5000);
    }

    return () => { 
      isMounted = false; 
      if (pollingId) clearInterval(pollingId);
    };
  }, [isReady, profile]);

  const handleInitiateChat = async (type: 'DIRECT' | 'GROUP', classId: string, tutorUserId?: string) => {
    const loadingKey = `${type}-${classId}`;
    setInitiatingChat(loadingKey);
    try {
      const res = await studentApi.initiateChat({
        type,
        classId,
        targetUserId: tutorUserId
      });
      if (res && res.conversationId) {
        router.push(`/chat/${res.conversationId}`);
      } else {
        throw new Error("Failed to get ID");
      }
    } catch (err: unknown) {
      console.error("Failed to initiate:", err);
      toast.error(t("chat.openFailed"));
      setInitiatingChat(null);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  };

  const filteredConversations = conversations.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredClasses = classes.filter(cls => 
    cls.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    cls.tutorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-shell" style={{ background: "var(--surface-bg)", minHeight: "100dvh" }}>
      
      <div className="top-bar" style={{ background: "var(--surface-card)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--surface-border)" }}>
        <Link
          href="/dashboard"
          style={{
            background: "var(--neutral-100)",
            border: "none",
            borderRadius: 12,
            width: 36, height: 36,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text-secondary)", textDecoration: "none",
          }}
        >
          <ChevronLeft size={18} />
        </Link>
        <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", flex: 1, textAlign: "center", marginRight: 36 }}>
          {t("chat.title")}
        </h1>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>
        
        {/* Tab Switcher */}
        <div style={{ 
          display: "flex", 
          background: "var(--neutral-100)", 
          borderRadius: 12, 
          padding: 4,
          marginBottom: 4
        }}>
          <button 
            onClick={() => setActiveTab('classes')}
            style={{
              flex: 1, border: "none", borderRadius: 8, padding: "8px 0", fontSize: "0.875rem", fontWeight: 600,
              background: activeTab === 'classes' ? "var(--surface-card)" : "transparent",
              boxShadow: activeTab === 'classes' ? "var(--shadow-xs)" : "none",
              color: activeTab === 'classes' ? "var(--brand-600)" : "var(--text-secondary)",
              cursor: "pointer", transition: "all 0.2s"
            }}
          >
            {t("chat.myClasses")}
          </button>
          <button 
            onClick={() => setActiveTab('recent')}
            style={{
              flex: 1, border: "none", borderRadius: 8, padding: "8px 0", fontSize: "0.875rem", fontWeight: 600,
              background: activeTab === 'recent' ? "var(--surface-card)" : "transparent",
              boxShadow: activeTab === 'recent' ? "var(--shadow-xs)" : "none",
              color: activeTab === 'recent' ? "var(--brand-600)" : "var(--text-secondary)",
              cursor: "pointer", transition: "all 0.2s",
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
            }}
          >
            {t("chat.recent")}
            {conversations.filter(c => c.unreadCount > 0).length > 0 && (
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-red)" }} />
            )}
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
          <input
            type="text"
            placeholder={activeTab === 'classes' ? t("chat.searchClasses") : t("chat.searchConversations")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%", height: 44, padding: "0 16px 0 40px", borderRadius: 14,
              border: "1px solid var(--surface-border)", background: "var(--surface-card)",
              fontSize: "0.875rem", outline: "none", color: "var(--text-primary)"
            }}
          />
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 12 }}>
            <Loader2 className="animate-spin text-green-500" size={32} />
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{t("chat.loading")}</p>
          </div>
        ) : error ? (
          <div className="glass-card" style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
            <p>{error}</p>
            <button onClick={() => window.location.reload()} className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}>{t("chat.retry")}</button>
          </div>
        ) : activeTab === 'classes' ? (
          // ── CLASSES AS FOLDERS ──
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {filteredClasses.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-tertiary)" }}>
                <BookOpen size={48} style={{ opacity: 0.3, margin: "0 auto 12px" }} />
                <p>{t("chat.emptyEnrollments")}</p>
              </div>
            ) : (
              filteredClasses.map((cls) => (
                <div key={cls.id} className="glass-card animate-slide-up" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--surface-border)' }}>
                  
                  {/* Class Header Folder Style */}
                  <div style={{ background: "var(--brand-50)", padding: "16px", borderBottom: "1px solid var(--brand-100)" }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-600)', boxShadow: 'var(--shadow-xs)' }}>
                        <BookOpen size={20} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cls.name}
                        </h4>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: "2px 0 0" }}>
                          {t("chat.tutorPrefix")} {cls.tutorName}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Row inside Folder */}
                  <div style={{ padding: "8px 0" }}>
                    {/* Action: Chat with Tutor */}
                    <button 
                      onClick={() => handleInitiateChat('DIRECT', cls.id, cls.tutorUserId)}
                      disabled={!!initiatingChat}
                      style={{
                        width: '100%', padding: '12px 16px', background: 'none', border: 'none',
                        display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                        borderBottom: '1px solid var(--surface-border)', textAlign: 'left'
                      }}
                      className="clickable-effect"
                    >
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: 'var(--accent-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue)' }}>
                        {initiatingChat === `DIRECT-${cls.id}` ? <Loader2 size={16} className="animate-spin" /> : <User size={16} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>{t("chat.directChatTitle")}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>{t("chat.directChatPrefix")} {cls.tutorName} {t("chat.directChatSuffix")}</div>
                      </div>
                      <ChevronRight size={16} style={{ color: "var(--neutral-300)" }} />
                    </button>

                    {/* Action: Chat with Group */}
                    <button 
                      onClick={() => handleInitiateChat('GROUP', cls.id)}
                      disabled={!!initiatingChat}
                      style={{
                        width: '100%', padding: '12px 16px', background: 'none', border: 'none',
                        display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left'
                      }}
                      className="clickable-effect"
                    >
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: 'var(--accent-purple-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-purple)' }}>
                         {initiatingChat === `GROUP-${cls.id}` ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>{t("chat.groupChatTitle")}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>{t("chat.groupChatDescription")}</div>
                      </div>
                      <ChevronRight size={16} style={{ color: "var(--neutral-300)" }} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          // ── RECENT CONVERSATIONS ──
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredConversations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-tertiary)" }}>
                <MessageCircle size={48} style={{ opacity: 0.3, margin: "0 auto 12px" }} />
                <p>{t("chat.emptyRecent")}</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <Link key={conv.id} href={`/chat/${conv.id}`} style={{ textDecoration: "none" }}>
                  <div className="glass-card clickable-effect animate-slide-up" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--surface-border)", background: conv.unreadCount > 0 ? "var(--brand-50)" : "var(--surface-card)" }}>
                    <div style={{ position: "relative" }}>
                      <ChatAvatar src={conv.image} title={conv.title} size={48} />
                      {conv.unreadCount > 0 && (
                        <div style={{ position: "absolute", top: -2, right: -2, background: "var(--accent-red)", color: "white", fontSize: "0.625rem", fontWeight: "bold", minWidth: 18, height: 18, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", border: "2px solid var(--surface-card)" }}>
                          {conv.unreadCount}
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                        <h4 style={{ fontSize: "0.9375rem", fontWeight: conv.unreadCount > 0 ? 700 : 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "75%" }}>
                          {conv.title}
                        </h4>
                        <span style={{ fontSize: "0.6875rem", color: conv.unreadCount > 0 ? "var(--brand-600)" : "var(--text-tertiary)", fontWeight: conv.unreadCount > 0 ? 600 : 400 }}>
                          {formatTime(conv.updatedAt)}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <p style={{ fontSize: "0.8125rem", color: conv.unreadCount > 0 ? "var(--text-primary)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                          {conv.lastMessage ? (<>{conv.lastMessage.sender === t("chat.you") ? t("chat.youPrefix") : ""}{conv.lastMessage.content}</>) : t("chat.noMessages")}
                        </p>
                        {conv.type !== "DIRECT" && <span style={{ background: "var(--neutral-100)", color: "var(--text-tertiary)", fontSize: "0.625rem", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>{t("chat.groupBadge")}</span>}
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: "var(--neutral-300)", flexShrink: 0 }} />
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
