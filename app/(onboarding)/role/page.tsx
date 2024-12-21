import React from "react"
import { redirect } from "next/navigation"

import { siteConfig } from "@/config/site"
import { getCurrentUser } from "@/lib/session"
import RoleSwitcher from "@/components/switchers/role-switcher"

export default async function RoleSelectionPage() {
  const user = await getCurrentUser()
  if (!user) return redirect("/login")

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            ยินดีต้อนรับเข้าสู่ {siteConfig.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            เริ่มต้นด้วยการเลือกบทบาทของคุณ
          </p>
        </div>
      </div>
      <RoleSwitcher userId={user?.id ?? ""} role={user?.role} />
    </div>
  )
}
