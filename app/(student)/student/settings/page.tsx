import { redirect } from "next/navigation"
import { getCurrentUser } from '@/lib/session'
import { DashboardHeader } from "@/components/shared/header"
import { UserNameForm } from "@/components/shared/user-name-form"
import { DashboardShell } from "@/components/shared/shell"

export const metadata = {
  title: "Settings",
  description: "Manage account and website settings.",
}

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Settings"
        text="Manage account and website settings."
      />
      <div className="grid gap-10">
        <UserNameForm user={{ id: user?.id || "", name: user?.name || "" }} />
      </div>
    </DashboardShell>
  )
}