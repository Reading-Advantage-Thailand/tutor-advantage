import { redirect } from "next/navigation"
import { Role } from "@prisma/client"

import { dashboardConfig } from "@/config/dashboard-config"
import { getCurrentUser } from "@/lib/session"
import { MainNav } from "@/components/shared/main-nav"
import { UserAccountNav } from "@/components/shared/user-account-nav"

interface OnBoardingLayoutProps {
  children?: React.ReactNode
}
export default async function OnBoardingLayout({
  children,
}: OnBoardingLayoutProps) {
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  // if (user?.parentId != null) return redirect("/tutor/classes")

  return (
    <div className="flex min-h-screen flex-col space-y-6 overflow-x-hidden">
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
      <main className="flex-1 flex flex-col items-center justify-center overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
