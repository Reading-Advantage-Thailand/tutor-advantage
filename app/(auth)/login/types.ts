import { z } from "zod"

import { userAuthSchema } from "./user-auth-schema"

export type UserAuthFormProps = React.HTMLAttributes<HTMLDivElement>
export type FormData = z.infer<typeof userAuthSchema>