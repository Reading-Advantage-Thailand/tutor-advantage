import { z } from "zod"
import { db } from "@/lib/db"
import { userRoleSchema } from "@/lib/validations/user"
import { auth } from "@/lib/auth"

const routeContextSchema = z.object({
  params: z.object({
    userId: z.string(),
  }),
})

export async function PATCH(
  req: Request,
  context: z.infer<typeof routeContextSchema>
) {
  try {
    const params = await context.params
    const session = await auth()

    if (!session?.user || params.userId !== session?.user.id) {
      return new Response(null, { status: 401 })
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

    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log(error.errors)
      return new Response(JSON.stringify(error.errors), { status: 400 })
    }

    return new Response(null, { status: 500 })
  }
}
