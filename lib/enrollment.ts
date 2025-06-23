import { prisma } from "./prisma";
import { EnrollmentStatus } from "@prisma/client";

export async function checkEnrollmentStatus(enrollmentId: string): Promise<EnrollmentStatus | null> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { class: true },
  });

  if (!enrollment) {
    return null;
  }

  const now = new Date();
  const isExpired = enrollment.expiresAt && enrollment.expiresAt < now;
  const isHoursExceeded = enrollment.hoursUsed >= enrollment.totalHours;

  if (isExpired || isHoursExceeded) {
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status: EnrollmentStatus.EXPIRED },
    });
    return EnrollmentStatus.EXPIRED;
  }

  return enrollment.status;
}

export async function updateHoursUsed(enrollmentId: string, hours: number): Promise<boolean> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
  });

  if (!enrollment) {
    throw new Error("Enrollment not found");
  }

  const newHoursUsed = enrollment.hoursUsed + hours;
  const isHoursExceeded = newHoursUsed >= enrollment.totalHours;

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      hoursUsed: newHoursUsed,
      status: isHoursExceeded ? EnrollmentStatus.EXPIRED : enrollment.status,
    },
  });

  return isHoursExceeded;
} 