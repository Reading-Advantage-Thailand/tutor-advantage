import React from "react"
import { notFound } from "next/navigation"

import { getClassInviteInfo } from "@/lib/fetchers/get-class-invite-info"
import ClassJoinButton from "@/components/onboarding/class-join-button"
import { UserAvatar } from "@/components/user-avatar"

type SearchParams = { [key: string]: string | string[] | undefined }

export default async function JoinPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const search = await searchParams
  const inviteInfo = await getClassInviteInfo({ code: search.id as string })
  if (!search.id || !inviteInfo) notFound()
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 text-center sm:w-[350px]">
        <div className="flex justify-center">
          <UserAvatar
            user={{
              image: inviteInfo?.tutor.image,
              name: inviteInfo?.tutor.name,
            }}
          />
        </div>
        <div className="flex flex-col space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="text-blue-400">{inviteInfo?.tutor.name}</span>{" "}
            ได้เชิญคุณเข้าร่วมห้องเรียน {inviteInfo?.name}
          </h1>
          <ClassJoinButton code={search.id as string} />
        </div>
      </div>
    </div>
  )
}
