import { CardSkeleton } from "@/components/shared/card-skeleton"
import { DashboardHeader } from "@/components/shared/header"
import { DashboardShell } from "@/components/shared/shell"

export default function DashboardSettingsLoading() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Settings"
        text="Manage account and website settings."
      />
      <div className="grid gap-10">
        <CardSkeleton />
      </div>
    </DashboardShell>
  )
}