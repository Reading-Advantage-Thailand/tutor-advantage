import { prisma } from "@/lib/prisma";

export async function getTutorInvite(userId: string): Promise<boolean> {
  const tutor = await prisma.tutor.findUnique({
    where: { userId },
    select: { invitedBy: true },
  })
  return tutor?.invitedBy === null ? true : false
}