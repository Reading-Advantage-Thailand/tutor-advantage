"use client"

import React, { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import * as Ably from "ably"
import { AblyProvider, ChannelProvider, useChannel } from "ably/react"
import { Eye } from "lucide-react"
import { useSession } from "next-auth/react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PostCreateButton } from "@/components/post-create-button"
import { PostItem } from "@/components/post-item"
import CardPost, { CardPostProps } from "@/components/tutor/card-post"
import FloatingInputMessage from "@/components/tutor/floating-input-message"

export default function ClassesProvider() {
  const { data } = useSession()
  const params = useParams()
  const { classId, channelId } = params
  const client = new Ably.Realtime({
    authUrl: "/api/v1/token",
    authMethod: "POST",
  })
  const [unPublishedPosts, setUnPublishedPosts] = useState<CardPostProps[]>([])

  useEffect(() => {
    async function fetchUnpublishedPosts() {
      const response = await fetch(
        `/api/v1/classes/${classId}/channels/${channelId}/posts?published=false`
      )
      const data = await response.json()
      setUnPublishedPosts(
        data.map((post) => ({
          post: {
            id: post.id,
            title: post.title,
            content: post.content,
            createdAt: post.createdAt,
          },
        }))
      )
    }
    fetchUnpublishedPosts()
  }, [classId, channelId])

  return (
    <AblyProvider client={client}>
      <ChannelProvider channelName="status-updates">
        <div className="flex flex-1 flex-col gap-4 p-4 pb-[10rem]">
          <Card className="max-w-3xl mx-auto w-full bg-background">
            <CardHeader>
              <Badge variant="secondary" className="mb-2 w-[fit-content]">
                <Eye className="size-4 mr-2" />
                เห็นเฉพาะคุณ
              </Badge>
              <CardTitle>จัดการช่องสื่อสาร</CardTitle>
              <CardDescription>
                สร้างหรือลบช่องสื่อสารของคุณ และเริ่มสนทนากับนักเรียน
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unPublishedPosts.length > 0 && (
                <div className="divide-y divide-border rounded-md border mb-8 ">
                  {unPublishedPosts.map((item, index) => (
                    <PostItem key={index} post={item.post} />
                  ))}
                </div>
              )}
              <PostCreateButton
                classId={classId as string}
                channelId={channelId as string}
              />
            </CardContent>
          </Card>
          <Messages
            classId={classId as string}
            channelId={channelId as string}
          />
          {/* <FloatingInputMessageClasses
            user={{
              name: data?.user?.name || "S",
              avatar: data?.user?.image || "/avatars/system.jpg",
            }}
          /> */}
        </div>
      </ChannelProvider>
    </AblyProvider>
  )
}

function Messages({
  classId,
  channelId,
}: {
  classId: string
  channelId: string
}) {
  const [logs, setLogs] = useState<CardPostProps[]>([])
  const notificationSound = useRef(
    new Audio(
      "https://audio-previews.elements.envatousercontent.com/files/472198703/preview.mp3"
    )
  )

  useEffect(() => {
    const fetchPreviousMessages = async () => {
      try {
        const response = await fetch(
          `/api/v1/classes/${classId}/channels/${channelId}/posts`
        )
        const data = await response.json()
        const formattedLogs = data.map((post) => ({
          post: {
            id: post.id,
            title: post.title,
            content: post.content,
            createdAt: post.createdAt,
          },
          author: {
            id: post.author.id,
            name: post.author.name ?? "",
            avatar: post.author.image,
          },
        }))
        console.log("formattedLogs", formattedLogs)
        setLogs(formattedLogs)
      } catch (error) {
        console.error("Failed to fetch messages:", error)
      }
    }

    fetchPreviousMessages()
  }, [classId, channelId])

  useChannel("status-updates", (message) => {
    notificationSound.current.play().catch((err) => {
      console.error("Failed to play notification sound:", err)
    })
    setLogs((prev) => [
      ...prev,
      {
        post: {
          id: message.data.id,
          title: message.data.title,
          content: message.data.content,
          channelId: channelId,
          published: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          authorId: "unknown-author",
        },
        author: {
          name: message.data.author.name || "Unknown",
          avatar: message.data.author.image || "/avatars/default.jpg",
        },
      },
    ])
  })

  return logs.map((log, index) => (
    <CardPost key={index} post={log.post} author={log.author} />
  ))
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
      isRightSidebarOpen={true}
    />
  )
}
