import { prisma } from "@/lib/prisma";
import { withTutorRole } from "@/lib/route-handlers";
import { Tutor, User } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

// schema
const createClassSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อชั้นเรียน"),
  icon: z.string().min(1, "กรุณาเลือกไอคอน"),
  pricePerHour: z.number().min(0, "กรุณากรอกราคาต่อชั่วโมง"),
  defaultHours: z.number().min(1, "กรุณากรอกจำนวนชั่วโมง"),
  packagePrice: z.number().nullable().optional(),
});

// create class
export const createClass = withTutorRole(async (req: NextRequest, user: User, tutor: Tutor) => {
  const body = await req.json();
  const payload = createClassSchema.parse(body);

  const newClass = await prisma.class.create({
    data: {
      name: payload.name,
      icon: payload.icon,
      pricePerHour: payload.pricePerHour,
      defaultHours: payload.defaultHours,
      packagePrice: payload.packagePrice,
      tutorId: tutor?.id,
      inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
    },
  });
  return NextResponse.json(newClass);
});

export const getClasses = withTutorRole(async (req: NextRequest, user: User, tutor: Tutor) => {
  const classes = await prisma.class.findMany({
    where: {
      tutorId: tutor?.id,
    },
  });
  return NextResponse.json(classes);
});