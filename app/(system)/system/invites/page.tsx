import React from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { env } from "@/env.mjs"
import { getCurrentUser } from "@/lib/session"
import { Invite } from "@/components/invite-columns"
import { InviteDataTable } from "@/components/invite-table-data"

async function fetchInvites(): Promise<Invite[]> {
  const response = await fetch(`${env.NEXT_PUBLIC_APP_URL}/api/v1/invites`, {
    headers: await headers(),
    cache: "no-cache",
  })
  if (!response.ok) throw new Error("Failed to get invites")
  return await response.json()
}

export default async function SystemInvitePage() {
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  const invites = await fetchInvites()

  return <InviteDataTable data={invites} />
}
