"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSession = getSession;
const database_1 = require("@tutor-advantage/database");
async function getSession(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                error: {
                    code: "UNAUTHORIZED",
                    message: "User ID missing from token",
                    requestId: req.id,
                },
            });
        }
        const user = await database_1.prisma.user.findUnique({
            where: { userId },
        });
        if (!user) {
            return res.status(401).json({
                error: {
                    code: "UNAUTHORIZED",
                    message: "User no longer exists",
                    requestId: req.id,
                },
            });
        }
        // Determine if guardian consent is required
        // Default rule: Students under 15 require consent. Tutors and Admins do not.
        let requiresGuardian = false;
        if (user.role === "STUDENT") {
            if (!user.dateOfBirth) {
                // If we don't know the DOB yet, enforce guardian just to be safe or prompt for DOB
                requiresGuardian = true;
            }
            else {
                const ageDifMs = Date.now() - user.dateOfBirth.getTime();
                const ageDate = new Date(ageDifMs);
                const age = Math.abs(ageDate.getUTCFullYear() - 1970);
                if (age < 15) {
                    // Check if consent has already been given and not revoked
                    const existingConsent = await database_1.prisma.userConsent.findFirst({
                        where: {
                            userId: user.userId,
                            consentType: "GUARDIAN_CONTACT_PAYMENT",
                            status: "granted",
                        },
                    });
                    requiresGuardian = !existingConsent;
                }
            }
        }
        return res.status(200).json({
            id: user.userId,
            name: user.displayName || "",
            role: user.role,
            requiresGuardian,
        });
    }
    catch (error) {
        console.error("Session Details Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not fetch session details",
                details: error.message,
                requestId: req.id,
            },
        });
    }
}
