import { z } from "zod"
import { db } from "@/lib/db"
import { userRoleSchema } from "@/lib/validations/user"
import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const routeContextSchema = z.object({
  params: z.object({
    userId: z.string(),
  }),
})

export async function PATCH(
  req: NextRequest,
  context: z.infer<typeof routeContextSchema>
) {
  try {
    const params = await context.params
    const session = await auth()

    if (!session?.user || params.userId !== session?.user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const payload = userRoleSchema.parse(body)

    await db.user.update({
      where: {
        id: session.user.id,
      },
      data: {
        role: payload.role,
      },
    })

    return NextResponse.json({ role: payload.role }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(error.errors, { status: 400 })
    }
    return NextResponse.error()
  }
}