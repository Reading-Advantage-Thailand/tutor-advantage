import React from "react"

import { InviteForm } from "@/components/onboarding/invite-form"

export default async function InvitePage() {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            กรุณาใส่รหัสเชิญ
          </h1>
          <p className="text-muted-foreground text-sm">
            กรุณาใส่รหัสเชิญที่คุณได้รับจากครูเพื่อเข้าร่วมทีม
          </p>
        </div>
        <InviteForm />
      </div>
    </div>
  )
}
