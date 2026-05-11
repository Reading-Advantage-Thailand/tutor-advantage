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
        {/* Mobile top bar (just branding and theme toggle now) */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-background border-b border-border z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 shrink-0 flex items-center justify-center">
              <Image 
                src="/icons/icon-192.png" 
                alt="Tutor Advantage" 
                width={28} 
                height={28} 
                className="rounded-lg shadow-sm"
              />
            </div>
            <span className="font-semibold text-sm">Tutor Advantage</span>
          </div>
          <ThemeToggle />
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
