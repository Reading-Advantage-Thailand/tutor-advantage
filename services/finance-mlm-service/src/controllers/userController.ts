import { Request, Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { createOmiseRecipient, isOmiseConfigured } from "../services/omiseService";

const ACTIVE_CLASS_STATUSES = ["ACTIVE", "OPEN", "IN_PROGRESS", "PUBLISHED"];
const ACTIVE_ENROLLMENT_STATUSES = ["ACTIVE", "CONFIRMED", "PAID"];
const VERIFICATION_FIELDS = ["idCard", "bankBook", "address", "taxInfo"];

const fieldLabels: Record<string, string> = {
  idCard: "ID card",
  bankBook: "Bank book",
  address: "Address",
  taxInfo: "Tax info",
};

const asSettings = (value: unknown) => (value as Record<string, any>) || {};

function getSubmittedVerificationFields(settingsValue: unknown) {
  const verification = asSettings(settingsValue).verification || {};
  return VERIFICATION_FIELDS.filter(
    (field) => verification[field]?.status === "PENDING",
  ).map((field) => ({
    field,
    label: fieldLabels[field],
    updatedAt: verification[field]?.updatedAt,
  }));
}

async function getUserClassCounts(userIds: string[]) {
  if (userIds.length === 0) {
    return { tutor: new Map<string, number>(), student: new Map<string, number>() };
  }

  const [tutorCounts, studentCounts] = await Promise.all([
    prisma.class.groupBy({
      by: ["tutorUserId"],
      where: {
        tutorUserId: { in: userIds },
        status: { in: ACTIVE_CLASS_STATUSES },
      },
      _count: { classId: true },
    }),
    prisma.enrollment.groupBy({
      by: ["studentUserId"],
      where: {
        studentUserId: { in: userIds },
        status: { in: ACTIVE_ENROLLMENT_STATUSES },
      },
      _count: { enrollmentId: true },
    }),
  ]);

  return {
    tutor: new Map(tutorCounts.map((item) => [item.tutorUserId, item._count.classId])),
    student: new Map(
      studentCounts.map((item) => [item.studentUserId, item._count.enrollmentId]),
    ),
  };
}

export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "ADMIN" && req.user?.role !== "FINANCE_CHECKER") {
    return res.status(403).json({ error: "Forbidden: Requires Admin privileges" });
  }

  try {
    const users = await prisma.user.findMany({
      where: { role: { in: ["TUTOR", "STUDENT"] } },
      select: {
        userId: true,
        displayName: true,
        role: true,
        email: true,
        profilePictureUrl: true,
        verificationStatus: true,
        settings: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const userIds = users.map((user) => user.userId);
    const [classCounts, guardianCounts] = await Promise.all([
      getUserClassCounts(userIds),
      prisma.guardianConsent.groupBy({
        by: ["studentUserId"],
        where: { studentUserId: { in: userIds } },
        _count: { consentId: true },
      }),
    ]);
    const guardianMap = new Map(
      guardianCounts.map((item) => [item.studentUserId, item._count.consentId]),
    );

    const formattedUsers = users.map((user) => {
      const submittedVerificationFields = getSubmittedVerificationFields(
        user.settings,
      );
      const activeClasses =
        user.role === "TUTOR"
          ? (classCounts.tutor.get(user.userId) ?? 0)
          : (classCounts.student.get(user.userId) ?? 0);

      return {
        id: user.userId,
        name: user.displayName || user.email || user.userId,
        role: user.role,
        email: user.email,
        profilePictureUrl: user.profilePictureUrl ?? null,
        activeClasses,
        status: user.isActive ? "ACTIVE" : "INACTIVE",
        verificationStatus: user.verificationStatus,
        submittedVerificationFields,
        pendingVerificationCount: submittedVerificationFields.length,
        guardianSetup:
          user.role === "STUDENT"
            ? (guardianMap.get(user.userId) ?? 0) > 0
            : true,
        joined: user.createdAt.toISOString().split("T")[0],
      };
    });

    res.status(200).json({ users: formattedUsers });
  } catch (error) {
    console.error("Get Users Error:", error);
    res.status(500).json({ error: "Could not fetch users" });
  }
};

export const getUserDetails = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { userId: id },
      include: {
        userConsents: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const [guardianCount, tutorClasses, enrollments] = await Promise.all([
      prisma.guardianConsent.count({ where: { studentUserId: id } }),
      prisma.class.findMany({
        where: { tutorUserId: id },
        include: { book: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.enrollment.findMany({
        where: { studentUserId: id },
        include: { class: { include: { book: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const classes =
      user.role === "TUTOR"
        ? tutorClasses.map((cls) => ({
            id: cls.classId,
            name: cls.title,
            students: cls.enrolledCount,
            status: cls.status,
            bookTitle: cls.book.title,
            startsAt: cls.startsAt?.toISOString() ?? null,
          }))
        : enrollments.map((enrollment) => ({
            id: enrollment.class.classId,
            name: enrollment.class.title,
            students: enrollment.class.enrolledCount,
            status: enrollment.status,
            bookTitle: enrollment.class.book.title,
            startsAt: enrollment.class.startsAt?.toISOString() ?? null,
          }));

    res.status(200).json({
      user: {
        id: user.userId,
        name: user.displayName,
        email: user.email,
        phone: user.phoneNumber,
        role: user.role,
        status: user.isActive ? "ACTIVE" : "INACTIVE",
        joinedAt: user.createdAt.toISOString(),
        profilePictureUrl: user.profilePictureUrl ?? null,
        idCardImageUrl: user.idCardImageUrl,
        bankBookImageUrl: user.bankBookImageUrl,
        verificationStatus: user.verificationStatus,
        verificationComment: user.verificationComment,
        settings: user.settings,
        guardianSetup: user.role === "STUDENT" ? guardianCount > 0 : true,
        consentLogs: user.userConsents.map((consent) => ({
          id: consent.userConsentId,
          version: consent.effectiveAt.toISOString().split("T")[0],
          type: consent.consentType,
          status: consent.status,
          timestamp: consent.createdAt.toISOString(),
        })),
        classes,
      },
    });
  } catch (error) {
    console.error("Get User Details Error:", error);
    res.status(500).json({ error: "Could not fetch user details" });
  }
};

export const verifyUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, comment, field, fieldComments } = req.body;

  if (!["VERIFIED", "REJECTED"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const normalizedField = VERIFICATION_FIELDS.includes(field) ? field : "ALL";
  const globalComment = typeof comment === "string" ? comment.trim() : "";
  const commentsByField =
    fieldComments && typeof fieldComments === "object" ? fieldComments : {};

  const getCommentForField = (fieldName: string) => {
    const fieldComment = commentsByField[fieldName];
    return typeof fieldComment === "string" && fieldComment.trim()
      ? fieldComment.trim()
      : globalComment;
  };

  if (status === "REJECTED") {
    const targetFields =
      normalizedField === "ALL" ? VERIFICATION_FIELDS : [normalizedField];
    const missingReason = targetFields.some(
      (fieldName) => !getCommentForField(fieldName),
    );
    if (missingReason) {
      return res.status(400).json({ error: "Reject reason is required" });
    }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { userId: id },
      select: { settings: true, displayName: true, email: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const currentSettings = asSettings(user.settings);
    const verification = currentSettings.verification || {};
    const newVerification = { ...verification };
    const now = new Date().toISOString();

    if (normalizedField !== "ALL") {
      newVerification[normalizedField] = {
        ...newVerification[normalizedField],
        status,
        comment: status === "REJECTED" ? getCommentForField(normalizedField) : "",
        updatedAt: now,
      };
    } else {
      VERIFICATION_FIELDS.forEach((verificationField) => {
        newVerification[verificationField] = {
          ...newVerification[verificationField],
          status,
          comment:
            status === "REJECTED" ? getCommentForField(verificationField) : "",
          updatedAt: now,
        };
      });
    }

    const hasRejected = VERIFICATION_FIELDS.some(
      (verificationField) =>
        newVerification[verificationField]?.status === "REJECTED",
    );
    const hasPending = VERIFICATION_FIELDS.some(
      (verificationField) =>
        newVerification[verificationField]?.status === "PENDING",
    );
    const allVerified = VERIFICATION_FIELDS.every(
      (verificationField) =>
        newVerification[verificationField]?.status === "VERIFIED",
    );

    const data: Record<string, unknown> = {
      settings: { ...currentSettings, verification: newVerification },
      verificationComment:
        globalComment ||
        (status === "REJECTED" ? getCommentForField(normalizedField) : null),
    };

    if (allVerified) {
      data.verificationStatus = "VERIFIED";
      data.verificationComment = null;
    } else if (hasRejected) {
      data.verificationStatus = "REJECTED";
    } else if (hasPending) {
      data.verificationStatus = "PENDING";
    } else {
      data.verificationStatus = "UNVERIFIED";
    }

    await prisma.user.update({
      where: { userId: id },
      data,
    });

    // Auto-create Omise recipient when bankBook is verified and not yet created
    const bankBookNowVerified =
      status === "VERIFIED" &&
      (normalizedField === "bankBook" || normalizedField === "ALL");

    if (bankBookNowVerified && isOmiseConfigured()) {
      const accountNumber = currentSettings.bankAccountNumber as string | undefined;
      const bankBrand = currentSettings.bankBrand as string | undefined;
      const existingRecipientId = currentSettings.omiseRecipientId as string | undefined;

      if (accountNumber && bankBrand && !existingRecipientId) {
        try {
          const recipient = await createOmiseRecipient({
            name: user.displayName || `Tutor ${id}`,
            email: user.email || undefined,
            bankAccountBrand: bankBrand,
            bankAccountNumber: accountNumber,
            bankAccountName: user.displayName || `Tutor ${id}`,
          });

          await prisma.user.update({
            where: { userId: id },
            data: {
              settings: {
                ...((data.settings as Record<string, unknown>) ?? currentSettings),
                omiseRecipientId: recipient.id,
              },
            },
          });

          console.log(`[verifyUser] Created Omise recipient ${recipient.id} for tutor ${id}`);
        } catch (omiseError: any) {
          // Non-fatal: log and continue — admin can set recipient ID manually
          console.error(`[verifyUser] Failed to auto-create Omise recipient for ${id}:`, omiseError.message);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `User ${id} ${field || "all"} verification status updated to ${status}`,
      verificationDetails: newVerification,
    });
  } catch (error) {
    console.error("Verify User Error:", error);
    res.status(500).json({ error: "Could not update verification status" });
  }
};

export const suspendUser = async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden: Requires Admin privileges" });
  }
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { userId: id },
      select: { isActive: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const updated = await prisma.user.update({
      where: { userId: id },
      data: { isActive: !user.isActive },
      select: { userId: true, isActive: true },
    });

    return res.status(200).json({
      success: true,
      isActive: updated.isActive,
      message: `User ${id} has been ${updated.isActive ? "unsuspended" : "suspended"}`,
    });
  } catch (error) {
    console.error("Suspend User Error:", error);
    return res.status(500).json({ error: "Could not update user status" });
  }
};

export const updateOmiseRecipient = async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden: Requires Admin privileges" });
  }

  const { id } = req.params;
  const { omiseRecipientId } = req.body;

  if (typeof omiseRecipientId !== "string") {
    return res.status(400).json({ error: "omiseRecipientId must be a string" });
  }

  const trimmed = omiseRecipientId.trim();
  if (trimmed && !trimmed.startsWith("recp_")) {
    return res.status(400).json({ error: "Invalid Omise recipient ID format (must start with recp_)" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { userId: id },
      select: { settings: true, role: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role !== "TUTOR") return res.status(400).json({ error: "User is not a TUTOR" });

    const currentSettings = asSettings(user.settings);
    const updatedSettings = { ...currentSettings };
    if (trimmed) {
      updatedSettings.omiseRecipientId = trimmed;
    } else {
      delete updatedSettings.omiseRecipientId;
    }

    await prisma.user.update({
      where: { userId: id },
      data: { settings: updatedSettings },
    });

    return res.status(200).json({
      message: "Omise recipient ID updated",
      omiseRecipientId: trimmed || null,
    });
  } catch (error) {
    console.error("Update Omise Recipient Error:", error);
    return res.status(500).json({ error: "Could not update Omise recipient ID" });
  }
};

export const anonymizeUser = async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden: Requires Super Admin privileges" });
  }

  const { id } = req.params;
  try {
    await prisma.user.update({
      where: { userId: id },
      data: {
        displayName: "Anonymized User",
        email: `anon-${id}@example.com`,
        phoneNumber: null,
        idCardImageUrl: null,
        bankBookImageUrl: null,
        verificationComment: null,
      },
    });
    res
      .status(200)
      .json({ success: true, message: `User ${id} has been anonymized` });
  } catch (error) {
    console.error("Anonymize User Error:", error);
    res.status(500).json({ error: "Could not anonymize user" });
  }
};
