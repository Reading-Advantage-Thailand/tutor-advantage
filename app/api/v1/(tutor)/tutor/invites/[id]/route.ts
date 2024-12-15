import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const routeContextSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
})

// delete invite
export async function DELETE(req: NextRequest, context: z.infer<typeof routeContextSchema>) {
  try {
    const params = await context.params
    const session = await auth()
    if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const inviteId = params.id
    const invite = await db.invitation.findFirst({
      where: {
        id: inviteId,
        inviterId: session.user.id as string,
      },
    });
    if (!invite) return NextResponse.json({ message: "Invite not found" }, { status: 404 });
    if (invite.status !== "PENDING") return NextResponse.json({ message: "Invite is not pending" }, { status: 400 });
    await db.invitation.delete({
      where: {
        id: inviteId,
      },
    });
    return NextResponse.json({})
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(error.errors, { status: 400 })
    }

    console.error(error) // Log error for debugging
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
