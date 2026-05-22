import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { deleteFromGCS } from "../lib/storage";

export async function getCurrentUser(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "User not identified" },
      });
    }

    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        userId: true,
        displayName: true,
        email: true,
        phoneNumber: true,
        profilePictureUrl: true,
        role: true,
        isActive: true,
        settings: true,
        idCardImageUrl: true,
        bankBookImageUrl: true,
        verificationStatus: true,
        verificationComment: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "User not found" },
      });
    }

    return res.status(200).json({ user });
  } catch (error: any) {
    console.error("Get Current User Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch user profile",
        requestId: req.id,
      },
    });
  }
}

export async function submitVerification(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "User not identified" },
      });
    }

    const { idCardImageUrl, bankBookImageUrl, address, bankAccountNumber } = req.body;
    const normalizedBankAccountNumber =
      typeof bankAccountNumber === "string"
        ? bankAccountNumber.replace(/\D/g, "")
        : "";

    if (!idCardImageUrl && !bankBookImageUrl && !address && !normalizedBankAccountNumber) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "At least one verification field must be provided" },
      });
    }

    // Load current user settings and images
    const currentUser = await prisma.user.findUnique({
      where: { userId },
      select: { settings: true, idCardImageUrl: true, bankBookImageUrl: true }
    });

    const currentSettings = (currentUser?.settings as Record<string, any>) || {};
    const verification = currentSettings.verification || {};

    const updatedData: any = {};
    const newVerification = { ...verification };
    const now = new Date().toISOString();
    const lockedFields: string[] = [];

    if ((bankBookImageUrl || normalizedBankAccountNumber) && !normalizedBankAccountNumber) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "Bank account number is required with bank book verification",
        },
      });
    }

    if (address && verification.address?.status === "VERIFIED") lockedFields.push("address");
    if (idCardImageUrl && verification.idCard?.status === "VERIFIED") lockedFields.push("idCard");
    if ((bankBookImageUrl || normalizedBankAccountNumber) && verification.bankBook?.status === "VERIFIED") lockedFields.push("bankBook");

    if (lockedFields.length > 0) {
      return res.status(409).json({
        error: {
          code: "VERIFICATION_LOCKED",
          message: `Verified fields cannot be edited: ${lockedFields.join(", ")}`,
        },
      });
    }

    if (address) {
      currentSettings.address = address;
      newVerification.address = { status: "PENDING", comment: "", updatedAt: now };
    }

    if (idCardImageUrl) {
      updatedData.idCardImageUrl = idCardImageUrl;
      newVerification.idCard = { status: "PENDING", comment: "", updatedAt: now };
    }

    if (bankBookImageUrl || normalizedBankAccountNumber) {
      if (normalizedBankAccountNumber) {
        currentSettings.bankAccountNumber = normalizedBankAccountNumber;
      }
      updatedData.bankBookImageUrl = bankBookImageUrl;
      newVerification.bankBook = { status: "PENDING", comment: "", updatedAt: now };
    }

    updatedData.settings = { ...currentSettings, verification: newVerification };

    const verificationFields = ["idCard", "bankBook", "address"];
    const allVerified = verificationFields.every(
      (field) => newVerification[field]?.status === "VERIFIED",
    );
    const hasRejected = verificationFields.some(
      (field) => newVerification[field]?.status === "REJECTED",
    );
    const hasPending = verificationFields.some(
      (field) => newVerification[field]?.status === "PENDING",
    );

    if (allVerified) {
      updatedData.verificationStatus = "VERIFIED";
    } else if (hasRejected) {
      updatedData.verificationStatus = "REJECTED";
    } else if (hasPending) {
      updatedData.verificationStatus = "PENDING";
    } else {
      updatedData.verificationStatus = "UNVERIFIED";
    }

    updatedData.verificationComment = null;

    const updatedUser = await prisma.user.update({
      where: { userId },
      data: updatedData,
      select: {
        userId: true,
        verificationStatus: true,
        settings: true,
      },
    });

    // Background cleanup old images to save space
    if (idCardImageUrl && currentUser?.idCardImageUrl && currentUser.idCardImageUrl !== idCardImageUrl) {
      deleteFromGCS(currentUser.idCardImageUrl).catch(console.error);
    }
    if (bankBookImageUrl && currentUser?.bankBookImageUrl && currentUser.bankBookImageUrl !== bankBookImageUrl) {
      deleteFromGCS(currentUser.bankBookImageUrl).catch(console.error);
    }

    return res.status(200).json({ 
      message: "Verification documents submitted successfully",
      verificationStatus: updatedUser.verificationStatus,
      verificationDetails: (updatedUser.settings as any)?.verification
    });
  } catch (error: any) {
    console.error("Submit Verification Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not submit verification documents",
        requestId: req.id,
      },
    });
  }
}
