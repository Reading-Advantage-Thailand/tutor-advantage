import { signIn, SignInResponse } from "next-auth/react"

import { baseError } from "@/lib/base-error"

import { FormData } from "../types"

export async function authSignIn(
  data: FormData,
  searchParams: URLSearchParams
): Promise<SignInResponse | undefined> {
  return signIn("email", {
    email: data.email.toLowerCase(),
    redirect: false,
    callbackUrl: searchParams?.get("from") || "/dashboard",
  }).catch((error) => {
    baseError.global("เกิดข้อผิดพลาด")
    console.error("error signing in:", error)
    return undefined
  })
}