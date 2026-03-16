/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { cookies } from "next/headers";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ChevronRight } from "lucide-react";

async function getConversations() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) return [];

  try {
    const res = await fetch("http://localhost:3002/v1/chat/conversations", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      next: { tags: ['chat'] }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.conversations || [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

export default async function ChatPage() {
  const conversations = await getConversations();

  return (
    <div className="space-y-6 max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ข้อความ</h1>
          <p className="text-sm text-muted-foreground mt-1">
            สนทนากับนักเรียนและผู้ปกครอง (ข้อมูลจะถูกบันทึกเพื่อความปลอดภัย)
          </p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="ค้นหาชื่อนักเรียน หรือคลาสเรียน..."
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pb-24 sm:pb-0 pr-2">
        {conversations.length === 0 && (
          <div className="py-12 text-center border rounded-xl border-dashed">
            <p className="text-muted-foreground">ยังไม่มีข้อความ</p>
          </div>
        )}
        
        {conversations.map((conv: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
          <Link key={conv.id} href={`/dashboard/chat/${conv.id}`} className="block group">
            <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer bg-card/50 backdrop-blur-sm sm:bg-card">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg overflow-hidden">
                    {conv.image ? (
                      <img src={conv.image} alt={conv.title} className="w-full h-full object-cover" />
                    ) : (
                      conv.title?.[0] || '?'
                    )}
                  </div>
                  {conv.unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center border-2 border-background">
                      {conv.unreadCount}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {conv.title}
                    </p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(conv.updatedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded border bg-muted/50 text-muted-foreground shrink-0">
                      {conv.type === "DIRECT" ? "แชทส่วนตัว" : "แชทกลุ่ม"}
                    </span>
                  </div>
                  <p className={`text-sm truncate mt-1 ${conv.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {conv.lastMessage?.content || "ยังไม่มีข้อความ"}
                  </p>
                </div>
                
                <ChevronRight className="h-5 w-5 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:text-primary transition-all shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
