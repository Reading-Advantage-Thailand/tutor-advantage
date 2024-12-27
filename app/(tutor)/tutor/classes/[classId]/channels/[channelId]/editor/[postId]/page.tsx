import React from "react"
import { notFound, redirect } from "next/navigation"
import { Post, User } from "@prisma/client"

import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { Editor } from "@/components/editor"

async function getPostForUser(postId: Post["id"], userId: User["id"]) {
  return await db.post.findFirst({
    where: {
      id: postId,
      authorId: userId,
    },
  })
}

interface EditorPageProps {
  params: {
    postId: string
    classId: string
    channelId: string
  }
}

export default async function TutorPostEditorPage({ params }: EditorPageProps) {
  const session = await getCurrentUser()
  const { postId, classId, channelId } = await params

  if (!session) {
    redirect("/login")
  }

  const post = await getPostForUser(postId, session?.id as string)

  if (!post) {
    notFound()
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pb-[10rem]">
      <Editor
        classId={classId}
        channelId={channelId}
        post={{
          id: post.id,
          title: post.title,
          content: post.content,
          published: post.published,
        }}
      />
    </div>
  )
}
