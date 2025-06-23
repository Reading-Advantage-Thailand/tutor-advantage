import { withTutorRole } from "@/lib/route-handlers";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { User } from "@prisma/client";
import { AppError } from "@/lib/app-error";
import { HTTP_ERRORS } from "@/lib/errors";

// Schema
const inviteCodeSchema = z.object({
  inviteCode: z.string().optional(),
})

// invite other tutors
export const inviteTutor = withTutorRole(async (req: NextRequest, user: User) => {
  const body = await req.json();
  const payload = inviteCodeSchema.parse(body)

  if (payload.inviteCode) {
    const inviter = await prisma.tutor.findUnique({
      where: { inviteCode: payload.inviteCode },
    })
    if (!inviter) throw AppError.from(HTTP_ERRORS.NOT_FOUND)
    await prisma.tutor.update({
      where: { userId: user.id },
      data: {
        invitedBy: inviter.id,
      },
    })
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isOnboardingCompleted: true,
    },
  })
  return NextResponse.json({ message: "Success" })
});

