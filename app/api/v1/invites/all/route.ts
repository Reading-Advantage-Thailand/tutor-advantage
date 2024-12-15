import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

// get all
export async function GET(req: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return new Response(null, { status: 401 })
    }

    const children = await db.user.findMany({
      where: {
        parentId: session.user.id,
      },
      select: {
        name: true,
      },
    })

    return NextResponse.json(children)

  } catch (error) {
    console.error(error)
    return new Response(null, { status: 500 })
  }
}
