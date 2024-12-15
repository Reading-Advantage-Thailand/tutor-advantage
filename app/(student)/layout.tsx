import { MainNav } from "@/components/shared/main-nav"
import { Nav } from "@/components/shared/nav"
import { SiteFooter } from "@/components/shared/site-footer"
import { UserAccountNav } from "@/components/shared/user-account-nav"
import { dashboardConfig } from "@/config/dashboard-config"
import { getCurrentUser } from "@/lib/session"
import { Role } from "@prisma/client"
import { redirect } from "next/navigation"

interface DashboardLayoutProps {
  children?: React.ReactNode
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  if (user?.role == Role.GUEST) return redirect("/role")

  return (
    <div className="flex min-h-screen flex-col space-y-6">
      <header className="bg-background sticky top-0 z-40 border-b">
        <div className="container flex h-16 items-center justify-between py-4">
          <MainNav items={dashboardConfig.mainNav} />
          <UserAccountNav
            user={{
              name: user?.name,
              image: user?.image,
              email: user?.email,
            }}
          />
        </div>
      </header>
      <div className="container grid flex-1 gap-12 md:grid-cols-[200px_1fr]">
        <aside className="hidden w-[200px] flex-col md:flex">
          <Nav items={dashboardConfig.sidebarNav} />
        </aside>
        <main className="flex w-full flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
      <SiteFooter className="border-t" />
    </div>
  )
}