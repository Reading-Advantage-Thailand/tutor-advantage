import * as z from "zod"

export const classCreateSchema = z.object({
  name: z.string().min(3).max(32),
  description: z.string().min(3).max(256),
})