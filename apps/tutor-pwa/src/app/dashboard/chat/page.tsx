/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { cookies } from "next/headers";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ChevronRight, MessageSquare } from "lucide-react";
import { t } from "@/lib/i18n";
import { PageTransition } from "@/components/ui/page-transition";

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
    <PageTransition variant="slide-up" stagger className="space-y-6 max-w-2xl mx-auto w-full pb-24 sm:pb-12">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">{t("dashboardChat.title")}</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            {t("dashboardChat.subtitle")}
          </p>
        </div>
        
        <div className="relative group mt-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-brand-500 transition-colors" />
          <input
            type="text"
            placeholder={t("dashboardChat.searchPlaceholder")}
            className="w-full h-14 pl-12 pr-4 rounded-2xl border border-border/40 bg-card hover:bg-muted/10 text-sm font-semibold focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all duration-300 shadow-sm"
          />
        </div>
      </div>

      <div className="space-y-3 stagger">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-card border border-dashed border-border/60 rounded-3xl animate-scale-in">
            <MessageSquare className="h-12 w-12 text-brand-500 mb-4 animate-float" />
            <p className="font-bold text-foreground">{t("dashboardChat.emptyTitle")}</p>
            <p className="text-sm font-medium text-muted-foreground mt-1">{t("dashboardChat.emptyDescription")}</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 gap-3.5">
          {conversations.map((conv: any, index: number) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
            <Link 
              key={conv.id} 
              href={`/dashboard/chat/${conv.id}`} 
              className="block group focus:outline-none rounded-3xl animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <Card className="hover-lift press-scale border border-border/40 hover:shadow-lg hover:border-brand-500/20 transition-all duration-300 rounded-3xl bg-card bg-gradient-to-br from-card via-card to-brand-500/1 dark:to-brand-500/3 overflow-hidden shadow-sm">
                <CardContent className="p-4 sm:p-5 flex items-center gap-4">
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-xl overflow-hidden border border-brand-500/10">
                      {conv.image ? (
                        <img src={conv.image} alt={conv.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        conv.title?.[0] || '?'
                      )}
                    </div>
                    {/* Glowing active online indicator for Direct messages */}
                    {conv.type === "DIRECT" && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-brand-500 border-2 border-card rounded-full shadow-[0_0_8px_rgba(6,199,85,0.6)]" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-[16px] text-foreground truncate group-hover:text-brand-500 transition-colors">
                        {conv.title}
                      </p>
                      <span className="text-[10px] font-bold text-muted-foreground shrink-0 uppercase tracking-widest bg-muted/65 px-2.5 py-1 rounded-lg">
                        {new Date(conv.updatedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/5">
                        {conv.type === "DIRECT" ? t("dashboardChat.direct") : t("dashboardChat.group")}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between gap-4">
                      <p className={`text-sm truncate flex-1 ${conv.unreadCount > 0 ? "text-foreground font-black" : "text-muted-foreground font-medium"}`}>
                        {conv.lastMessage?.content || t("dashboardChat.noMessages")}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-gradient-to-r from-red-500 to-rose-500 text-[10px] font-black text-white flex items-center justify-center shadow-md shadow-red-500/20 shrink-0 animate-bounce">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
