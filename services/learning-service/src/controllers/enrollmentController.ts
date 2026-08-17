import { logger } from "@tutor-advantage/shared-config";
import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

const PAYMENT_HOLD_MINUTES = 30;

async function lockClassForEnrollment(tx: any, classId: string, now = new Date()) {
  // Capacity checks and the enrolledCount update must observe the same locked
  // class row. Otherwise two concurrent enrollments can both pass the check.
  await tx.$queryRaw`
    SELECT "class_id"
    FROM "learning"."classes"
    WHERE "class_id" = CAST(${classId} AS uuid)
    FOR UPDATE
  `;

  const cls = await tx.class.findUnique({ where: { classId } });
  if (!cls) return null;

  const expired = await tx.enrollment.findMany({
    where: {
      classId,
      status: "PENDING_PAYMENT",
      paymentExpiresAt: { lte: now },
    },
    select: { enrollmentId: true },
  });

  if (expired.length === 0) return cls;

  const expiredIds = expired.map((enrollment: { enrollmentId: string }) => enrollment.enrollmentId);
  const cancelled = await tx.enrollment.updateMany({
    where: {
      enrollmentId: { in: expiredIds },
      status: "PENDING_PAYMENT",
    },
    data: { status: "CANCELLED", paymentExpiresAt: null },
  });

  await tx.enrollmentPackage.updateMany({
    where: {
      enrollmentId: { in: expiredIds },
      status: "PENDING_PAYMENT",
    },
    data: { status: "CANCELLED" },
  });

  if (cancelled.count === 0) return cls;

  const enrolledCount = Math.max(0, cls.enrolledCount - cancelled.count);
  return tx.class.update({
    where: { classId },
    data: { enrolledCount },
  });
}

async function findAvailableClass(
  tx: any,
  tutorUserId: string,
  excludedClassId?: string,
) {
  const candidates = await tx.class.findMany({
    where: {
      tutorUserId,
      status: "OPEN",
      isDemo: false,
      ...(excludedClassId ? { classId: { not: excludedClassId } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  for (const candidate of candidates) {
    const locked = await lockClassForEnrollment(tx, candidate.classId);
    if (locked && locked.status === "OPEN" && locked.enrolledCount < locked.capacity) {
      return locked;
    }
  }

  return null;
}

function paymentExpiresAt(status: string) {
  return status === "PENDING_PAYMENT"
    ? new Date(Date.now() + PAYMENT_HOLD_MINUTES * 60 * 1000)
    : null;
}

async function ensureEnrollmentPackageForClass(tx: any, enrollment: any) {
  const cls = await tx.class.findUnique({
    where: { classId: enrollment.classId },
    select: { classId: true, bookId: true, packagePriceMinor: true },
  });

  if (!cls) return null;

  let cycle = await tx.classBookCycle.findFirst({
    where: { classId: cls.classId, bookId: cls.bookId },
    orderBy: { sequence: "asc" },
  });

  if (!cycle) {
    cycle = await tx.classBookCycle.create({
      data: {
        classId: cls.classId,
        bookId: cls.bookId,
        sequence: 1,
        status: "OPEN",
        packagePriceMinor: cls.packagePriceMinor,
      },
    });
  }

  return tx.enrollmentPackage.upsert({
    where: {
      enrollmentId_classBookCycleId: {
        enrollmentId: enrollment.enrollmentId,
        classBookCycleId: cycle.classBookCycleId,
      },
    },
    create: {
      enrollmentId: enrollment.enrollmentId,
      classBookCycleId: cycle.classBookCycleId,
      studentUserId: enrollment.studentUserId,
      status: enrollment.status,
      paymentTransactionId: enrollment.paymentTransactionId,
    },
    update: {},
  });
}

export async function getReferralDetails(req: AuthenticatedRequest, res: Response) {
  try {
    const { referralToken } = req.params;

    if (!referralToken) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "referralToken is required",
          requestId: req.id,
        },
      });
    }

    const referral = await prisma.referral.findUnique({
      where: { token: referralToken },
      include: {
        class: {
          include: {
            book: { include: { series: true } },
          },
        },
      },
    });

    if (!referral || referral.status !== "ACTIVE") {
      return res.status(404).json({
        error: {
          code: "REFERRAL_INVALID",
          message: "The referral token is invalid or expired",
          requestId: req.id,
        },
      });
    }

    const cls = referral.class;
    const tutor = await prisma.user.findUnique({
      where: { userId: cls.tutorUserId },
      select: { displayName: true, profilePictureUrl: true },
    });

    return res.status(200).json({
      class: {
        id: cls.classId,
        name: cls.title || cls.book?.title || "Untitled Class",
        book: cls.book?.title || "Unknown Book",
        status: cls.status.toLowerCase(),
        students: cls.enrolledCount || 0,
        maxStudents: cls.capacity,
        price: Number(cls.packagePriceMinor) / 100,
        packagePriceSatang: Number(cls.packagePriceMinor),
        cefr: cls.book?.series?.cefrLevel || "A1",
        schedule: cls.scheduleDescription || "ยังไม่ได้กำหนด",
        startsAt: cls.startsAt,
        endsAt: cls.endsAt,
        tutor: {
          name: tutor?.displayName || "Unknown Tutor",
          pictureUrl: tutor?.profilePictureUrl || null,
        },
      },
      referralToken: referral.token,
    });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("Get Referral Details Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch referral details",
        details: error.message,
        requestId: req.id,
      },
    });
  }
}

