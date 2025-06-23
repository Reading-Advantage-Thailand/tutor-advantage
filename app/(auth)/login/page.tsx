import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"

import { LoginForm } from "./login-form"

export default async function LoginPage() {
  const session = await auth()
  if (session) return redirect("/redirect")
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <LoginForm />
      </div>
    </div>
  )
}
