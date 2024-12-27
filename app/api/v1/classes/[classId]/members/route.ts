import { db } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import { HttpError } from "@/middleware/http-error";
import { ClassMemberRole, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const routeContextSchema = z.object({
  params: z.object({
    classId: z.string(),
  }),
})

// get class members
export async function GET(
  req: Request,
  context: z.infer<typeof routeContextSchema>
) {
  try {
    const { params } = routeContextSchema.parse({ params: await context.params })
    const { user } = await requireAuth([Role.STUDENT, Role.TUTOR, Role.SYSTEM])

    const classId = params.classId

    // check user is a member of the class
    const classMember = await db.classMember.findFirst({
      where: {
        classId: classId,
        userId: user?.id as string,
      },
    })
    if (!classMember) throw new HttpError("Unauthorized", 401)

    // get class members
    const classMembers = await db.classMember.findMany({
      where: {
        classId: classId,
      },
      select: {
        userId: true,
        role: true,
        user: {
          select: {
            name: true,
            image: true,
          },
        },
      },
    })
    const members = {
      tutors: classMembers.filter((member) => member.role === ClassMemberRole.OWNER || member.role === ClassMemberRole.CO_OWNER),
      students: classMembers.filter((member) => member.role === ClassMemberRole.MEMBER),
    }
    return NextResponse.json(members)
  } catch (error) {
    console.error("Error getting class members:", error)
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
