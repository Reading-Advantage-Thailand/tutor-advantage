/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { cookies } from "next/headers";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ChevronRight, MessageSquare } from "lucide-react";
import { t } from "@/lib/i18n";

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
    <div className="space-y-6 max-w-2xl mx-auto w-full animate-in fade-in duration-500 pb-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">{t("dashboardChat.title")}</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            {t("dashboardChat.subtitle")}
          </p>
        </div>
        
        <div className="relative group mt-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-brand-600 transition-colors" />
          <input
            type="text"
            placeholder={t("dashboardChat.searchPlaceholder")}
            className="w-full h-14 pl-12 pr-4 rounded-2xl border-2 border-border/50 bg-muted/30 text-sm font-medium focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
          />
        </div>
      </div>

      <div className="space-y-3">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed">
            <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="font-bold text-muted-foreground">{t("dashboardChat.emptyTitle")}</p>
            <p className="text-sm text-muted-foreground/60 mt-1">{t("dashboardChat.emptyDescription")}</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 gap-3">
          {conversations.map((conv: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
            <Link key={conv.id} href={`/dashboard/chat/${conv.id}`} className="block group">
              <Card className="border-none shadow-sm hover:shadow-md transition-all rounded-3xl bg-card overflow-hidden group-hover:ring-2 group-hover:ring-brand-500/20">
                <CardContent className="p-4 sm:p-5 flex items-center gap-4">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-xl overflow-hidden shadow-sm border border-border/50">
                      {conv.image ? (
                        <img src={conv.image} alt={conv.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        conv.title?.[0] || '?'
                      )}
                    </div>
                    {conv.unreadCount > 0 && (
                      <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-500 text-xs font-black text-white flex items-center justify-center border-2 border-card shadow-sm animate-pulse">
                        {conv.unreadCount}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-[15px] text-foreground truncate group-hover:text-brand-600 transition-colors">
                        {conv.title}
                      </p>
                      <span className="text-[10px] font-bold text-muted-foreground shrink-0 uppercase tracking-widest bg-muted/50 px-2 py-0.5 rounded-md">
                        {new Date(conv.updatedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground shrink-0">
                        {conv.type === "DIRECT" ? t("dashboardChat.direct") : t("dashboardChat.group")}
                      </span>
                    </div>
                    <p className={`text-sm truncate ${conv.unreadCount > 0 ? "text-foreground font-bold" : "text-muted-foreground font-medium"}`}>
                      {conv.lastMessage?.content || t("dashboardChat.noMessages")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
