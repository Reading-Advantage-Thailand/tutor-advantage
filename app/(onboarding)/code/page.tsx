import React from "react"
import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { env } from "@/env.mjs"
import InviteButton from "@/components/onboarding/invite-button"
import { UserAvatar } from "@/components/user-avatar"

type SearchParams = { [key: string]: string | string[] | undefined }
type InviteInfoResponse = {
  id: string
  inviter: {
    name: string
    image: string
  }
}
async function getInviteInfo(code: string): Promise<InviteInfoResponse> {
  const response = await fetch(
    `${env.NEXT_PUBLIC_APP_URL}/api/v1/tutor/code/${code}`,
    { headers: await headers() }
  )
  if (!response.ok) notFound()
  const data = await response.json()
  return data
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const search = await searchParams
  if (!search.id) notFound()
  const inviteInfo = await getInviteInfo(search.id as string)

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 text-center sm:w-[350px]">
        <div className="flex justify-center">
          <UserAvatar
            user={{
              image: inviteInfo.inviter.image,
              name: inviteInfo.inviter.name,
            }}
          />
        </div>
        <div className="flex flex-col space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="text-blue-400">{inviteInfo.inviter.name}</span>{" "}
            ได้เชิญคุณเข้าร่วมทีม
          </h1>
          <InviteButton code={search.id as string} />
        </div>
      </div>
    </div>
  )
}
