/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

import { AppError } from './app-error'
import { Tutor, User } from '@prisma/client';
import { auth } from './auth';
import { HTTP_ERRORS } from './errors';
import { prisma } from './prisma';

type RouteHandler = (
  req: NextRequest,
  context?: { params: any }
) => Promise<NextResponse>;

type AuthenticatedRouteHandler = (
  req: NextRequest,
  user: User,
  context?: { params: any }
) => Promise<NextResponse>;

type TutorRouteHandler = (
  req: NextRequest,
  user: User,
  tutor: Tutor,
  context?: { params: any }
) => Promise<NextResponse>;

export const withErrorHandler = (fn: RouteHandler): RouteHandler => {
  return async (req: NextRequest, context?: { params: any }) => {
    try {
      return await fn(req, context);
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
        );
      }

      if (error instanceof Error) {
        return NextResponse.json(
          {
            success: false,
            status: 'error',
            error: {
              message: error.message,
              statusCode: 500
            }
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          status: 'error',
          error: {
            message: 'An unexpected error occurred',
            statusCode: 500
          }
        },
        { status: 500 }
      );
    }
  };
};

export const withAuth = (fn: AuthenticatedRouteHandler): RouteHandler => {
  return async (req: NextRequest, context?: { params: any }) => {
    try {
      const session = await auth();
      if (!session?.user) {
        throw AppError.from(HTTP_ERRORS.UNAUTHORIZED);
      }

      return await fn(req, session.user, context);
    } catch (error) {
      console.error('error in with-auth:', error);

      if (error instanceof AppError) {
        return NextResponse.json(
          { status: error.statusCode },
          { status: error.statusCode }
        );
      }

      if (error instanceof Error) {
        return NextResponse.json(
          {
            success: false,
            status: 'error',
            error: {
              message: error.message,
              statusCode: 500
            }
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          status: 'error',
          error: {
            message: 'An unexpected error occurred',
            statusCode: 500
          }
        },
        { status: 500 }
      );
    }
  };
};

export const withTutorRole = (fn: TutorRouteHandler): RouteHandler => {
  return withAuth(async (req, user, context) => {
    const tutor = await prisma.tutor.findUnique({
      where: { userId: user.id },
    });

    if (!tutor) {
      throw AppError.from(HTTP_ERRORS.FORBIDDEN);
    }

    return await fn(req, user, tutor, context);
  });
};

export const withStudentRole = (fn: AuthenticatedRouteHandler): RouteHandler => {
  return withAuth(async (req, user, context) => {
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
    })

    if (!student) {
      throw AppError.from(HTTP_ERRORS.FORBIDDEN);
    }
    return await fn(req, user, context);
  });
};