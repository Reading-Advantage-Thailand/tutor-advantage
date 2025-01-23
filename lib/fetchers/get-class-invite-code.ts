import { cache } from "react";
import { db } from "../db";

export const getClassInviteCode = cache(async ({ classId }: { classId: string }) => {
  return await db.class.findFirst({
    where: {
      id: classId,
    },
    select: {
      code: true,
    },
  });
});