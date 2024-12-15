import React from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { env } from "@/env.mjs"
import { getCurrentUser } from "@/lib/session"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { InviteCreateButton } from "@/components/shared/buttons/invite-create-button"
import { DashboardHeader } from "@/components/shared/header"
import { DashboardShell } from "@/components/shared/shell"

import { Invite } from "./invite-columns"
import { InviteDataTable } from "./invite-data-table"

export const metadata = {
  title: "Invites",
  description: "Invite tutors",
}

async function getInvites(): Promise<Invite[]> {
  const initHeaders = await headers()
  const response = await fetch(
    `${env.NEXT_PUBLIC_APP_URL}/api/v1/tutor/invites`,
    { headers: initHeaders, cache: "no-cache" }
  )
  if (!response.ok) throw new Error("Failed to get invites")
  return await response.json()
}

export default async function InvitesPage() {
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  const invites = await getInvites()

  return (
    <DashboardShell>
      <DashboardHeader heading="คำเชิญ" text="เชิญครูเข้าร่วมทีมของคุณ" />
      <div className="grid gap-10">
        <Card>
          <CardHeader>
            <CardTitle>สมาชิกในเครือข่ายของคุณ</CardTitle>
            <CardDescription>
              คุณสามารถเชิญครูที่คุณต้องการเพื่อเข้าร่วมทีมของคุณ
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <InviteCreateButton variant="outline" />
          </CardContent>
        </Card>
      </div>
      <InviteDataTable data={invites} />
    </DashboardShell>
  )
}
