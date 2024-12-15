import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "./db"
import { env } from "../env.mjs"
import NextAuth from "next-auth"
import { InvitationStatus, Role } from "@prisma/client"
import { redirect } from "next/dist/server/api-utils"

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
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.role = user.role;
      }
      return session;
    },
  },
  // events: {
  //   async createUser(message) {
  //     const user = message.user;
  //     if (user.email && user.id) {
  //       const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  //       const inviter = await db.user.findUnique({
  //         where: { email: user.email },
  //       });

  //       if (inviter) {
  //         await db.invitation.create({
  //           data: {
  //             code: inviteCode,
  //             inviterId: inviter.id,
  //           },
  //         });
  //         console.log("createUser", message);
  //       } else {
  //         console.error("Inviter not found.");
  //       }
  //     } else {
  //       console.error("Invalid user data: email or id is missing.");
  //     }
  //   }
  // }
})
