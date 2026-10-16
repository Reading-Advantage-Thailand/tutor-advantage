import { Response } from "express";
import { prisma, type Prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import {
  deleteFromGCS,
  getSignedVerificationUrl,
  isOwnedVerificationObjectKey,
} from "../lib/storage";
import {
  CONSENT_STATUS_GRANTED,
  FOREIGN_PRIVACY_NOTICE_CONSENT_TYPE,
  GUARDIAN_CONSENT_TYPE,
  RIGHT_TO_WORK_CONSENT_TYPE,
  computeTutorVerificationStatus,
  encryptPii,
  isExpired,
  isIdType,
  isPiiEncryptionConfigured,
  isTeachingLocation,
  isValidNationality,
  isValidPassportNumber,
  isValidThaiId,
  logger,
  normalizeNationality,
  normalizePassportNumber,
  normalizeThaiId,
  parseIsoDate,
  payoutDocumentBlock,
  requiresGuardianConsent,
  requiresWorkPermit,
  type IdType,
} from "@tutor-advantage/shared-config";

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
        dateOfBirth: true,
        role: true,
        isActive: true,
        settings: true,
        idCardImageUrl: true,
        bankBookImageUrl: true,
        verificationStatus: true,
        verificationComment: true,
        createdAt: true,
        idType: true,
        passportNumberLast4: true,
        passportNationality: true,
        passportExpiresOn: true,
        teachingLocation: true,
        workPermitImageUrl: true,
        workPermitExpiresOn: true,
        rightToWorkConfirmedAt: true,
        taxResidency: true,
        userConsents: {
          where: { consentType: "TERMS_AND_PRIVACY", status: "ACCEPTED" },
          orderBy: { effectiveAt: "desc" },
          take: 1,
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "User not found" },
      });
    }

    // Database values are owner-bound object keys.  Only expose a short-lived
    // read URL to the authenticated owner; never return the raw key or an old
    // arbitrary URL stored by a legacy client.
    const [idCardImageUrl, bankBookImageUrl, workPermitImageUrl] = await Promise.all([
      user.idCardImageUrl
        ? getSignedVerificationUrl(user.idCardImageUrl, user.userId)
        : Promise.resolve(null),
      user.bankBookImageUrl
        ? getSignedVerificationUrl(user.bankBookImageUrl, user.userId)
        : Promise.resolve(null),
      user.workPermitImageUrl
        ? getSignedVerificationUrl(user.workPermitImageUrl, user.userId)
        : Promise.resolve(null),
    ]);

    const guardianConsent =
      user.role === "STUDENT" && user.dateOfBirth
        ? await prisma.userConsent.findFirst({
            where: {
              userId: user.userId,
              consentType: GUARDIAN_CONSENT_TYPE,
              status: CONSENT_STATUS_GRANTED,
            },
            select: { userConsentId: true },
          })
        : null;

    const privacyNotice =
      user.idType === "PASSPORT"
        ? await prisma.userConsent.findFirst({
            where: { userId: user.userId, consentType: FOREIGN_PRIVACY_NOTICE_CONSENT_TYPE, status: "ACCEPTED" },
            orderBy: { effectiveAt: "desc" },
            select: { effectiveAt: true },
          })
        : null;

    const {
      idType,
      passportNumberLast4,
      passportNationality,
      passportExpiresOn,
      teachingLocation,
      workPermitExpiresOn,
      rightToWorkConfirmedAt,
      taxResidency,
      workPermitImageUrl: _workPermitKey,
      ...profile
    } = user;

    return res.status(200).json({
      user: {
        ...profile,
        idCardImageUrl,
        bankBookImageUrl,
        // Identity document; the passport number itself is never returned.
        identity: {
          idType,
          passportNumberMasked: passportNumberLast4 ? `••••${passportNumberLast4}` : null,
          passportNationality,
          passportExpiresOn: passportExpiresOn?.toISOString().slice(0, 10) ?? null,
          teachingLocation,
          workPermitRequired: requiresWorkPermit(user),
          workPermitImageUrl,
          workPermitExpiresOn: workPermitExpiresOn?.toISOString().slice(0, 10) ?? null,
          rightToWorkConfirmedAt: rightToWorkConfirmedAt?.toISOString() ?? null,
          privacyNoticeAcceptedAt: privacyNotice?.effectiveAt.toISOString() ?? null,
          taxResidency,
          payoutBlock: payoutDocumentBlock(user),
        },
        dateOfBirth: user.dateOfBirth?.toISOString().slice(0, 10) ?? null,
        requiresGuardian: requiresGuardianConsent(
          user.role,
          user.dateOfBirth,
          Boolean(guardianConsent),
        ),
      },
    });
  } catch (error) {
    const err = error as Error;
    logger.error("Get Current User Error:", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch user profile",
        requestId: req.id,
      },
    });
  }
}

