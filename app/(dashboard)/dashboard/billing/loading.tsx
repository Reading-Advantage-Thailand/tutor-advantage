import { CardSkeleton } from "@/components/card-skeleton"
import { Header } from "@/components/header"
import { Shell } from "@/components/shell"

export default function DashboardBillingLoading() {
  return (
    <Shell>
      <Header
        heading="Billing"
        text="Manage billing and your subscription plan."
      />
      <div className="grid gap-10">
        <CardSkeleton />
      </div>
    </Shell>
  )
}
