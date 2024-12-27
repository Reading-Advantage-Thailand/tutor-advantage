import { env } from "@/env.mjs"
import { db } from "@/lib/db"
import { postPatchSchema } from "@/lib/validations/post"
import { requireAuth } from "@/middleware/auth"
import { HttpError } from "@/middleware/http-error"
import { Role } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

// edit post
const routeContextSchema = z.object({
  params: z.object({
    classId: z.string(),
    channelId: z.string(),
    postId: z.string(),
  }),
})

// update a post
export async function PATCH(req: NextRequest, context: z.infer<typeof routeContextSchema>) {
  try {
    const { params } = routeContextSchema.parse({ params: await context.params })
    const { user } = await requireAuth([Role.TUTOR, Role.SYSTEM])
    const body = postPatchSchema.parse(await req.json())

    // check user is owner of the post
    const post = await db.post.findFirst({
      where: {
        id: params.postId,
        authorId: user?.id as string,
      },
    })
    if (!post) throw new HttpError("Unauthorized", 401)

    const updatedPost = await db.post.update({
      where: {
        id: params.postId,
      },
      data: {
        title: body.title,
        content: body.content,
        published: body.isPublished,
      },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            name: true,
            image: true,
          }
        }
      },
    })

    if (body.isPublished) {
      fetch(`${env.NEXT_PUBLIC_APP_URL}/api/v1/publish`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(updatedPost),
      })
    }

    return NextResponse.json({ message: "Post updated successfully" })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues }, { status: 422 })
    }
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// delete a post
export async function DELETE(req: NextRequest, context: z.infer<typeof routeContextSchema>) {
  try {
    const { params } = routeContextSchema.parse({ params: await context.params })
    const { user } = await requireAuth([Role.TUTOR, Role.SYSTEM])

    // check user is owner of the post
    const post = await db.post.findFirst({
      where: {
        id: params.postId,
        authorId: user?.id as string,
      },
    })
    if (!post) throw new HttpError("Unauthorized", 401)

    await db.post.delete({
      where: {
        id: params.postId,
      },
    })

    return NextResponse.json({ message: "Post deleted successfully" })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues }, { status: 422 })
    }
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
