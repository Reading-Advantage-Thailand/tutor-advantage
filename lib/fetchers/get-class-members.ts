import { cache } from "react";
import { db } from "../db";

export const getClassMembers = cache(async ({ classId }: { classId: string }) => {
  return await db.classMember.findMany({
    where: {
      classId,
    },
    select: {
      userId: true,
      role: true,
      user: {
        select: {
          name: true,
          image: true,
        },
      },
    },
  });
});