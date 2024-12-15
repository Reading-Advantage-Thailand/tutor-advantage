import React from "react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { siteConfig } from "@/config/site-config"
import RoleSwitcher from "@/components/shared/switcher/role-switcher"
import { Role } from "@prisma/client"
import { getCurrentUser } from "@/lib/session"

export default async function RoleSelectionPage() {
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  
  return (
    <div className="flex flex-col items-center justify-center"> 
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to {siteConfig.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            Choose your role to continue to your account setup process.
          </p>
        </div>
      </div>
      <RoleSwitcher userId={user?.id ?? ""} role={user?.role}  />
    </div>
  )
}
