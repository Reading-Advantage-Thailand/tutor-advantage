import { db } from "@/lib/db";
import { classJoinSchema } from "@/lib/validations/class";
import { requireAuth } from "@/middleware/auth";
import { HttpError } from "@/middleware/http-error";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// join class
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth([Role.STUDENT, Role.SYSTEM]);
    const body = await req.json();
    const payload = classJoinSchema.parse(body);
    // check if class exists
    const classRoom = await db.class.findFirst({
      where: {
        code: payload.code,
      },
    });
    console.log("classRoom", classRoom);
    if (!classRoom) return NextResponse.json({ message: "ไม่เจอห้องเรียน" }, { status: 404 });
    // check if already joined
    const isJoined = await db.classMember.findFirst({
      where: {
        userId: session.user?.id as string,
        classId: classRoom.id,
      },
    });
    if (isJoined) return NextResponse.json({ message: "คุณเข้าร่วมแล้ว" }, { status: 400 });
    // join class
    await db.classMember.create({
      data: {
        userId: session.user?.id as string,
        classId: classRoom.id,
      },
    });
    return NextResponse.json({ classId: classRoom.id });
  } catch (error) {
    console.error("Error joining class:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(error.errors, { status: 400 });
    }
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}