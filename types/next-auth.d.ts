import "next-auth"

type UserId = string

declare module "next-auth/jwt" {
  interface JWT {
    id: UserId
    role: "tutor" | "student"
  }
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: "tutor" | "student"
    } & DefaultSession["user"]
  }
}
