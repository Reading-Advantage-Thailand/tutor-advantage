"use client"

import React, { useRef, useState } from "react"
import * as Ably from "ably"
import { AblyProvider, ChannelProvider, useChannel } from "ably/react"
import { useSession } from "next-auth/react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PostCreateButton } from "@/components/post-create-button"
import CardMessage from "@/components/tutor/card-message"
import FloatingInputMessage from "@/components/tutor/floating-input-message"

export default function ClassesProvider() {
  const { data } = useSession()
  const client = new Ably.Realtime({
    authUrl: "/api/v1/token",
    authMethod: "POST",
  })

  return (
    <AblyProvider client={client}>
      <ChannelProvider channelName="status-updates">
        <div className="flex flex-col gap-6">
          <Card className="max-w-3xl mx-auto w-full">
            <CardHeader>
              <CardTitle>ดูเหมือนว่าจะยังไม่มีโพสต์ใดๆในช่องนี้</CardTitle>
              <CardDescription>
                เริ่มสนทนาด้วยการสร้างโพสต์แรกของคุณ
                และเริ่มสนทนากับผู้เรียนของคุณ ในช่องนี้
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PostCreateButton />
            </CardContent>
          </Card>
          <Messages />
          <FloatingInputMessageClasses
            user={{
              name: data?.user?.name || "S",
              avatar: data?.user?.image || "/avatars/system.jpg",
            }}
          />
        </div>
      </ChannelProvider>
    </AblyProvider>
  )
}

interface Log {
  name: string | undefined
  user: {
    name: string
    avatar: string
  }
  text: any // eslint-disable-line @typescript-eslint/no-explicit-any
  time: string
}

function Messages() {
  const [logs, setLogs] = useState<Log[]>([])
  const notificationSound = useRef(
    new Audio(
      "https://audio-previews.elements.envatousercontent.com/files/472198703/preview.mp3"
    )
  ) 

  useChannel("status-updates", (message) => {
    setLogs((prev) => [
      ...prev,
      {
        user: {
          avatar: message.data.from.avatar,
          name: message.data.from.name,
        },
        name: message.name,
        text: message.data.text,
        time: new Date().toISOString(),
      },
    ])

    // Play the notification sound
    notificationSound.current.play().catch((err) => {
      console.error("Failed to play notification sound:", err)
    })
  })

  return (
    <div className="flex flex-col gap-4">
      {logs.map((log, index) => (
        <CardMessage
          key={index}
          data={{
            from: { name: log.user.name, avatar: log.user.avatar },
            createdAt: log.time,
            message: log.text,
            reactions: [],
          }}
        />
      ))}
    </div>
  )
}

function FloatingInputMessageClasses({
  user,
}: {
  user: { name: string; avatar: string }
}) {
  const [messageText, setMessageText] = useState("")
  const { channel } = useChannel("status-updates")

  const sendMessage = () => {
    if (messageText.trim() === "") return
    channel.publish("update-from-client", {
      text: messageText,
      from: {
        name: user.name,
        avatar: user.avatar,
      },
    })
    setMessageText("")
  }

  return (
    <FloatingInputMessage
      value={messageText}
      onChange={(e) => setMessageText(e.target.value)}
      onSend={sendMessage}
    />
  )
}
