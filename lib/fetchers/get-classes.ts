import { cache } from "react";
import { db } from "../db";

export const getClasses = cache(async ({ userId }: { userId: string }) => {
  return await db.class.findMany({
    where: {
      OR: [
        { tutorId: userId },
        { students: { some: { userId } } },
      ],
    },
    select: {
      id: true,
      name: true,
      channels: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
});