import React from "react"
import Link from "next/link"
import { Post } from "@prisma/client"
import { Archive, MoreHorizontal, PenBox, Trash } from "lucide-react"

import { formatDate } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "../ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"

export type CardPostProps = {
  post: Post & {
    content: {
      time: number
      blocks: Block[]
    }
  }
  author: {
    name: string
    avatar: string
  }
}

export type Block = {
  id: string
  type: string
  data: {
    text?: string
    style?: string
    items?: string[]
    link?: string
    meta?: Record<string, string>
  }
}

async function deletePost(postId: string) {
  const response = await fetch(`/api/posts/${postId}`, {
    method: "DELETE",
  })

  if (!response?.ok) {
    toast({
      title: "เกิดข้อผิดพลาด",
      description: "โพสต์ของคุณไม่ได้ถูกลบ กรุณาลองใหม่อีกครั้ง",
      variant: "destructive",
    })
  }

  return true
}

export default function CardPost({ post, author }: CardPostProps) {
  return (
    <Card className="max-w-3xl mx-auto w-full">
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <Badge variant="secondary">โพสต์</Badge>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button
              variant="ghost"
              size="icon"
              className="data-[state=open]:bg-accent size-7"
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <Link href={`${window.location.pathname}/editor/${post.id}`}>
              <DropdownMenuItem className="cursor-pointer">
                <PenBox />
                แก้ไขโพสต์
              </DropdownMenuItem>
            </Link>
            <DropdownMenuItem className="cursor-pointer" disabled>
              <Archive />
              จัดเก็บโพสต์
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer text-destructive"
              onSelect={(event) => {
                event.preventDefault()
                deletePost(post.id)
              }}
            >
              <Trash />
              ลบโพสต์
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <h1 className="pb-1 w-full resize-none appearance-none overflow-hidden bg-transparent text-5xl font-bold focus:outline-none">
          {post.title}
        </h1>
        {post?.content?.blocks.map((block) => (
          <div key={block.id} className="mb-4">
            {render(block)}
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <div className="flex items-center space-x-4">
          <Avatar>
            <AvatarImage src={author.avatar} alt="Image" />
            <AvatarFallback>{author.name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium leading-none">{author.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatDate(new Date(post.createdAt).toISOString())}
            </p>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}

function render(block: Block) {
  switch (block.type) {
    case "paragraph":
      return (
        <p className="ce-paragraph py-1">
          {block.data.text?.replaceAll("<br>", " ")}
        </p>
      )
    case "list":
      return block.data.style === "ordered" ? (
        <ol className="list-decimal ml-8">
          {block.data.items?.map((item, index) => (
            <li className="pb-2" key={index}>
              {item.replaceAll("<br>", " ")}
            </li>
          ))}
        </ol>
      ) : (
        <ul className="list-disc ml-8">
          {block.data.items?.map((item, index) => (
            <li className="pb-2" key={index}>
              {item.replaceAll("<br/>", " ")}
            </li>
          ))}
        </ul>
      )
    case "linkTool":
      return (
        <a
          href={block.data.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 underline"
        >
          {block.data.link}
        </a>
      )
    default:
      return <div>Unsupported block type: {block.type}</div>
  }
}
