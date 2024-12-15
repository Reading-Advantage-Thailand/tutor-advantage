import { z } from "zod"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

const routeContextSchema = z.object({
  params: z.object({
    inviteId: z.string(),
  }),
})

// accept invite
export async function POST(req: Request, context: z.infer<typeof routeContextSchema>) {
  try {
    const params = await context.params
    const session = await auth()

    if (!session?.user) {
      return new Response(null, { status: 401 })
    }

    const userId = session.user.id
    const invitationCode = params.inviteId

    const invitation = await db.invitation.findUnique({
      where: { code: invitationCode },
      include: {
        inviter: true,
      },
    })

    if (!invitation) {
      return new Response("Invitation not found", { status: 404 })
    }

    if (userId === invitation.inviterId) {
      return NextResponse.json({
        message: "You cannot accept your own invitation",
      }, { status: 400 })
    }

    const existingUser = await db.user.findUnique({
      where: { id: userId },
    })

    if (existingUser?.parentId) {
      return NextResponse.json({
        message: "You have already accepted an invitation",
      }, { status: 400 })
    }

    await db.user.update({
      where: { id: userId },
      data: {
        parentId: invitation.inviterId,
      },
    })

    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify(error.errors), { status: 400 })
    }

    console.error(error) // Log error for debugging
    return new Response("Internal Server Error", { status: 500 })
  }
}

// get invite details
export async function GET(
  req: Request,
  context: z.infer<typeof routeContextSchema>
) {
  try {
    const params = await context.params
    const invite = await db.invitation.findUnique({
      where: { code: params.inviteId },
      include: { inviter: true },
    })

    if (!invite) {
      return NextResponse.json(null, { status: 404 })
    }

    return NextResponse.json({
      id: invite.id,
      code: invite.code,
      inviter: {
        name: invite.inviter.name,
        image: invite.inviter.image,
      }
    })
  } catch (error) {
    return new Response(null, { status: 500 })
  }
}

