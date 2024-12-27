import { db } from "@/lib/db";
import { postCreateSchema } from "@/lib/validations/post";
import { requireAuth } from "@/middleware/auth";
import { HttpError } from "@/middleware/http-error";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const routeContextSchema = z.object({
  params: z.object({
    classId: z.string(),
    channelId: z.string(),
  }),
})

// create a post
export async function POST(req: NextRequest, context: z.infer<typeof routeContextSchema>) {
  try {
    const { params } = routeContextSchema.parse({ params: await context.params })
    const { user } = await requireAuth([Role.TUTOR, Role.SYSTEM])
    const body = postCreateSchema.parse(await req.json())

    // check user is a member of the class
    const classMember = await db.classMember.findFirst({
      where: {
        classId: params.classId,
        userId: user?.id as string,
      },
    })
    if (!classMember) throw new HttpError("Unauthorized", 401)

    const post = await db.post.create({
      data: {
        title: body.title,
        content: body.content,
        authorId: user?.id as string,
        channelId: params.channelId,
      },
      select: {
        id: true
      }
    })
    return NextResponse.json(post)
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

// get all posts in a channel
export async function GET(req: NextRequest, context: z.infer<typeof routeContextSchema>) {
  try {
    const { params } = routeContextSchema.parse({ params: await context.params })
    const searchParams = req.nextUrl.searchParams
    const published = searchParams.get("published") || "true"
    const { user } = await requireAuth([Role.TUTOR, Role.SYSTEM])

    // check user is a member of the class
    const classMember = await db.classMember.findFirst({
      where: {
        classId: params.classId,
        userId: user?.id as string,
      },
    })
    if (!classMember) throw new HttpError("Unauthorized", 401)

    const posts = await db.post.findMany({
      where: {
        channelId: params.channelId,
        published: published === "true" ? true : false
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
      orderBy: {
        createdAt: "asc"
      }
    })
    return NextResponse.json(posts)
  } catch (error) {
    console.error("Error getting posts:", error)
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}