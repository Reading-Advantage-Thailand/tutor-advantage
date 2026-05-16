/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Send, MoreVertical, ImageIcon, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendMessage, getConversationMessages } from "../actions";
import { t } from "@/lib/i18n";

type Message = {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderImage?: string | null;
  time: string;
  isOwn: boolean;
};

type Metadata = {
  id: string;
  title: string;
  image: string | null;
  fallbackIcon: string;
  status: string;
};

const playNotificationSound = () => {
  try {
    if (typeof window !== "undefined" && localStorage.getItem("app-notif-muted") === "true") return;
    const win = window as any;
    const ctx = win.__globalAudioCtx;
    if (!ctx || ctx.state !== "running") {
      if (ctx) ctx.resume().catch(() => {});
      if (!ctx || ctx.state !== "running") return;
    }
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'sine';
    osc2.type = 'sine';
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
  } catch (err) {
    // Silent
  }
};

const MessageAvatar = ({ src, name }: { src?: string | null, name: string }) => {
  const [error, setError] = useState(false);
  if (src && !error) {
    return <img src={src} onError={() => setError(true)} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover shrink-0 shadow-sm border border-border/50" />;
  }
  return (
    <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 flex items-center justify-center text-xs font-bold shrink-0 shadow-sm border border-border/50">
      {name?.charAt(0) || "?"}
    </div>
  );
};

