import { db } from "../db";

export const getClassInviteInfo = async ({ code }: { code: string }) => {
  return await db.class.findFirst({
    where: {
      code: code,
    },
    select: {
      id: true,
      name: true,
      tutor: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });
};