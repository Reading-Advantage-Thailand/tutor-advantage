import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

// get invites
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const data = await db.invitation.findMany({
      where: {
        inviterId: session.user.id as string,
      },
      select: {
        id: true,
        code: true,
        status: true,
        createdAt: true,
        recipient: {
          select: {
            email: true,
          },
        }
      },
    });
    const invites = data.map((invite) => {
      return {
        id: invite.id,
        code: invite.code,
        status: invite.status,
        createdAt: invite.createdAt,
        email: invite?.recipient?.email,
      }
    })
    console.log(invites)
    return NextResponse.json(invites);
  } catch (error) {
    console.error(error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// create invite
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    // const connection = await getUserConnection(session.user.id as string);
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await db.invitation.create({
      data: {
        code: inviteCode,
        inviterId: session.user.id as string,
      },
    });
    return NextResponse.json({ code: inviteCode });
  } catch (error) {
    console.error(error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}