export default function ChatRoomClient({
  conversationId,
  initialMessages,
  metadata
}: {
  conversationId: string;
  initialMessages: Message[];
  metadata: Metadata;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef<number>(initialMessages.length);

  // Auto-scroll to bottom and play sound when new messages come
  useEffect(() => {
    if (messages.length > prevLengthRef.current && prevLengthRef.current > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && !lastMsg.isOwn && !/^\d{13}$/.test(lastMsg.id)) {
        playNotificationSound();
      }
    }
    prevLengthRef.current = messages.length;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initial scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, []);

  // Poll for updates every 4 seconds
  useEffect(() => {
    let isMounted = true;
    
    const pollMessages = async () => {
      try {
        const res = await getConversationMessages(conversationId);
        if (!isMounted) return;

        if (res && res.messages) {
          setMessages(prev => {
            const newMsgs = res.messages || [];
            const realNewIds = new Set(newMsgs.map((m: any) => m.id));
            const tempMsgs = prev.filter(m => /^\d{13}$/.test(m.id));
            return [...newMsgs, ...tempMsgs];
          });
        }
      } catch (err) {
        console.error("Poll fail:", err);
      }
    };

    const timer = setInterval(pollMessages, 4000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [conversationId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;
    
    setSending(true);
    const textToSend = inputText;
    setInputText("");

    // Optimistic update
    const tempId = Date.now().toString();
    const optimisticMsg: Message = {
      id: tempId,
      text: textToSend,
      senderId: "me",
      senderName: t("dashboardChat.you"),
      time: new Date().toISOString(),
      isOwn: true,
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    try {
      const response = await sendMessage(conversationId, textToSend);
      setMessages(prev => prev.map(m => m.id === tempId ? {
        ...m,
        id: response.id,
        time: response.time
      } : m));
    } catch (error) {
      console.error("Failed to send message", error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInputText(textToSend);
    } finally {
      setSending(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name.charAt(0);
  };

  // Modern chat layout specifically for mobile PWA
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background sm:static sm:h-[calc(100vh-4rem)] sm:max-w-2xl sm:mx-auto sm:border-x sm:border-b sm:border-border sm:rounded-b-none sm:shadow-lg sm:my-0 sm:-mx-8">
      
      {/* Header - Fixed at top on mobile */}
      <div className="flex items-center justify-between px-4 py-3 sm:py-4 border-b bg-background/95 backdrop-blur-md shrink-0 safe-top">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/chat">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full shrink-0 -ml-2 text-foreground hover:bg-muted">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold overflow-hidden border border-border/50">
              {metadata.image ? (
                <img src={metadata.image} alt={metadata.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                getInitials(metadata.title)
              )}
            </div>
            <div className="flex flex-col">
              <h2 className="font-bold text-base sm:text-lg leading-tight text-foreground truncate max-w-[180px] sm:max-w-[300px]">{metadata.title}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{metadata.status || t("dashboardChat.online")}</p>
              </div>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-muted-foreground hover:bg-muted">
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#f0f4f8] dark:bg-black/20">
        <div className="text-center my-6">
          <span className="text-[10px] font-bold uppercase tracking-widest bg-white dark:bg-muted px-4 py-1.5 rounded-full text-muted-foreground shadow-sm border border-border/50 inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3" />
            {t("dashboardChat.encrypted")}
          </span>
        </div>
        
        {(() => {
          let lastOtherIdx = -1;
          for (let i = messages.length - 1; i >= 0; i--) {
            if (!messages[i].isOwn) {
              lastOtherIdx = i;
              break;
            }
          }

          return messages.map((msg, idx) => {
            const isMe = msg.isOwn;
            const displayTime = new Date(msg.time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
            const isAbsoluteLastForOther = idx === lastOtherIdx;
            // Check if previous message was from the same sender to group them
            const showAvatar = !isMe && (idx === 0 || messages[idx - 1].senderId !== msg.senderId);
            
            return (
              <div key={msg.id} className={`flex items-end gap-2.5 ${isMe ? "justify-end" : "justify-start"}`}>
                {!isMe && (
                  <div className="w-8 flex justify-center flex-shrink-0 mb-5">
                    {showAvatar ? (
                      <MessageAvatar src={msg.senderImage} name={msg.senderName} />
                    ) : (
                      <div className="w-8" />
                    )}
                  </div>
                )}
                
                <div className={`flex flex-col max-w-[75%] sm:max-w-[70%] ${isMe ? "items-end" : "items-start"}`}>
                  {!isMe && showAvatar && (
                    <span className="text-[10px] font-bold text-muted-foreground ml-1 mb-1">{msg.senderName}</span>
                  )}
                  <div 
                    className={`px-4 py-3 shadow-sm border ${
                      isMe 
                        ? "bg-brand-500 border-brand-600 text-white rounded-[24px] rounded-br-[4px]" 
                        : "bg-white dark:bg-card border-border/50 text-foreground rounded-[24px] rounded-bl-[4px]"
                    }`}
                  >
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                  </div>
                  <div className="flex items-center gap-1 mt-1 px-1">
                    <span className="text-[10px] font-bold text-muted-foreground/70">
                      {displayTime}
                    </span>
                    {isMe && (
                      <CheckCircle2 className={`h-3 w-3 ${/^\d{13}$/.test(msg.id) ? "text-muted-foreground/30" : "text-brand-500"}`} />
                    )}
                  </div>
                </div>
              </div>
            );
          });
        })()}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* Input Area - Fixed at bottom on mobile */}
      <div className="p-3 sm:p-4 bg-background border-t border-border shrink-0 safe-bottom">
        <form onSubmit={handleSend} className="flex items-end gap-2">
          <div className="flex-1 bg-muted/50 rounded-[24px] border-2 border-border/50 focus-within:border-brand-500 focus-within:bg-background transition-all flex items-center pr-1 min-h-[48px]">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t("dashboardChat.messagePlaceholder")}
              className="w-full bg-transparent border-none focus:outline-none px-4 py-3 text-[15px] font-medium"
              disabled={sending}
            />
            <Button 
              type="submit" 
              size="icon" 
              disabled={!inputText.trim() || sending}
              className={`h-10 w-10 rounded-full shrink-0 transition-all shadow-sm mr-1 ${
                inputText.trim() ? "bg-brand-500 hover:bg-brand-600 text-white" : "bg-muted-foreground/20 text-muted-foreground"
              }`}
            >
              <Send className="h-5 w-5 ml-1" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
