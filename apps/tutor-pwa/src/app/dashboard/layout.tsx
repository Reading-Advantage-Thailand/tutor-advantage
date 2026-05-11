import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import Image from "next/image";
import { getNotificationsSummary } from "./actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const notifications = await getNotificationsSummary();

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar — hidden on mobile */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar notifications={notifications} />
      </div>

      {/* Main Container */}
      <div className="flex flex-col flex-1 overflow-hidden relative">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-background border-b border-border/50 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 shrink-0 flex items-center justify-center bg-brand-500 rounded-lg shadow-sm text-white">
              <Image 
                src="/icons/icon-192.png" 
                alt="Tutor Advantage" 
                width={32} 
                height={32} 
                className="rounded-lg"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-sm leading-tight text-foreground">Tutor Advantage</span>
              <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-widest leading-tight">Instructor</span>
            </div>
          </div>
          <div className="bg-muted/30 rounded-xl p-1 border border-border/50">
            <ThemeToggle />
          </div>
        </div>

        {/* Main Content Area — add pb-20 on mobile to account for bottom nav */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 lg:p-8 lg:pb-8">
          <div className="mx-auto max-w-5xl space-y-6">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNav notifications={notifications} />
      </div>
    </div>
  );
}
