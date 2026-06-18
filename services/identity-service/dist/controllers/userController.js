"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentUser = getCurrentUser;
exports.submitVerification = submitVerification;
const database_1 = require("@tutor-advantage/database");
const storage_1 = require("../lib/storage");
const shared_config_1 = require("@tutor-advantage/shared-config");
async function getCurrentUser(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                error: { code: "UNAUTHORIZED", message: "User not identified" },
            });
        }
        const user = await database_1.prisma.user.findUnique({
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
    }
    catch (error) {
        const err = error;
        shared_config_1.logger.error("Get Current User Error:", err);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not fetch user profile",
                requestId: req.id,
            },
        });
    }
}
async function submitVerification(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                error: { code: "UNAUTHORIZED", message: "User not identified" },
            });
        }
        const { idCardImageUrl, bankBookImageUrl, address, bankAccountNumber, bankBrand, taxName, nationalId } = req.body;
        const normalizedBankAccountNumber = typeof bankAccountNumber === "string"
            ? bankAccountNumber.replace(/\D/g, "")
            : "";
        const normalizedTaxName = typeof taxName === "string" ? taxName.trim() : "";
        const normalizedNationalId = typeof nationalId === "string" ? nationalId.replace(/\D/g, "") : "";
        const VALID_BANK_BRANDS = [
            "kbank", "scb", "bbl", "bay", "tmb", "ttb",
            "kiatnakin", "cimb", "gsb", "baac", "mhcb", "uob", "lhb",
        ];
        const normalizedBankBrand = typeof bankBrand === "string" && VALID_BANK_BRANDS.includes(bankBrand.toLowerCase())
            ? bankBrand.toLowerCase()
            : null;
        if (!idCardImageUrl && !bankBookImageUrl && !address && !normalizedBankAccountNumber && !normalizedTaxName && !normalizedNationalId) {
            return res.status(400).json({
                error: { code: "BAD_REQUEST", message: "At least one verification field must be provided" },
            });
        }
        // Load current user settings and images
        const currentUser = await database_1.prisma.user.findUnique({
            where: { userId },
            select: { settings: true, idCardImageUrl: true, bankBookImageUrl: true }
        });
        const currentSettings = currentUser?.settings || {};
        const verification = currentSettings.verification || {};
        const updatedData = {};
        const newVerification = { ...verification };
        const now = new Date().toISOString();
        if ((bankBookImageUrl || normalizedBankAccountNumber) && !normalizedBankAccountNumber) {
            return res.status(400).json({
                error: {
                    code: "BAD_REQUEST",
                    message: "Bank account number is required with bank book verification",
                },
            });
        }
        if ((normalizedTaxName || normalizedNationalId) && (!normalizedTaxName || normalizedNationalId.length !== 13)) {
            return res.status(400).json({
                error: {
                    code: "BAD_REQUEST",
                    message: "Tax name and 13-digit national ID are required for tax info verification",
                },
            });
        }
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
        if (normalizedTaxName || normalizedNationalId) {
            currentSettings.taxName = normalizedTaxName;
            currentSettings.nationalId = normalizedNationalId;
            newVerification.taxInfo = { status: "PENDING", comment: "", updatedAt: now };
        }
        updatedData.settings = { ...currentSettings, verification: newVerification };
        const verificationFields = ["idCard", "bankBook", "address", "taxInfo"];
        const allVerified = verificationFields.every((field) => newVerification[field]?.status === "VERIFIED");
        const hasRejected = verificationFields.some((field) => newVerification[field]?.status === "REJECTED");
        const hasPending = verificationFields.some((field) => newVerification[field]?.status === "PENDING");
        if (allVerified) {
            updatedData.verificationStatus = "VERIFIED";
        }
        else if (hasRejected) {
            updatedData.verificationStatus = "REJECTED";
        }
        else if (hasPending) {
            updatedData.verificationStatus = "PENDING";
        }
        else {
            updatedData.verificationStatus = "UNVERIFIED";
        }
        updatedData.verificationComment = null;
        const updatedUser = await database_1.prisma.user.update({
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
            (0, storage_1.deleteFromGCS)(currentUser.idCardImageUrl).catch(e => shared_config_1.logger.error(e));
        }
        if (bankBookImageUrl && currentUser?.bankBookImageUrl && currentUser.bankBookImageUrl !== bankBookImageUrl) {
            (0, storage_1.deleteFromGCS)(currentUser.bankBookImageUrl).catch(e => shared_config_1.logger.error(e));
        }
        return res.status(200).json({
            message: "Verification documents submitted successfully",
            verificationStatus: updatedUser.verificationStatus,
            verificationDetails: updatedUser.settings?.verification
        });
    }
    catch (error) {
        const err = error;
        shared_config_1.logger.error("Submit Verification Error:", err);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not submit verification documents",
                requestId: req.id,
            },
        });
    }
}
