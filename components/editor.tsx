"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import EditorJS from "@editorjs/editorjs"
import { zodResolver } from "@hookform/resolvers/zod"
import { Post } from "@prisma/client"
import { useForm } from "react-hook-form"
import TextareaAutosize from "react-textarea-autosize"
import * as z from "zod"

import { cn, formatDate } from "@/lib/utils"
import { postPatchSchema } from "@/lib/validations/post"
import { toast } from "@/hooks/use-toast"
import { buttonVariants } from "@/components/ui/button"
import { Icons } from "@/components/icons"

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Card, CardContent, CardFooter } from "./ui/card"

interface EditorProps {
  post: Pick<Post, "id" | "title" | "content" | "published">
}

type FormData = z.infer<typeof postPatchSchema>

export function Editor({ post }: EditorProps) {
  const { register, handleSubmit } = useForm<FormData>({
    resolver: zodResolver(postPatchSchema),
  })
  const ref = React.useRef<EditorJS | null>(null)
  const router = useRouter()
  const [isSaving, setIsSaving] = React.useState<boolean>(false)
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

    const response = await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: data.title,
        content: blocks,
      }),
    })

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
        <CardContent>
          <TextareaAutosize
            autoFocus
            id="title"
            defaultValue={post.title}
            placeholder="หัวข้อโพสต์"
            className="pt-10 w-full resize-none appearance-none overflow-hidden bg-transparent text-5xl font-bold focus:outline-none"
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
          <button className={cn(buttonVariants({ size: "sm" }))}>
            <span>โพสต์</span>
          </button>
        </div>
      </div>
    </form>
  )

  // return (
  //   <form onSubmit={handleSubmit(onSubmit)}>
  //     <div className="grid w-full gap-10">
  //       <div className="flex w-full items-center justify-between">
  //         <div className="flex items-center space-x-10">
  //           <Link
  //             href="/dashboard"
  //             className={cn(buttonVariants({ variant: "ghost" }))}
  //           >
  //             <>
  //               <Icons.chevronLeft className="mr-2 h-4 w-4" />
  //               Back
  //             </>
  //           </Link>
  //           <p className="text-sm text-muted-foreground">
  //             {post.published ? "Published" : "Draft"}
  //           </p>
  //         </div>
  //         <button type="submit" className={cn(buttonVariants())}>
  //           {isSaving && (
  //             <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
  //           )}
  //           <span>Save</span>
  //         </button>
  //       </div>
  //       <div className="prose prose-stone mx-auto w-[800px] dark:prose-invert">
  //         <TextareaAutosize
  //           autoFocus
  //           id="title"
  //           defaultValue={post.title}
  //           placeholder="Post title"
  //           className="w-full resize-none appearance-none overflow-hidden bg-transparent text-5xl font-bold focus:outline-none"
  //           {...register("title")}
  //         />
  //         <div id="editor" className="min-h-[500px]" />
  //         <p className="text-sm text-gray-500">
  //           Use{" "}
  //           <kbd className="rounded-md border bg-muted px-1 text-xs uppercase">
  //             Tab
  //           </kbd>{" "}
  //           to open the command menu.
  //         </p>
  //       </div>
  //     </div>
  //   </form>
  // )
}
