// import { db } from "@/lib/db";
// import { requireAuth } from "@/middleware/auth";
// import { Role } from "@prisma/client";
// import { z } from "zod";

// // eslint-disable-next-line @typescript-eslint/no-unused-vars
// const routeContextSchema = z.object({
//   params: z.object({
//     classId: z.string(),
//     channelId: z.string(),
//   }),
// })

// // get channel
// export async function GET(
//   req: Request,
//   context: z.infer<typeof routeContextSchema>
// ) {
//   try {
//     const params = await context.params
//     const session = await requireAuth([Role.TUTOR, Role.SYSTEM])

//     const channelId = params.channelId
//     const classId = params.classId

//     // get channel
//     const channel = await db.channel.findFirst({
//       where: {
//         id: channelId,
//         classId: classId,
//       },
//     })

//     if (!channel) {
//       return new Response("Channel not found", { status: 404 })
//     }


//   } catch (error) {
//     console.error(error)
//     return new Response("Internal Server Error", { status: 500 })
//   }
// }