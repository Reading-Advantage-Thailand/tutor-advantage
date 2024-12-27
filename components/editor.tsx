"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import EditorJS from "@editorjs/editorjs"
import { zodResolver } from "@hookform/resolvers/zod"
import { Post } from "@prisma/client"
import { MoreHorizontal } from "lucide-react"
import { useForm } from "react-hook-form"
import TextareaAutosize from "react-textarea-autosize"
import * as z from "zod"

import { cn, formatDate } from "@/lib/utils"
import { postPatchSchema } from "@/lib/validations/post"
import { toast } from "@/hooks/use-toast"
import { Button, buttonVariants } from "@/components/ui/button"
import { Icons } from "@/components/icons"

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Badge } from "./ui/badge"
import { Card, CardContent, CardFooter, CardHeader } from "./ui/card"

interface EditorProps {
  post: Pick<Post, "id" | "title" | "content" | "published">
  classId: string
  channelId: string
}

type FormData = z.infer<typeof postPatchSchema>

export function Editor({ post, classId, channelId }: EditorProps) {
  const { register, handleSubmit } = useForm<FormData>({
    resolver: zodResolver(postPatchSchema),
  })
  const ref = React.useRef<EditorJS | null>(null)
  const router = useRouter()
  // const { channel } = useChannel("status-updates")
  const [isSaving, setIsSaving] = React.useState<boolean>(false)
  const [isPublished, setIsPublished] = React.useState<boolean>(post.published)
  const [isMounted, setIsMounted] = React.useState<boolean>(false)

  const initializeEditor = React.useCallback(async () => {
    const EditorJS = (await import("@editorjs/editorjs")).default
    const Header = (await import("@editorjs/header")).default
    const Embed = (await import("@editorjs/embed")).default
    const Table = (await import("@editorjs/table")).default
    const List = (await import("@editorjs/list")).default
    const Code = (await import("@editorjs/code")).default
    const LinkTool = (await import("@editorjs/link")).default
    const InlineCode = (await import("@editorjs/inline-code")).default

    const body = postPatchSchema.parse(post)

    if (!ref.current) {
      const editor = new EditorJS({
        holder: "editor",
        onReady() {
          ref.current = editor
        },
        placeholder: "พิมพ์เนื้อหาของคุณที่นี่",
        inlineToolbar: true,
        data: body.content,
        tools: {
          header: Header,
          linkTool: LinkTool,
          list: List,
          code: Code,
          inlineCode: InlineCode,
          table: Table,
          embed: Embed,
        },
      })
    }
  }, [post])

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMounted(true)
    }
  }, [])

  React.useEffect(() => {
    if (isMounted) {
      initializeEditor()

      return () => {
        ref.current?.destroy()
        ref.current = null
      }
    }
  }, [isMounted, initializeEditor])

  async function onSubmit(data: FormData) {
    setIsSaving(true)

    const blocks = await ref.current?.save()

    const response = await fetch(
      `/api/v1/classes/${classId}/channels/${channelId}/posts/${post.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          title: data.title,
          content: blocks,
          isPublished: isPublished,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }
    )

    setIsSaving(false)

    if (!response?.ok) {
      return toast({
        title: "Something went wrong.",
        description: "Your post was not saved. Please try again.",
        variant: "destructive",
      })
    }

    router.refresh()

    return toast({
      description: "Your post has been saved.",
    })
  }

  if (!isMounted) {
    return null
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-3xl mx-auto w-full"
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <Badge variant="secondary">
            {isPublished ? "โพสต์" : "ฉบับร่าง"}
          </Badge>
          <Button
            disabled
            variant="ghost"
            size="icon"
            className="data-[state=open]:bg-accent size-7"
          >
            <MoreHorizontal />
          </Button>
        </CardHeader>
        <CardContent>
          <TextareaAutosize
            autoFocus
            id="title"
            defaultValue={post.title}
            placeholder="หัวข้อโพสต์"
            className="w-full resize-none appearance-none overflow-hidden bg-transparent text-5xl font-bold focus:outline-none"
            {...register("title")}
          />
          <div id="editor" className="min-h-[200px]" />
        </CardContent>
        <CardFooter>
          <div className="flex items-center space-x-4">
            <Avatar>
              <AvatarImage src="/avatars/01.png" alt="Image" />
              <AvatarFallback>P</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium leading-none">
                Passakorn Puttama
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDate(new Date().toISOString())}
              </p>
            </div>
          </div>
        </CardFooter>
      </Card>
      <div className="flex w-full items-center justify-between mt-4 mb-10">
        <p className="text-sm text-gray-500 ">
          ใช้{" "}
          <kbd className="rounded-md border bg-muted px-1 text-xs uppercase">
            Tab
          </kbd>{" "}
          ขึ้นบรรทัดใหม่
        </p>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isSaving}
            className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}
          >
            {isSaving && <Icons.spinner className="h-4 w-4 animate-spin" />}
            <span>บันทึกฉบับร่าง</span>
          </button>
          <button
            className={cn(buttonVariants({ size: "sm" }))}
            onClick={() => setIsPublished(true)}
            type="submit"
            disabled={isSaving}
          >
            {isSaving && <Icons.spinner className="h-4 w-4 animate-spin" />}
            <span>โพสต์</span>
          </button>
        </div>
      </div>
    </form>
  )
}
