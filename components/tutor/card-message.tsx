import React from "react"

import { formatDate } from "@/lib/utils"

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Card, CardContent, CardFooter, CardHeader } from "../ui/card"

export interface Reaction {
  type: string
  count: number
}

export interface CardMessageProps {
  data: {
    from: {
      name: string
      avatar: string
    }
    createdAt: string
    message: string
    videoUrl?: string
    reactions: Reaction[]
  }
}

export default function CardMessage({ data }: CardMessageProps) {
  return (
    <Card className="max-w-3xl mx-auto w-full">
      <CardHeader className="flex flex-row items-center">
        <div className="flex items-center space-x-4">
          <Avatar>
            <AvatarImage src="/avatars/01.png" alt="Image" />
            <AvatarFallback>{data.from.name}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium leading-none">{data.from.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatDate(data.createdAt)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{data.message}</p>
        {data.videoUrl && (
          <iframe
            src={data.videoUrl}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="rounded-lg shadow-md w-full h-96 mt-4"
          ></iframe>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        {data.reactions?.map((reaction, index) => (
          <div
            key={index}
            className="text-sm bg-muted px-2 py-1 rounded-md text-muted-foreground flex items-center gap-1"
          >
            <span role="img" aria-label={reaction.type}>
              {reaction.type === "cool"
                ? "😎"
                : reaction.type === "love"
                  ? "😍"
                  : ""}
            </span>
            {reaction.count}
          </div>
        ))}
      </CardFooter>
    </Card>
  )
}
