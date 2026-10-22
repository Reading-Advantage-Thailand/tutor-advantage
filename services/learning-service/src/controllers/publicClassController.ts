import { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "@tutor-advantage/database";
import { logger } from "@tutor-advantage/shared-config";
import { originalPackagePrice } from "../services/classPackagePrice";

// Deliberately separate from getClassById: that handler includes private data
// and can create a missing book cycle. Public reads must never write.
export const publicClassSelect = {
  classId: true, title: true, bookId: true, tutorUserId: true,
  capacity: true, enrolledCount: true, packagePriceMinor: true,
  scheduleDescription: true, startsAt: true, endsAt: true,
  book: { select: {
    bookCode: true, title: true, articleCount: true,
    series: { select: { cefrLevel: true } },
    articles: { select: { title: true }, orderBy: [{ createdAt: "asc" as const }, { articleId: "asc" as const }] },
  } },
  bookCycles: {
    select: { bookId: true, packagePriceMinor: true, sequence: true },
    orderBy: { sequence: "asc" as const },
  },
} satisfies Prisma.ClassSelect;

type PublicRecord = Prisma.ClassGetPayload<{ select: typeof publicClassSelect }>;

export function publicClassWhere(now = new Date()): Prisma.ClassWhereInput {
  const bangkokDate = new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const startOfBangkokDay = new Date(bangkokDate + "T00:00:00+07:00");
  return {
    status: "OPEN", isDemo: false, packagePriceMinor: { gt: 0 },
    AND: [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: startOfBangkokDay } }] },
    ],
  };
}

export function projectPublicClass(cls: PublicRecord, tutorName: string | null) {
  // New enrollments buy the original class book, not the latest upgrade cycle.
  const price = Number(originalPackagePrice(cls, cls.bookCycles));
  return {
    id: cls.classId, name: cls.title || cls.book.title,
    bookId: cls.bookId, bookCode: cls.book.bookCode, book: cls.book.title,
    program: cls.book.bookCode.startsWith("Primary ") ? "Primary Advantage" : "Reading Advantage",
    cefr: cls.book.series.cefrLevel, articleCount: cls.book.articleCount,
    lessonTitles: cls.book.articles.map((article) => article.title),
    tutor: tutorName, packagePriceSatang: price, currency: "THB" as const,
    schedule: cls.scheduleDescription,
    startsAt: cls.startsAt?.toISOString() ?? null,
    endsAt: cls.endsAt?.toISOString() ?? null,
    full: cls.enrolledCount >= cls.capacity,
  };
}

async function projectClasses(classes: PublicRecord[]) {
  const tutors = await prisma.user.findMany({
    where: { userId: { in: [...new Set(classes.map((cls) => cls.tutorUserId))] } },
    select: { userId: true, displayName: true },
  });
  const names = new Map(tutors.map((tutor) => [tutor.userId, tutor.displayName]));
  return classes.map((cls) => projectPublicClass(cls, names.get(cls.tutorUserId) ?? null))
    .filter((cls) => cls.packagePriceSatang > 0);
}

export async function getPublicClasses(_req: Request, res: Response) {
  try {
    const classes = await prisma.class.findMany({
      where: publicClassWhere(), select: publicClassSelect, orderBy: { createdAt: "desc" },
    });
    return res.status(200).json({ classes: await projectClasses(classes) });
  } catch (error) {
    logger.error("Public class catalogue unavailable", error);
    return res.status(503).json({ error: { code: "CATALOG_UNAVAILABLE", message: "Course catalogue unavailable" } });
  }
}

export async function getPublicClass(req: Request, res: Response) {
  const classId = req.params.classId;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Course not found" } });
  }
  try {
    const cls = await prisma.class.findFirst({
      where: { ...publicClassWhere(), classId }, select: publicClassSelect,
    });
    const course = cls ? (await projectClasses([cls]))[0] : null;
    if (!course) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Course not found" } });
    return res.status(200).json({ class: course });
  } catch (error) {
    logger.error("Public course unavailable", error);
    return res.status(503).json({ error: { code: "CATALOG_UNAVAILABLE", message: "Course unavailable" } });
  }
}
