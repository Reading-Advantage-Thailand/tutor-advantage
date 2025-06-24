import { withAuthAndId } from "@/lib/route-handlers";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role, User } from "@prisma/client";
import { AppError } from "@/lib/app-error";
import { HTTP_ERRORS } from "@/lib/errors";

// route context schema
const routeContextSchema = z.object({
  params: z.object({
    id: z.string(),
  })
})

// Schema
const userRoleSchema = z.object({
  role: z.enum(["tutor", "student"]),
})

// update role
export const updateUserRole = withAuthAndId(async (req: NextRequest, user: User, context) => {
  const params = await context.params;
  const validatedContext = routeContextSchema.parse({ params });

  if (validatedContext.params.id !== user.id) {
    throw AppError.from(HTTP_ERRORS.UNAUTHORIZED)
  }

  const body = await req.json();
  const payload = userRoleSchema.parse(body);

  const existingUser = await prisma.user.findUnique({
    where: { id: validatedContext.params.id },
    include: {
      tutor: true,
      student: true,
    },
  });

  if (!existingUser) {
    throw AppError.from(HTTP_ERRORS.NOT_FOUND);
  }

  if (existingUser.tutor || existingUser.student) {
    throw AppError.from(HTTP_ERRORS.ALREADY_EXISTS);
  }

  if (payload.role === "tutor") {
    await prisma.tutor.create({
      data: {
        userId: validatedContext.params.id,
        inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      },
    })
    await prisma.user.update({
      where: { id: validatedContext.params.id },
      data: { role: Role.TUTOR },
    });

  } else {
    await prisma.student.create({
      data: {
        userId: validatedContext.params.id
      }
    });
    await prisma.user.update({
      where: { id: validatedContext.params.id },
      data: { role: Role.STUDENT },
    });
  }

  return NextResponse.json({ message: "Role updated successfully" });
});