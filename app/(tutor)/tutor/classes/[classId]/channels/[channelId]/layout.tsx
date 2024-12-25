import React from "react"
import { SessionProvider } from "next-auth/react"

import { auth } from "@/lib/auth"

type TutorClassProps = {
  children?: React.ReactNode
}

export default async function TutorChannelsLayout({
  children,
}: TutorClassProps) {
  const session = await auth()
  return <SessionProvider session={session}>{children}</SessionProvider>
}
