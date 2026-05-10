/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Send, MoreVertical, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendMessage, getConversationMessages } from "../actions";

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
    return <img src={src} onError={() => setError(true)} alt="" referrerPolicy="no-referrer" className="w-6 h-6 rounded-full object-cover shrink-0" />;
  }
  return (
    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
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
      // If the newest message is from others and is not numeric temp ID
      if (lastMsg && !lastMsg.isOwn && !/^\d{13}$/.test(lastMsg.id)) {
        playNotificationSound();
      }
    }
    prevLengthRef.current = messages.length;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
            // Preserve any locally created optimistic messages not yet persisted
            // Our temp IDs use numeric timestamp strings
            const pendingMsgs = prev.filter(m => m.senderId === "me" && !newMsgs.some((n: any) => n.id === m.id));
            
            // Wait, actually simpler logic, if message matches existing Server ID don't repeat.
            // Let's keep simpler: replace state with server, append any which are genuinely optimistic wait state.
            const realNewIds = new Set(newMsgs.map((m: any) => m.id));
            const myPending = prev.filter(m => m.senderId === "me" && !realNewIds.has(m.id) && isNaN(Number(m.id)) === false); 
            // wait actually `tempId` was `Date.now().toString()`. So `isNaN(Number(m.id))` is false for temp IDs.
            
            // Let's just filter by length or presence of numeric parse
            const tempMsgs = prev.filter(m => {
               // It's temp if it was created with `Date.now().toString()` (approx 13 digits number)
               // Server IDs are likely UUIDs (non-numeric)
               return /^\d{13}$/.test(m.id);
            });
            
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
      senderName: "คุณ",
      time: new Date().toISOString(),
      isOwn: true,
    };
    
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const response = await sendMessage(conversationId, textToSend);
      // Replace optimistic message with actual data from server
      setMessages(prev => prev.map(m => m.id === tempId ? {
        ...m,
        id: response.id,
        time: response.time
      } : m));
    } catch (error) {
      console.error("Failed to send message", error);
      // Revert optimistic update on failure (in real app we'd show error state)
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInputText(textToSend); // put text back in input
    } finally {
      setSending(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    // For Thai names, taking the first few logic, but simply taking first character works
    return name.charAt(0);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] w-full max-w-3xl mx-auto -mt-4 sm:mt-0 bg-background sm:border sm:rounded-2xl sm:shadow-sm overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:px-6 sm:py-4 border-b bg-card/50 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/chat">
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 rounded-full shrink-0">
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold overflow-hidden">
              {metadata.image ? (
                <img src={metadata.image} alt={metadata.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                getInitials(metadata.title)
              )}
            </div>
            <div>
              <h2 className="font-semibold text-sm sm:text-base leading-none">{metadata.title}</h2>
              <p className="text-[10px] text-muted-foreground mt-1">{metadata.status || "คุยแบบเรียลไทม์"}</p>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 text-muted-foreground">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
        <div className="text-center my-4">
          <span className="text-[10px] bg-muted px-3 py-1 rounded-full text-muted-foreground">
            การสนทนาที่ถูกเข้ารหัส
          </span>
        </div>
        
        {(() => {
          // Find index of ABSOLUTELY the last message from the other person
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
            
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
                {!isMe && (
                  <div className="w-6 flex justify-center flex-shrink-0 pb-4">
                    {isAbsoluteLastForOther ? (
                      <MessageAvatar src={msg.senderImage} name={msg.senderName} />
                    ) : (
                      <div className="w-6" />
                    )}
                  </div>
                )}
                
                <div className={`flex flex-col max-w-[80%] sm:max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                  <div 
                    className={`px-4 py-2.5 rounded-2xl shadow-sm border ${
                      isMe 
                        ? "bg-primary border-transparent text-primary-foreground rounded-br-sm" 
                        : "bg-card border-border text-foreground rounded-bl-sm"
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 px-1 opacity-60">
                    <span className="text-[9px]">
                      {displayTime}
                    </span>
                  </div>
                </div>
              </div>
            );
          });
        })()}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-background border-t">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <div className="flex-1 min-h-0 bg-muted/50 rounded-2xl border border-input focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all flex items-center pr-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="พิมพ์ข้อความ..."
              className="w-full bg-transparent border-none focus:outline-none px-4 py-2.5 text-sm"
              disabled={sending}
            />
            <Button 
              type="submit" 
              size="icon" 
              disabled={!inputText.trim() || sending}
              className={`h-8 w-8 rounded-full shrink-0 transition-all ${
                inputText.trim() ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
              }`}
            >
              <Send className="h-4 w-4 ml-0.5" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
