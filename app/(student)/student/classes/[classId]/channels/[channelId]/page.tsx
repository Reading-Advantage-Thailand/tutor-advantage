import React from "react"

type Props = {
  params: Promise<{ classId: string; channelId: string }>
}

export default function StudentClassChannelPage({ params }: Props) {
  return <div>StudentClassChannelPage {JSON.stringify(params)}</div>
}
