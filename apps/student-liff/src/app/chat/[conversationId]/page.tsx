"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, Send } from "lucide-react";
import { useLiff } from "@/components/providers/LiffProvider";
import { studentApi } from "@/lib/api";

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderImage?: string | null;
  time: string;
  isOwn: boolean;
}

interface Metadata {
  id: string;
  title: string;
  image: string | null;
  fallbackIcon: string;
  status: string;
}

const playNotificationSound = () => {
  try {
    if (typeof window !== "undefined" && localStorage.getItem("app-notif-muted") === "true") return;
    const win = window as unknown as { __globalAudioCtx?: AudioContext };
    const ctx = win.__globalAudioCtx;
    
    if (!ctx || ctx.state !== "running") {
      // Attempt silent resume just in case we are here
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

const MessageAvatar = ({ src, name }: { src?: string | null, name: string }) => {
  const [error, setError] = useState(false);
  if (src && !error) {
    return (
      <Image 
        src={src} 
        onError={() => setError(true)} 
        alt="" 
        unoptimized
        width={28}
        height={28}
        style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} 
      />
    );
  }
  return (
    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand-50)", color: "var(--brand-600)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, flexShrink: 0 }}>
      {name?.charAt(0) || "?"}
    </div>
  );
};

export default function ChatRoomPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;
  const { profile, isReady } = useLiff();

  const [messages, setMessages] = useState<Message[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [imgError, setImgError] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef<number>(0);

  // Function to fetch messages
  const fetchMessages = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const response = await studentApi.getConversationMessages(conversationId);
      
      if (response) {
        setMetadata(response.metadata);
        setMessages(prev => {
          const newMsgs = response.messages || [];
          // Preserve any pending local optimistic messages that haven't been persisted yet
          const pendingMsgs = prev.filter(m => m.id.toString().startsWith("temp-"));
          return [...newMsgs, ...pendingMsgs];
        });
      }
    } catch (err: unknown) {
      console.error("Failed to load messages:", err);
      if (isInitial) {
        setError("ไม่สามารถโหลดข้อความได้");
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [conversationId]);

  // Initial data fetch and set interval for polling
  useEffect(() => {
    if (!isReady || !profile) return;
    
    fetchMessages(true);

    // Poll for new messages every 4 seconds
    const intervalId = setInterval(() => {
      fetchMessages(false);
    }, 4000);

    return () => clearInterval(intervalId);
  }, [isReady, profile, fetchMessages]);

  // Scroll to bottom and play sound when new messages come
  useEffect(() => {
    if (messages.length > prevLengthRef.current && prevLengthRef.current > 0) {
      const lastMsg = messages[messages.length - 1];
      // If the newest message is from others, play notification
      if (lastMsg && !lastMsg.isOwn && !lastMsg.id.toString().startsWith("temp-")) {
        playNotificationSound();
      }
    }
    prevLengthRef.current = messages.length;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const currentText = inputText;
    setInputText("");
    setIsSending(true);

    // Optimistic update
    const optimisticId = `temp-${Date.now()}`;
    const newMsg: Message = {
      id: optimisticId,
      text: currentText,
      senderId: "me",
      senderName: "คุณ",
      time: new Date().toISOString(),
      isOwn: true,
    };

    setMessages(prev => [...prev, newMsg]);

    try {
      const res = await studentApi.sendMessage(conversationId, currentText);
      
      // Replace optimistic message
      setMessages(prev => 
        prev.map(m => m.id === optimisticId ? { ...m, id: res.id, time: res.time } : m)
      );
    } catch (err) {
      console.error("Failed to send message:", err);
      // Revert on error
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      setInputText(currentText);
      alert("ไม่สามารถส่งข้อความได้ โปรดลองใหม่อีกครั้ง");
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  if (!isReady || loading) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-bg)" }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: "3px solid var(--neutral-200)", borderTopColor: "var(--brand-500)", borderRadius: "50%" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, gap: 12 }}>
        <p className="text-red-500 font-medium">{error}</p>
        <button onClick={() => router.push("/chat")} className="btn btn-secondary btn-sm">ย้อนกลับ</button>
      </div>
    );
  }

  // Find index of ABSOLUTELY the last message from the other person
  let lastOtherIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (!messages[i].isOwn) {
      lastOtherIdx = i;
      break;
    }
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--surface-bg)", position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}>
      
      {/* Header */}
      <header style={{ 
        height: 60, 
        background: "var(--surface-card)", 
        borderBottom: "1px solid var(--surface-border)", 
        display: "flex", 
        alignItems: "center", 
        padding: "0 12px", 
        gap: 8,
        zIndex: 50
      }}>
        <button 
          onClick={() => router.push("/chat")} 
          style={{ 
            background: "transparent", 
            border: "none", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "50%",
            color: "var(--text-secondary)"
          }}
        >
          <ChevronLeft size={24} />
        </button>
        
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          {metadata?.image && !imgError ? (
            <Image 
              src={metadata.image} 
              onError={() => setImgError(true)} 
              alt="" 
              unoptimized
              width={40}
              height={40}
              style={{ borderRadius: "50%", objectFit: "cover" }} 
            />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--brand-50)", color: "var(--brand-600)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>
              {metadata?.title?.charAt(0) || "?"}
            </div>
          )}
          <div style={{ overflow: "hidden" }}>
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {metadata?.title}
            </h2>
            <p style={{ fontSize: "0.6875rem", color: "#059669", margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
              {metadata?.status || "ออนไลน์"}
            </p>
          </div>
        </div>

      </header>

      {/* Chat Area */}
      <div style={{ 
        flex: 1, 
        overflowY: "auto", 
        padding: "16px 16px 24px",
        display: "flex", 
        flexDirection: "column",
        gap: 12
      }}>
        <div style={{ textAlign: "center", margin: "8px 0" }}>
          <span style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", background: "var(--neutral-100)", padding: "4px 10px", borderRadius: 10 }}>
            เริ่มต้นการสนทนาที่ปลอดภัย
          </span>
        </div>

        {messages.map((msg, idx) => {
          const isMe = msg.isOwn;
          const showSender = !isMe && (idx === 0 || messages[idx-1].senderId !== msg.senderId);
          const isAbsoluteLastForOther = idx === lastOtherIdx;
          
          return (
            <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", maxWidth: "90%", alignSelf: isMe ? "flex-end" : "flex-start" }}>
              {showSender && (
                <span style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginLeft: 36, marginBottom: 2 }}>{msg.senderName}</span>
              )}
              <div style={{ 
                display: "flex", 
                flexDirection: "row", 
                alignItems: "flex-end",
                gap: 8,
                justifyContent: isMe ? "flex-end" : "flex-start"
              }}>
                {/* Avatar placeholder for others */}
                {!isMe && (
                  <div style={{ width: 28, display: "flex", justifyContent: "center" }}>
                    {isAbsoluteLastForOther ? (
                      <MessageAvatar src={msg.senderImage} name={msg.senderName} />
                    ) : (
                      <div style={{ width: 28 }} /> /* Empty spacer for alignment */
                    )}
                  </div>
                )}

                <div style={{ 
                  display: "flex", 
                  flexDirection: isMe ? "row-reverse" : "row", 
                  alignItems: "flex-end",
                  gap: 4
                }}>
                  <div style={{ 
                    padding: "10px 14px", 
                    borderRadius: 16,
                    borderBottomRightRadius: isMe ? 4 : 16,
                    borderBottomLeftRadius: isMe ? 16 : 4,
                    background: isMe ? "var(--brand-600)" : "var(--surface-card)",
                    color: isMe ? "#ffffff" : "var(--text-primary)",
                    fontSize: "0.9375rem",
                    boxShadow: "var(--shadow-sm)",
                    wordBreak: "break-word",
                    lineHeight: 1.5
                  }}>
                    {msg.text}
                  </div>
                  <span style={{ fontSize: "0.625rem", color: "var(--text-tertiary)", paddingBottom: 2, opacity: 0.8 }}>
                    {formatTime(msg.time)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ 
        padding: "10px 12px", 
        background: "var(--surface-card)", 
        borderTop: "1px solid var(--surface-border)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" 
      }}>
        <form onSubmit={handleSendMessage} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          
          <div style={{ 
            flex: 1, 
            background: "var(--neutral-100)", 
            borderRadius: 20, 
            display: "flex", 
            alignItems: "center", 
            padding: "0 12px",
            border: "1px solid transparent",
            transition: "all 0.2s"
          }}>
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="เขียนข้อความ..."
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                padding: "10px 0",
                fontSize: "0.9375rem",
                outline: "none",
                color: "var(--text-primary)"
              }}
            />
          </div>

          <button 
            type="submit" 
            disabled={!inputText.trim() || isSending}
            style={{ 
              background: inputText.trim() ? "var(--brand-600)" : "var(--neutral-200)", 
              border: "none", 
              width: 40, 
              height: 40, 
              borderRadius: "50%", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              color: inputText.trim() ? "#fff" : "#9ca3af",
              transition: "all 0.2s",
              flexShrink: 0
            }}
          >
            <Send size={18} style={{ marginLeft: 1, marginTop: 1 }} />
          </button>
        </form>
      </div>
    </div>
  );
}
