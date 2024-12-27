import React from "react"

import CardMessage, { CardMessageProps } from "@/components/tutor/card-message"

const data: CardMessageProps["data"] = {
  from: {
    name: "shadcn",
    avatar: "/avatars/shadcn.jpg",
  },
  createdAt: "2021-09-23T12:00:00Z",
  message: "ดูวิดีโอสอนเพื่อเรียนรู้วิธีการใช้งานเบื้องต้น...",
  videoUrl: "https://www.youtube.com/embed/yKNxeF4KMsY?si=ArBPKw1OshJESs6D", // Video URL
  reactions: [
    { type: "cool", count: 22 },
    { type: "love", count: 22 },
  ],
}

export default function TutorClassesPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pb-[10rem]">
      <CardMessage data={data} />
    </div>
  )
}