export async function enrollStudent(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { referralToken } = req.params;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "User ID missing from token",
          requestId: req.id,
        },
      });
    }

    if (req.user?.role !== "STUDENT") {
      return res.status(403).json({
        error: {
          code: "STUDENT_ROLE_REQUIRED",
          message: "Only student accounts can enroll in classes",
          requestId: req.id,
        },
      });
    }

    if (!referralToken) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "referralToken is required",
          requestId: req.id,
        },
      });
    }

    // Wrap the entire enrollment + fallback logic in a transaction
    const enrollmentResult = await prisma.$transaction(async (tx) => {
      // 1. Find the referral
      const referral = await tx.referral.findUnique({
        where: { token: referralToken },
        include: {
          class: true,
        },
      });

      if (!referral || referral.status !== "ACTIVE") {
        throw new Error("REFERRAL_INVALID");
      }

      // 2. Check primary class capacity
      const primaryClass = await lockClassForEnrollment(tx, referral.class.classId);
      if (!primaryClass) throw new Error("REFERRAL_INVALID");

      if (primaryClass.tutorUserId === userId) {
        throw new Error("TUTOR_CANNOT_ENROLL_OWN_CLASS");
      }

      let targetClass = primaryClass;
      let targetClassId = primaryClass.classId;

      // Expired demo classes no longer accept enrollments.
      if (
        primaryClass.isDemo &&
        primaryClass.expiresAt &&
        primaryClass.expiresAt.getTime() < Date.now()
      ) {
        throw new Error("DEMO_EXPIRED");
      }

      if (
        primaryClass.status !== "OPEN" ||
        primaryClass.enrolledCount >= primaryClass.capacity
      ) {
        // Demo classes never fall back: their invite is tied to the free demo
        // room, and falling back would grant free ACTIVE access to a paid class.
        if (primaryClass.isDemo) {
          throw new Error("NO_FALLBACK_AVAILABLE");
        }

        // Fallback Logic: Primary class is full or closed. Look for another OPEN
        // class by the same tutor (excluding demo rooms).
        const fallbackClass = await findAvailableClass(
          tx,
          primaryClass.tutorUserId,
          primaryClass.classId,
        );

        if (!fallbackClass) {
          throw new Error("NO_FALLBACK_AVAILABLE");
        }

        targetClass = fallbackClass;
        targetClassId = fallbackClass.classId;
      }

      const existing = await tx.enrollment.findFirst({
        where: {
          classId: targetClassId,
          studentUserId: userId,
          status: { in: ["PENDING_PAYMENT", "ACTIVE"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (existing) {
        // Backfill the referral token onto a pre-existing enrollment that was
        // created without one (e.g. a prior direct enroll) so the referral is
        // still credited to the tutor.
        if (!existing.referralToken) {
          await tx.enrollment.update({
            where: { enrollmentId: existing.enrollmentId },
            data: { referralToken: referral.token },
          });
        }
        await ensureEnrollmentPackageForClass(tx, existing);
        return {
          enrollmentId: existing.enrollmentId,
          classId: existing.classId,
          isFallback: targetClassId !== primaryClass.classId,
        };
      }

      // 3. Free classes activate immediately — no payment needed. Price 0 alone
      // is not enough: the class must explicitly be a demo room or have
      // coupon-granted free hours, so a misconfigured price can't skip payment.
      const isFreeClass =
        BigInt(targetClass.packagePriceMinor) === BigInt(0) &&
        (targetClass.isDemo || targetClass.freeHours > 0);
      const enrollmentStatus = isFreeClass ? "ACTIVE" : "PENDING_PAYMENT";

      const enrollment = await tx.enrollment.create({
        data: {
          classId: targetClassId,
          studentUserId: userId,
          referralToken: referral.token,
          status: enrollmentStatus,
          paymentExpiresAt: paymentExpiresAt(enrollmentStatus),
        },
      });

      // 4. Increment the enrolled count for the target class
      await tx.class.update({
        where: { classId: targetClassId },
        data: {
          enrolledCount: {
            increment: 1,
          },
        },
      });

      await ensureEnrollmentPackageForClass(tx, enrollment);

      return {
        enrollmentId: enrollment.enrollmentId,
        classId: enrollment.classId,
        isFallback: targetClassId !== primaryClass.classId,
        isFreeClass,
      };
    });

    return res.status(200).json({
      message: enrollmentResult.isFreeClass
        ? "Enrollment successful. Access granted immediately."
        : "Enrollment successful. Pending payment.",
      enrollmentId: enrollmentResult.enrollmentId,
      classId: enrollmentResult.classId,
      placement: enrollmentResult.isFallback ? "FALLBACK" : "PRIMARY",
    });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    if (error.message === "REFERRAL_INVALID") {
      return res.status(400).json({
        error: {
          code: "REFERRAL_INVALID",
          message: "The referral token is invalid or expired",
          requestId: req.id,
        },
      });
    }

    if (error.message === "NO_FALLBACK_AVAILABLE") {
      return res.status(400).json({
        error: {
          code: "CLASS_FULL",
          message:
            "The target class is full and no alternative classes are available from this tutor",
          requestId: req.id,
        },
      });
    }

    if (error.message === "DEMO_EXPIRED") {
      return res.status(400).json({
        error: {
          code: "DEMO_EXPIRED",
          message: "This demo class has expired and no longer accepts enrollments",
          requestId: req.id,
        },
      });
    }

    if (error.message === "TUTOR_CANNOT_ENROLL_OWN_CLASS") {
      return res.status(403).json({
        error: {
          code: "TUTOR_CANNOT_ENROLL_OWN_CLASS",
          message: "Tutors cannot enroll in their own classes",
          requestId: req.id,
        },
      });
    }

    logger.error("Enrollment Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not process enrollment",
        details: error.message,
        requestId: req.id,
      },
    });
  }
}

export async function directEnroll(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { classId, referralToken } = req.body as {
      classId?: string;
      referralToken?: string;
    };

    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "User ID missing", requestId: req.id }
      });
    }

    if (req.user?.role !== "STUDENT") {
      return res.status(403).json({
        error: {
          code: "STUDENT_ROLE_REQUIRED",
          message: "Only student accounts can enroll in classes",
          requestId: req.id,
        },
      });
    }

    if (!classId) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "classId is required", requestId: req.id }
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Check if class exists and has capacity
      const targetClass = await lockClassForEnrollment(tx, classId);

      if (!targetClass) throw new Error("CLASS_NOT_FOUND");

      if (targetClass.tutorUserId === userId) {
        throw new Error("TUTOR_CANNOT_ENROLL_OWN_CLASS");
      }

      // Expired demo classes no longer accept enrollments.
      if (
        targetClass.isDemo &&
        targetClass.expiresAt &&
        targetClass.expiresAt.getTime() < Date.now()
      ) {
        throw new Error("DEMO_EXPIRED");
      }

      let enrolledClass = targetClass;
      let targetClassId = targetClass.classId;
      let placedByFallback = false;

      if (
        targetClass.status !== "OPEN" ||
        targetClass.enrolledCount >= targetClass.capacity
      ) {
        // Demo classes never fall back: falling back would grant free ACTIVE
        // access to a paid class (or drop a paying student into a demo room).
        if (targetClass.isDemo) {
          throw new Error(
            targetClass.status !== "OPEN" ? "CLASS_CLOSED" : "CLASS_FULL",
          );
        }

        const fallbackClass = await findAvailableClass(
          tx,
          targetClass.tutorUserId,
          targetClass.classId,
        );

        if (!fallbackClass) {
          throw new Error(
            targetClass.status !== "OPEN" ? "CLASS_CLOSED" : "CLASS_FULL",
          );
        }

        enrolledClass = fallbackClass;
        targetClassId = fallbackClass.classId;
        placedByFallback = true;
      }

      // 2. Check if already enrolled or has an open payment attempt.
      const existing = await tx.enrollment.findFirst({
        where: {
          classId: targetClassId,
          studentUserId: userId,
          status: { in: ["PENDING_PAYMENT", "ACTIVE"] },
        },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        // Backfill referral token if this enroll carried one and the existing
        // record has none, so the referral is credited.
        if (referralToken && !existing.referralToken) {
          await tx.enrollment.update({
            where: { enrollmentId: existing.enrollmentId },
            data: { referralToken },
          });
          existing.referralToken = referralToken;
        }
        await ensureEnrollmentPackageForClass(tx, existing);
        return { ...existing, placedByFallback };
      }

      // 3. Free classes activate immediately — no payment needed. Price 0 alone
      // is not enough: the class must explicitly be a demo room or have
      // coupon-granted free hours, so a misconfigured price can't skip payment.
      const isFreeClass =
        BigInt(enrolledClass.packagePriceMinor) === BigInt(0) &&
        (enrolledClass.isDemo || enrolledClass.freeHours > 0);
      const enrollment = await tx.enrollment.create({
        data: {
          classId: targetClassId,
          studentUserId: userId,
          status: isFreeClass ? "ACTIVE" : "PENDING_PAYMENT",
          referralToken: referralToken ?? null,
          paymentExpiresAt: paymentExpiresAt(isFreeClass ? "ACTIVE" : "PENDING_PAYMENT"),
        }
      });

      // 4. Update count
      await tx.class.update({
        where: { classId: targetClassId },
        data: { enrolledCount: { increment: 1 } }
      });

      await ensureEnrollmentPackageForClass(tx, enrollment);

      return { ...enrollment, placedByFallback };
    });

    return res.status(200).json({
      message:
        result.status === "ACTIVE"
          ? "Already enrolled and active."
          : "Direct enrollment successful. Pending payment.",
      enrollmentId: result.enrollmentId,
      classId: result.classId,
      status: result.status,
      placement: result.placedByFallback ? "FALLBACK" : "PRIMARY",
    });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("Direct Enrollment Error:", error);
    const code =
      error.message.includes("CLASS") ||
      error.message === "ALREADY_ENROLLED" ||
      error.message === "DEMO_EXPIRED"
        ? "BAD_REQUEST"
        : "INTERNAL_SERVER_ERROR";
    if (error.message === "TUTOR_CANNOT_ENROLL_OWN_CLASS") {
      return res.status(403).json({
        error: {
          code: "TUTOR_CANNOT_ENROLL_OWN_CLASS",
          message: "Tutors cannot enroll in their own classes",
          requestId: req.id,
        },
      });
    }
    return res.status(code === "BAD_REQUEST" ? 400 : 500).json({
      error: {
        code,
        message: error.message,
        requestId: req.id
      }
    });
  }
}
