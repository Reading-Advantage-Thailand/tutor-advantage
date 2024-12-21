import Google from "next-auth/providers/google"
import { db } from "./db"
import { env } from "../env.mjs"
import NextAuth from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { Role } from "@prisma/client"

export const { auth, handlers } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      async profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          role: profile.role ?? Role.GUEST,
        }
      },
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  secret: env.NEXTAUTH_SECRET,
})