export async function updateCurrentUserProfile(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "User not identified" },
      });
    }

    const dateOfBirth = parseDateOnly(req.body?.dateOfBirth);
    if (!dateOfBirth) {
      return res.status(400).json({
        error: {
          code: "INVALID_DATE_OF_BIRTH",
          message: "dateOfBirth must be a valid YYYY-MM-DD date not in the future",
          requestId: req.id,
        },
      });
    }

    const user = await prisma.user.update({
      where: { userId },
      data: { dateOfBirth },
      select: { userId: true, role: true, dateOfBirth: true },
    });
    const guardianConsent =
      user.role === "STUDENT"
        ? await prisma.userConsent.findFirst({
            where: {
              userId,
              consentType: GUARDIAN_CONSENT_TYPE,
              status: CONSENT_STATUS_GRANTED,
            },
            select: { userConsentId: true },
          })
        : null;

    return res.status(200).json({
      user: {
        id: user.userId,
        dateOfBirth: user.dateOfBirth?.toISOString().slice(0, 10) ?? null,
        requiresGuardian: requiresGuardianConsent(
          user.role,
          user.dateOfBirth,
          Boolean(guardianConsent),
        ),
      },
    });
  } catch (error) {
    logger.error("Update Current User Profile Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not update user profile",
        requestId: req.id,
      },
    });
  }
}

export function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value ||
    parsed.getTime() > Date.now()
  ) {
    return null;
  }
  return parsed;
}

function badRequest(res: Response, req: AuthenticatedRequest, code: string, message: string) {
  return res.status(400).json({ error: { code, message, requestId: req.id } });
}

/**
 * Tutor submits one or more verification steps. Every submitted step goes
 * back to PENDING and needs admin review before payouts resume.
 *
 * Tax info carries the identity document: a Thai ID (13-digit checksum) or a
 * passport (6–20 letters/digits, nationality, future expiry, teaching
 * location, privacy notice consent and right-to-work confirmation). The
 * passport number is stored encrypted, with only the last 4 kept in clear.
 * Passport holders teaching from Thailand also submit a work permit.
 */
