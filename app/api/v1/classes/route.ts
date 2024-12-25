import { db } from "@/lib/db";
import { classCreateSchema } from "@/lib/validations/class";
import { requireAuth } from "@/middleware/auth";
import { HttpError } from "@/middleware/http-error";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// create class
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth([Role.TUTOR, Role.SYSTEM]);
    const body = await req.json();
    const payload = classCreateSchema.parse(body);
    let slug = payload.name.toLowerCase().replace(/\s/g, "-");
    const validateSlug = await db.class.findFirst({
      where: {
        slug: slug,
      },
    });
    if (validateSlug) slug = `${slug}-${Math.random().toString(36).substring(2, 8)}`;
    // create class
    const classRoom = await db.class.create({
      data: {
        name: payload.name,
        description: payload.description,
        slug: slug,
        tutorId: session.user?.id as string,
        code: Math.random().toString(36).substring(2, 9).toUpperCase(),
      },
    });
    // create general channel by default
    await db.channel.create({
      data: {
        name: "General",
        classId: classRoom.id,
      },
    });
    return NextResponse.json({
      classId: classRoom.id,
      slug: classRoom.slug,
    });
  } catch (error) {
    console.error("Error creating class:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(error.errors, { status: 400 });
    }
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
export interface TutorClassesResponse {
  classes: Class[];
}

export interface Class {
  title: string;
  url: string;
  icon?: string;
  items: Channel[];
}

export interface Channel {
  title: string;
  url: string;
}

// get classes
export async function GET(): Promise<NextResponse<TutorClassesResponse | { message: string }>> {
  try {
    const session = await requireAuth([Role.TUTOR, Role.SYSTEM]);

    const classes = await db.class.findMany({
      where: {
        tutorId: session.user?.id as string,
      },
      select: {
        id: true,
        slug: true,
        name: true,
      },
    });

    if (!classes.length) {
      return NextResponse.json({ classes: [] });
    }

    const channels = await db.channel.findMany({
      where: {
        classId: {
          in: classes.map((c) => c.id),
        },
      },
    });

    const tutorClasses = classes.map((c) => {
      const classChannels = channels
        .filter((ch) => ch.classId === c.id)
        .map((ch) => ({
          title: ch.name,
          url: `/tutor/classes/${c.id}/channels/${ch.id}`,
        }));

      return {
        title: c.name,
        url: `/tutor/classes/${c.id}`,
        items: classChannels || [],
      };
    });
    // return index 0 of tutorClasses
    return NextResponse.json({ classes: [tutorClasses[0]] });

    // return NextResponse.json({ classes: tutorClasses });
  } catch (error) {
    console.error("Error getting classes:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
