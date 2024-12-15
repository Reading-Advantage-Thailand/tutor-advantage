import React from "react"
import { headers } from "next/headers"

import { env } from "@/env.mjs"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"

type Props = {}

async function getConnections() {
  const initHeaders = await headers()
  const response = await fetch(
    `${env.NEXT_PUBLIC_APP_URL}/api/v1/system/connections?email=boss4848988@gmail.com`,
    {
      headers: initHeaders,
    }
  )
  const data = await response.json()
  console.log("data", data)
  return data
}

async function createRootInvite() {
  const user = await getCurrentUser()
  const userDb = await db.user.findUnique({
    where: {
      email: user?.email!,
    },
  })
  const inviteCode = await db.invitation.create({
    data: {
      code: "555555",
      inviterId: userDb?.id!,
    },
  })
  return inviteCode
}

export default async function ConnectionsPage({}: Props) {
  const connections = await getConnections()
  // console.log("connections", connections)
  // const inviteCode = await createRootInvite()
  // console.log("inviteCode", inviteCode)
  return <code>{JSON.stringify(connections, null, 2)}</code>
  // return <TreeComponent data={data} />
}
