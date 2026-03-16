/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Send, MoreVertical, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendMessage } from "../actions";

type Message = {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
                <img src={metadata.image} alt={metadata.title} className="w-full h-full object-cover" />
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
        
        {messages.map((msg) => {
          const isMe = msg.isOwn;
          const displayTime = new Date(msg.time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`flex flex-col max-w-[75%] sm:max-w-[70%] ${isMe ? "items-end" : "items-start"}`}>
                <div 
                  className={`px-4 py-2.5 rounded-2xl ${
                    isMe 
                      ? "bg-primary text-primary-foreground rounded-tr-sm" 
                      : "bg-muted border border-border/50 text-foreground rounded-tl-sm"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap word-break-all">{msg.text}</p>
                </div>
                <div className="flex items-center gap-1 mt-1 px-1">
                  {!isMe && <span className="text-[10px] text-muted-foreground">{msg.senderName} • </span>}
                  <span className="text-[10px] text-muted-foreground">
                    {displayTime}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-background border-t">
        <form onSubmit={handleSend} className="flex items-end gap-2">
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-muted-foreground hover:text-primary transition-colors">
            <ImageIcon className="h-5 w-5" />
          </Button>
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
