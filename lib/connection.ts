import { db } from "@/lib/db"
import { NextResponse } from "next/server"

interface GetUserConnectionResponse {
  id: string
  parentId: string
}

export async function getUserConnection(userId: string): Promise<GetUserConnectionResponse> {
  const user = await db.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      parentId: true,
    },
  });

  if (!user || !user.parentId) {
    throw new Error("User not found or user has no parent")
  }

  return {
    id: user.id,
    parentId: user.parentId,
  }
}