export async function submitVerification(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "User not identified" },
      });
    }

    const {
      idCardImageUrl,
      bankBookImageUrl,
      address,
      bankAccountNumber,
      bankBrand,
      taxName,
      nationalId,
      idType: rawIdType,
      passportNumber,
      passportNationality,
      passportExpiresOn,
      teachingLocation,
      privacyNoticeAccepted,
      rightToWorkConfirmed,
      workPermitImageUrl,
      workPermitExpiresOn,
    } = req.body ?? {};
    const normalizedBankAccountNumber =
      typeof bankAccountNumber === "string"
        ? bankAccountNumber.replace(/\D/g, "")
        : "";
    const normalizedTaxName = typeof taxName === "string" ? taxName.trim() : "";
    const normalizedNationalId = normalizeThaiId(nationalId);
    const normalizedPassport = normalizePassportNumber(passportNumber);
    const submitsTaxInfo = Boolean(normalizedTaxName || normalizedNationalId || normalizedPassport);
    const submitsWorkPermit = Boolean(workPermitImageUrl || workPermitExpiresOn);

    if (rawIdType !== undefined && !isIdType(rawIdType)) {
      return badRequest(res, req, "INVALID_ID_TYPE", "idType must be THAI_ID or PASSPORT");
    }
    // Existing clients send no idType: they are Thai ID submissions.
    const idType: IdType = rawIdType ?? (normalizedPassport ? "PASSPORT" : "THAI_ID");

    for (const key of [idCardImageUrl, bankBookImageUrl, workPermitImageUrl]) {
      if (key !== undefined && key !== null && !isOwnedVerificationObjectKey(key, userId)) {
        return res.status(400).json({
          error: {
            code: "INVALID_VERIFICATION_DOCUMENT",
            message: "Verification documents must come from your own upload",
            requestId: req.id,
          },
        });
      }
    }

    const VALID_BANK_BRANDS = [
      "kbank", "scb", "bbl", "bay", "tmb", "ttb",
      "kiatnakin", "cimb", "gsb", "baac", "mhcb", "uob", "lhb",
    ];
    // Thai bank accounts only (phase 1); foreign accounts come later.
    const normalizedBankBrand =
      typeof bankBrand === "string" && VALID_BANK_BRANDS.includes(bankBrand.toLowerCase())
        ? bankBrand.toLowerCase()
        : null;

    if (!idCardImageUrl && !bankBookImageUrl && !address && !normalizedBankAccountNumber && !submitsTaxInfo && !submitsWorkPermit) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "At least one verification field must be provided" },
      });
    }

    if ((bankBookImageUrl || normalizedBankAccountNumber) && !normalizedBankAccountNumber) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "Bank account number is required with bank book verification",
        },
      });
    }

    // Load current user settings and documents
    const currentUser = await prisma.user.findUnique({
      where: { userId },
      select: {
        settings: true,
        idCardImageUrl: true,
        bankBookImageUrl: true,
        idType: true,
        teachingLocation: true,
        workPermitImageUrl: true,
        workPermitExpiresOn: true,
        passportNumberEnc: true,
        rightToWorkConfirmedAt: true,
        userConsents: {
          where: { consentType: FOREIGN_PRIVACY_NOTICE_CONSENT_TYPE, status: "ACCEPTED" },
          select: { userConsentId: true },
          take: 1,
        },
      },
    });
    const isSavedPassport = currentUser?.idType === "PASSPORT";
    // A passport holder editing other details keeps the stored (encrypted)
    // number and earlier consents instead of re-entering them.
    const keepsSavedPassport = !normalizedPassport && isSavedPassport && Boolean(currentUser?.passportNumberEnc);
    const privacyAlreadyAccepted = isSavedPassport && (currentUser?.userConsents?.length ?? 0) > 0;
    const rightToWorkAlreadyConfirmed = isSavedPassport && Boolean(currentUser?.rightToWorkConfirmedAt);

    // ── Identity document validation (before anything is written) ──
    let passportExpiry: Date | null = null;
    if (submitsTaxInfo) {
      if (!normalizedTaxName) {
        return badRequest(res, req, "BAD_REQUEST", "The name as shown on the ID is required");
      }
      if (idType === "THAI_ID") {
        if (!isValidThaiId(normalizedNationalId)) {
          return badRequest(res, req, "INVALID_THAI_ID", "Thai national ID must be 13 digits with a valid check digit");
        }
      } else {
        if (!keepsSavedPassport && !isValidPassportNumber(normalizedPassport)) {
          return badRequest(res, req, "INVALID_PASSPORT_NUMBER", "Passport number must be 6–20 letters or digits");
        }
        if (!isValidNationality(passportNationality)) {
          return badRequest(res, req, "INVALID_NATIONALITY", "Nationality must be a 2- or 3-letter country code");
        }
        passportExpiry = parseIsoDate(passportExpiresOn);
        if (!passportExpiry || isExpired(passportExpiry) || bangkokToday() === passportExpiresOn) {
          return badRequest(res, req, "PASSPORT_EXPIRED", "Passport expiry date must be in the future");
        }
        if (!isTeachingLocation(teachingLocation)) {
          return badRequest(res, req, "INVALID_TEACHING_LOCATION", "teachingLocation must be THAILAND or ABROAD");
        }
        if (privacyNoticeAccepted !== true && !privacyAlreadyAccepted) {
          return badRequest(res, req, "PRIVACY_NOTICE_REQUIRED", "The privacy notice must be accepted");
        }
        if (rightToWorkConfirmed !== true && !rightToWorkAlreadyConfirmed) {
          return badRequest(res, req, "RIGHT_TO_WORK_REQUIRED", "You must confirm you have the legal right to work");
        }
        if (normalizedPassport && !isPiiEncryptionConfigured()) {
          logger.error("Submit Verification: PII_ENCRYPTION_KEY is not configured");
          return res.status(503).json({
            error: { code: "PASSPORT_UNAVAILABLE", message: "Passport submission is temporarily unavailable", requestId: req.id },
          });
        }
      }
    }

    // The identity the tutor will have after this request.
    const nextIdentity = {
      idType: submitsTaxInfo ? idType : currentUser?.idType ?? "THAI_ID",
      teachingLocation: submitsTaxInfo
        ? idType === "PASSPORT" ? (teachingLocation as string) : null
        : currentUser?.teachingLocation ?? null,
    };

    let workPermitExpiry: Date | null = null;
    if (submitsWorkPermit) {
      if (!requiresWorkPermit(nextIdentity)) {
        return badRequest(res, req, "WORK_PERMIT_NOT_REQUIRED", "A work permit is only needed for passport holders teaching from Thailand");
      }
      workPermitExpiry = parseIsoDate(workPermitExpiresOn);
      if (!workPermitImageUrl || !workPermitExpiry || isExpired(workPermitExpiry) || bangkokToday() === workPermitExpiresOn) {
        return badRequest(res, req, "INVALID_WORK_PERMIT", "A work permit document and a future expiry date are required");
      }
    }

    const currentSettings = (currentUser?.settings as Record<string, any>) || {};
    const verification = currentSettings.verification || {};

    const updatedData: Prisma.UserUpdateInput = {};
    const newVerification = { ...verification };
    const now = new Date().toISOString();
    const consentTypes: string[] = [];

    // Previously verified fields can be re-submitted — they will be reset to PENDING
    // and require admin re-approval before payouts resume.

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
      if (normalizedBankBrand) {
        currentSettings.bankBrand = normalizedBankBrand;
      }
      updatedData.bankBookImageUrl = bankBookImageUrl;
      newVerification.bankBook = { status: "PENDING", comment: "", updatedAt: now };
    }

    if (submitsTaxInfo) {
      currentSettings.taxName = normalizedTaxName;
      newVerification.taxInfo = { status: "PENDING", comment: "", updatedAt: now };
      updatedData.idType = idType;
      if (idType === "THAI_ID") {
        currentSettings.nationalId = normalizedNationalId;
        updatedData.passportNumberEnc = null;
        updatedData.passportNumberLast4 = null;
        updatedData.passportNationality = null;
        updatedData.passportExpiresOn = null;
        updatedData.teachingLocation = null;
      } else {
        delete currentSettings.nationalId;
        if (normalizedPassport) {
          updatedData.passportNumberEnc = encryptPii(normalizedPassport);
          updatedData.passportNumberLast4 = normalizedPassport.slice(-4);
        }
        updatedData.passportNationality = normalizeNationality(passportNationality);
        updatedData.passportExpiresOn = passportExpiry;
        updatedData.teachingLocation = teachingLocation as string;
        if (privacyNoticeAccepted === true && !privacyAlreadyAccepted) {
          consentTypes.push(FOREIGN_PRIVACY_NOTICE_CONSENT_TYPE);
        }
        if (rightToWorkConfirmed === true && !rightToWorkAlreadyConfirmed) {
          updatedData.rightToWorkConfirmedAt = new Date();
          consentTypes.push(RIGHT_TO_WORK_CONSENT_TYPE);
        }
      }
      // No work permit needed any more: drop the old one and its review.
      if (!requiresWorkPermit(nextIdentity)) {
        updatedData.workPermitImageUrl = null;
        updatedData.workPermitExpiresOn = null;
        delete newVerification.workPermit;
      }
    }

    if (submitsWorkPermit) {
      updatedData.workPermitImageUrl = workPermitImageUrl;
      updatedData.workPermitExpiresOn = workPermitExpiry;
      newVerification.workPermit = { status: "PENDING", comment: "", updatedAt: now };
    }

    updatedData.settings = { ...currentSettings, verification: newVerification };
    // Any user-submitted verification or payout identity change invalidates a
    // settlement review that may already contain this tutor.
    updatedData.payoutIdentityVersion = { increment: 1 };
    updatedData.verificationStatus = computeTutorVerificationStatus(newVerification, nextIdentity);
    updatedData.verificationComment = null;

    const effectiveAt = new Date();
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { userId },
        data: updatedData,
        select: {
          userId: true,
          verificationStatus: true,
          settings: true,
        },
      }),
      ...consentTypes.map((consentType) =>
        prisma.userConsent.create({
          data: { userId, consentType, status: "ACCEPTED", effectiveAt },
        }),
      ),
    ]);

    // Background cleanup old images to save space
    const replaced: Array<[string | null | undefined, unknown]> = [
      [currentUser?.idCardImageUrl, idCardImageUrl],
      [currentUser?.bankBookImageUrl, bankBookImageUrl],
      [currentUser?.workPermitImageUrl, updatedData.workPermitImageUrl],
    ];
    for (const [previous, next] of replaced) {
      if (previous && next !== undefined && previous !== next) {
        deleteFromGCS(previous).catch(e => logger.error(e));
      }
    }

    return res.status(200).json({
      message: "Verification documents submitted successfully",
      verificationStatus: updatedUser.verificationStatus,
      verificationDetails: (updatedUser.settings as any)?.verification
    });
  } catch (error) {
    const err = error as Error;
    logger.error("Submit Verification Error:", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not submit verification documents",
        requestId: req.id,
      },
    });
  }
}

function bangkokToday(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
