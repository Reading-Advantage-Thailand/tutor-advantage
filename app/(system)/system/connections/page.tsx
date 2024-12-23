import React from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { env } from "@/env.mjs"
import { getCurrentUser } from "@/lib/session"

async function fetchConnections(email: string) {
  try {
    const response = await fetch(
      `${env.NEXT_PUBLIC_APP_URL}/api/v1/system/connections?email=${email}`,
      { headers: await headers() }
    )
    if (!response.ok) throw new Error(`Failed to fetch connections`)
    return await response.json()
  } catch (error) {
    console.error("Failed to fetch connections:", error)
    return { error: "Failed to fetch connections." }
  }
}

export default async function page() {
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  const connections = await fetchConnections(user.email ?? "")
  return (
    <div>
      <h1 className="px-2 py-2 border-y text-muted-foreground">
        Connections Overview
      </h1>
      <pre className="block whitespace-pre-wrap p-4 bg-background text-sm shadow-inner overflow-x-auto border-b">
        {JSON.stringify(connections, null, 2)}
      </pre>
    </div>
  )
}
