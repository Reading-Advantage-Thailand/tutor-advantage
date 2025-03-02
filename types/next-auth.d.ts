import { Role } from "@prisma/client"
import { DefaultSession, DefaultUser } from "next-auth"
import { AdapterUser as NextAuthAdapterUser } from "next-auth/adapters"

declare module "next-auth" {
  interface User extends DefaultUser {
    role?: Role
    parentId?: string
  }

  interface Session extends DefaultSession {
    user?: User
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser extends NextAuthAdapterUser {
    role?: Role
    parentId?: string
  }
}
