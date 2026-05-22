import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

const prisma = new PrismaClient();

type TutorReviewRow = {
  reviewId: string;
  tutorUserId: string;
  studentUserId: string;
  classId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const parseRating = (value: unknown): number | null => {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  return rating;
};

export const submitTutorReview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { classId } = req.params;
    const rating = parseRating(req.body?.rating);
    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : null;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!rating) {
      res.status(400).json({ error: "rating must be an integer from 1 to 5" });
      return;
    }

    const targetClass = await prisma.class.findUnique({
      where: { classId },
      select: {
        classId: true,
        tutorUserId: true,
        status: true,
        enrollments: {
          where: {
            studentUserId: userId,
            status: "ACTIVE",
          },
          select: { enrollmentId: true },
        },
      },
    });

    if (!targetClass) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    if (targetClass.tutorUserId === userId) {
      res.status(400).json({ error: "Tutors cannot review their own class" });
      return;
    }

    if (targetClass.enrollments.length === 0) {
      res.status(403).json({ error: "Only enrolled students can review this tutor" });
      return;
    }

    const reviews = await prisma.$queryRaw<TutorReviewRow[]>`
      INSERT INTO "learning"."tutor_reviews" (
        "tutor_user_id",
        "student_user_id",
        "class_id",
        "rating",
        "comment"
      )
      VALUES (
        CAST(${targetClass.tutorUserId} AS uuid),
        CAST(${userId} AS uuid),
        CAST(${classId} AS uuid),
        ${rating},
        ${comment || null}
      )
      ON CONFLICT ("student_user_id", "class_id")
      DO UPDATE SET
        "rating" = EXCLUDED."rating",
        "comment" = EXCLUDED."comment",
        "updated_at" = CURRENT_TIMESTAMP
      RETURNING
        "review_id"::text AS "reviewId",
        "tutor_user_id"::text AS "tutorUserId",
        "student_user_id"::text AS "studentUserId",
        "class_id"::text AS "classId",
        "rating",
        "comment",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt"
    `;
    const review = reviews[0];

    res.status(200).json({
      review: {
        id: review.reviewId,
        tutorUserId: review.tutorUserId,
        studentUserId: review.studentUserId,
        classId: review.classId,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to submit tutor review", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMyTutorReviewForClass = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { classId } = req.params;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const reviews = await prisma.$queryRaw<TutorReviewRow[]>`
      SELECT
        "review_id"::text AS "reviewId",
        "tutor_user_id"::text AS "tutorUserId",
        "student_user_id"::text AS "studentUserId",
        "class_id"::text AS "classId",
        "rating",
        "comment",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt"
      FROM "learning"."tutor_reviews"
      WHERE "student_user_id" = CAST(${userId} AS uuid)
        AND "class_id" = CAST(${classId} AS uuid)
      LIMIT 1
    `;
    const review = reviews[0] || null;

    res.status(200).json({
      review: review
        ? {
            id: review.reviewId,
            tutorUserId: review.tutorUserId,
            studentUserId: review.studentUserId,
            classId: review.classId,
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt.toISOString(),
            updatedAt: review.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (error) {
    console.error("Failed to fetch tutor review", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
