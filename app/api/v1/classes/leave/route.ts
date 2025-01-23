/* eslint-disable @typescript-eslint/no-unused-vars */
import { db } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

// Leave class
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth([Role.STUDENT, Role.SYSTEM]);
    const body = await req.json();

    if (!body.classId) {
      return NextResponse.json({ message: "classId is required" }, { status: 400 });
    }

    // Delete the ClassMember record
    await db.classMember.delete({
      where: {
        userId_classId: {
          userId: session.user?.id as string,
          classId: body.classId,
        },
      },
    });

    return NextResponse.json({ message: "ออกจากห้องเรียนสำเร็จ" });
  } catch (error) {
    console.error("Error leaving class:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
