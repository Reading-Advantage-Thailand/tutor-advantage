import { Member } from "@/app/(tutor)/tutor/classes/[id]/members/columns";
import { prisma } from "@/lib/prisma";
import { Role, Class, Tutor } from "@prisma/client";
import { Session } from "next-auth";

export async function getClassById(classId: string, userId: string): Promise<Class | null> {
  return prisma.class.findFirst({
    where: {
      id: classId,
      OR: [
        { tutor: { userId } },
        { enrollments: { some: { student: { userId } } } }
      ]
    }
  });
}

export async function getClasses(session: Session): Promise<Class[]> {
  switch (session.user.role) {
    case Role.TUTOR: {
      const tutor = await prisma.tutor.findFirst({
        where: { userId: session.user.id },
      });
      if (!tutor) return [];
      return prisma.class.findMany({
        where: { tutorId: tutor.id },
      });
    }

    case Role.STUDENT: {
      const student = await prisma.student.findFirst({
        where: { userId: session.user.id },
        include: {
          enrollments: {
            include: {
              class: true,
            },
          }
        }
      });
      return student?.enrollments.map((e) => e.class) || [];
    }

    default:
      return [];
  }
}

export function getClassNameById(classes: Class[], classId: string): string {
  const classItem = classes.find((c) => c.id === classId);
  return classItem ? classItem.name.trim() : "ห้องเรียน";
}

export type ClassMembers = Class & {
  students: Member[];
  tutor: Member | null;
} | null;

export async function getClassMembers(classId: string, session: Session): Promise<ClassMembers> {
  switch (session.user.role) {
    case Role.TUTOR: {
      const tutor = await prisma.tutor.findFirst({
        where: { userId: session.user.id },
      });
      if (!tutor) return null;

      const data = await prisma.class.findUnique({
        where: { id: classId, tutorId: tutor.id },
        include: {
          tutor: {
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          enrollments: {
            include: {
              student: {
                select: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!data) return null;

      return {
        ...data,
        students: data.enrollments.map((e) => ({
          id: e.student.user.id,
          name: e.student.user.name,
          email: e.student.user.email,
        })),
        tutor: data.tutor ? {
          id: data.tutor.user.id,
          name: data.tutor.user.name,
          email: data.tutor.user.email,
        } : null,
      };
    }

    case Role.STUDENT:
      const student = await prisma.student.findFirst({
        where: { userId: session.user.id },
        include: {
          enrollments: {
            where: { classId },
            include: {
              class: {
                include: {
                  tutor: {
                    select: {
                      user: {
                        select: {
                          id: true,
                          name: true,
                          email: true,
                        },
                      },
                    },
                  },
                },
              },
              student: {
                select: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!student || student.enrollments.length === 0) return null;

      const enrollment = student.enrollments[0];
      return {
        ...enrollment.class,
        students: student.enrollments.map((e) => ({
          id: e.student.user.id,
          name: e.student.user.name,
          email: e.student.user.email,
        })),
        tutor: enrollment.class.tutor ? {
          id: enrollment.class.tutor.user.id,
          name: enrollment.class.tutor.user.name,
          email: enrollment.class.tutor.user.email,
        } : null,
      };
    default:
      return null;
  }
}

export async function getClassByInviteCode(
  inviteCode: string
): Promise<(Class & {
  tutor: Tutor & {
    user: { name: string | null };
  };
}) | null> {
  return prisma.class.findFirst({
    where: {
      inviteCode: inviteCode.toUpperCase(),
    },
    include: {
      tutor: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
}