import { z } from "zod"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

const routeContextSchema = z.object({
  params: z.object({
    code: z.string(),
  }),
})

// accept invite
export async function POST(req: NextResponse, context: z.infer<typeof routeContextSchema>) {
  try {
    const params = await context.params
    const session = await auth()

    if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    const userId = session.user.id
    const invitationCode = params.code

    const invitation = await db.invitation.findUnique({
      where: { code: invitationCode },
      include: {
        inviter: true,
      },
    })

    if (!invitation) return NextResponse.json({ message: "Invitation not found" }, { status: 404 })
    if (userId === invitation.inviterId) return NextResponse.json({ message: "You cannot accept your own invitation" }, { status: 400 })
    if (invitation.status !== "PENDING") return NextResponse.json({ message: "Invitation already accepted" }, { status: 400 })

    const existingUser = await db.user.findUnique({
      where: { id: userId },
    })
    console.log(existingUser)

    if (existingUser?.parentId) return NextResponse.json({ message: "You have already accepted an invitation" }, { status: 400 })
    await db.user.update({
      where: { id: userId },
      data: {
        parentId: invitation.inviterId,
      },
    })
    await db.invitation.update({
      where: { code: invitationCode },
      data: {
        status: "ACCEPTED",
        recipient: { connect: { id: userId } },
      },
    })
    return NextResponse.json({ message: "Invitation accepted" })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(error.errors, { status: 400 })
    }

    console.error(error) // Log error for debugging
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

// get invite details
export async function GET(req: NextResponse, context: z.infer<typeof routeContextSchema>) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const params = await context.params
    console.log(params)
    const invite = await db.invitation.findUnique({
      where: { code: params.code },
      include: { inviter: true },
    })

    if (!invite) return NextResponse.json(null, { status: 404 })

    return NextResponse.json({
      id: invite.id,
      code: invite.code,
      inviter: {
        name: invite.inviter.name,
        image: invite.inviter.image,
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(error.errors, { status: 400 })
    }

    console.error(error) // Log error for debugging
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}