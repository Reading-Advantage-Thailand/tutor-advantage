import { NextResponse } from "next/server"

export type ErrorResponse = {
  message: string
  status: number
  code: string
}

export const ErrorCode = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
} as const

export const ErrorMessage = {
  [ErrorCode.UNAUTHORIZED]: "คุณไม่มีสิทธิ์เข้าถึงหน้านี้",
  [ErrorCode.FORBIDDEN]: "คุณไม่มีสิทธิ์ในการดำเนินการนี้",
  [ErrorCode.NOT_FOUND]: "ไม่พบข้อมูลที่ต้องการ",
  [ErrorCode.ALREADY_EXISTS]: "คุณมีบทบาทอยู่แล้ว",
  [ErrorCode.INTERNAL_ERROR]: "เกิดข้อผิดพลาดในการดำเนินการ",
  [ErrorCode.VALIDATION_ERROR]: "ข้อมูลไม่ถูกต้อง",
} as const

export function createErrorResponse(
  code: keyof typeof ErrorCode,
  message?: string
): ErrorResponse {
  return {
    message: message || ErrorMessage[code],
    status: getStatusCode(code),
    code,
  }
}

function getStatusCode(code: keyof typeof ErrorCode): number {
  switch (code) {
    case ErrorCode.UNAUTHORIZED:
      return 401
    case ErrorCode.FORBIDDEN:
      return 403
    case ErrorCode.NOT_FOUND:
      return 404
    case ErrorCode.ALREADY_EXISTS:
      return 400
    case ErrorCode.VALIDATION_ERROR:
      return 400
    default:
      return 500
  }
}

export function handleApiError(error: unknown): NextResponse {
  console.error(error)

  if (error instanceof Error) {
    const errorMessage = error.message
    const code = Object.entries(ErrorMessage).find(
      ([_, message]) => message === errorMessage
    )?.[0] as keyof typeof ErrorCode | undefined

    if (code) {
      return NextResponse.json(
        createErrorResponse(code),
        { status: getStatusCode(code) }
      )
    }
  }

  return NextResponse.json(
    createErrorResponse(ErrorCode.INTERNAL_ERROR),
    { status: 500 }
  )
}

export function handleClientError(error: unknown): string {
  if (error instanceof Error) {
    const errorMessage = error.message
    const code = Object.entries(ErrorMessage).find(
      ([_, message]) => message === errorMessage
    )?.[0] as keyof typeof ErrorCode | undefined

    if (code) {
      return ErrorMessage[code]
    }
  }

  return ErrorMessage[ErrorCode.INTERNAL_ERROR]
} 