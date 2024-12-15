import { z } from "zod"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(
  req: Request,
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return new Response(null, { status: 401 })
    }

    const inviteCode = await db.invitation.findFirst({
      where: {
        inviterId: session.user.id,
      },
    })

    if (!inviteCode) {
      return new Response(null, { status: 404 })
    }

    return NextResponse.json({
      code: inviteCode?.code,
    })
  } catch (error) {
    console.error("error", error)
    if (error instanceof z.ZodError) {
      console.log(error.errors)
      return new Response(JSON.stringify(error.errors), { status: 400 })
    }

    return new Response(null, { status: 500 })
  }
}
