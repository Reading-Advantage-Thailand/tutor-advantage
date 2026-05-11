import { Request, Response } from "express";
import { prisma } from "@tutor-advantage/database";

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        userId: true,
        displayName: true,
        role: true,
        email: true,
        verificationStatus: true,
        settings: true,
        idCardImageUrl: true,
        bankBookImageUrl: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const fieldLabels: Record<string, string> = {
      idCard: "บัตรประชาชน",
      bankBook: "สมุดบัญชีธนาคาร",
      address: "ที่อยู่",
    };

    const formattedUsers = users.map(u => {
      const settings = (u.settings as Record<string, any>) || {};
      const verification = settings.verification || {};
      const submittedVerificationFields = ["idCard", "bankBook", "address"]
        .filter((field) => verification[field]?.status === "PENDING")
        .map((field) => ({
          field,
          label: fieldLabels[field],
          updatedAt: verification[field]?.updatedAt,
        }));

      return {
        id: u.userId,
        name: u.displayName || u.email || u.userId,
        role: u.role,
        email: u.email,
        activeClasses: 0,
        status: u.isActive ? "ACTIVE" : "INACTIVE",
        verificationStatus: u.verificationStatus,
        submittedVerificationFields,
        pendingVerificationCount: submittedVerificationFields.length,
        joined: u.createdAt.toISOString().split("T")[0],
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

    // In a real app, we'd fetch classes from the learning schema
    // For now, we'll keep the mock classes but use real user data
    res.status(200).json({
      user: {
        id: user.userId,
        name: user.displayName,
        email: user.email,
        phone: user.phoneNumber,
        role: user.role,
        status: user.isActive ? "ACTIVE" : "INACTIVE",
        joinedAt: user.createdAt.toISOString(),
        idCardImageUrl: user.idCardImageUrl,
        bankBookImageUrl: user.bankBookImageUrl,
        verificationStatus: user.verificationStatus,
        verificationComment: user.verificationComment,
        settings: user.settings,
        guardianSetup: user.role === "STUDENT", // Simplified
        consentLogs: user.userConsents.map(c => ({
          id: c.userConsentId,
          version: "v1.0",
          type: c.consentType,
          timestamp: c.createdAt.toISOString(),
        })),
        classes: [], // Fetching classes would require more joins/queries
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

  // status: "VERIFIED" | "REJECTED"
  // field: "idCard" | "bankBook" | "address" | "ALL"
  // fieldComments: optional map for bulk review reasons, keyed by field

  if (!["VERIFIED", "REJECTED"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const validFields = ["idCard", "bankBook", "address"];
  const normalizedField = validFields.includes(field) ? field : "ALL";
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
    const targetFields = normalizedField === "ALL" ? validFields : [normalizedField];
    const missingReason = targetFields.some((fieldName) => !getCommentForField(fieldName));
    if (missingReason) {
      return res.status(400).json({ error: "Reject reason is required" });
    }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { userId: id },
      select: { settings: true, verificationStatus: true }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const currentSettings = (user.settings as Record<string, any>) || {};
    const verification = currentSettings.verification || {};
    const newVerification = { ...verification };

    const now = new Date().toISOString();

    if (normalizedField !== "ALL") {
      newVerification[normalizedField] = { 
        ...newVerification[normalizedField],
        status,
        comment: status === "REJECTED" ? getCommentForField(normalizedField) : "", 
        updatedAt: now 
      };
    } else {
      // Compatibility with old behavior or bulk verify
      validFields.forEach(f => {
        if (newVerification[f]) {
          newVerification[f] = {
            ...newVerification[f],
            status,
            comment: status === "REJECTED" ? getCommentForField(f) : "",
            updatedAt: now,
          };
        }
      });
    }

    const hasRejected = validFields.some(f => newVerification[f]?.status === "REJECTED");
    const hasPending = validFields.some(f => newVerification[f]?.status === "PENDING");
    const allVerified = 
      newVerification.idCard?.status === "VERIFIED" && 
      newVerification.bankBook?.status === "VERIFIED" && 
      newVerification.address?.status === "VERIFIED";

    const data: any = {
      settings: { ...currentSettings, verification: newVerification },
      verificationComment: globalComment || (status === "REJECTED" ? getCommentForField(normalizedField) : null),
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

    res.status(200).json({ 
      success: true, 
      message: `User ${id} ${field || 'all'} verification status updated to ${status}`,
      verificationDetails: newVerification
    });
  } catch (error) {
    console.error("Verify User Error:", error);
    res.status(500).json({ error: "Could not update verification status" });
  }
};

export const anonymizeUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // Basic anonymization (clear PII)
    await prisma.user.update({
      where: { userId: id },
      data: {
        displayName: "Anonymized User",
        email: `anon-${id}@example.com`,
        phoneNumber: null,
        idCardImageUrl: null,
        bankBookImageUrl: null,
      },
    });
    res.status(200).json({ success: true, message: `User ${id} has been anonymized` });
  } catch (error) {
    console.error("Anonymize User Error:", error);
    res.status(500).json({ error: "Could not anonymize user" });
  }
};
