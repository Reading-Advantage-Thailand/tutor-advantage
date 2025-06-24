import { NextRequest, NextResponse } from 'next/server'

import { AppError } from './app-error'
import { Tutor, User } from '@prisma/client'
import { auth } from './auth'
import { HTTP_ERRORS } from './errors'
import { prisma } from './prisma'

type RouteContext = {
  params: Promise<Record<string, string>>
}

type RouteContextWithId = {
  params: Promise<{ id: string }>
}

type RouteHandler = (
  req: NextRequest,
  context: RouteContext
) => Promise<NextResponse>

type AuthenticatedRouteHandler = (
  req: NextRequest,
  user: User,
  context: RouteContext
) => Promise<NextResponse>

type AuthenticatedRouteHandlerWithId = (
  req: NextRequest,
  user: User,
  context: RouteContextWithId
) => Promise<NextResponse>

type TutorRouteHandler = (
  req: NextRequest,
  user: User,
  tutor: Tutor,
  context: RouteContext
) => Promise<NextResponse>

export const withErrorHandler = (fn: RouteHandler): RouteHandler => {
  return async (req: NextRequest, context: RouteContext) => {
    try {
      return await fn(req, context)
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json(
          {
            success: false,
            status: 'error',
            error: {
              message: error.message,
              statusCode: error.statusCode,
            },
          },
          { status: error.statusCode }
        )
      }

      if (error instanceof Error) {
        return NextResponse.json(
          {
            success: false,
            status: 'error',
            error: {
              message: error.message,
              statusCode: 500,
            },
          },
          { status: 500 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          status: 'error',
          error: {
            message: 'An unexpected error occurred',
            statusCode: 500,
          },
        },
        { status: 500 }
      )
    }
  }
}

export const withAuth = (fn: AuthenticatedRouteHandler): RouteHandler => {
  return withErrorHandler(async (req: NextRequest, context: RouteContext) => {
    const session = await auth()
    if (!session?.user) {
      throw AppError.from(HTTP_ERRORS.UNAUTHORIZED)
    }

    return await fn(req, session.user, context)
  })
}

export const withAuthAndId = (fn: AuthenticatedRouteHandlerWithId): RouteHandler => {
  return withErrorHandler(async (req: NextRequest, context: RouteContext) => {
    const session = await auth()
    if (!session?.user) {
      throw AppError.from(HTTP_ERRORS.UNAUTHORIZED)
    }

    // Type assertion since we know this route has an id parameter
    const contextWithId = context as RouteContextWithId
    return await fn(req, session.user, contextWithId)
  })
}

export const withTutorRole = (fn: TutorRouteHandler): RouteHandler => {
  return withAuth(async (req, user, context) => {
    const tutor = await prisma.tutor.findUnique({
      where: { userId: user.id },
    })

    if (!tutor) {
      throw AppError.from(HTTP_ERRORS.FORBIDDEN)
    }

    return await fn(req, user, tutor, context)
  })
}

export const withStudentRole = (fn: AuthenticatedRouteHandler): RouteHandler => {
  return withAuth(async (req, user, context) => {
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
    });

    if (!student) {
      throw AppError.from(HTTP_ERRORS.FORBIDDEN);
    }

    return await fn(req, user, context);
  });
};