"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processOAuthLogin = processOAuthLogin;
const database_1 = require("@tutor-advantage/database");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || "secret-for-dev-only-change-me";
async function processOAuthLogin(provider, providerSubject, email, name, picture = "", sponsorTutorId) {
    let user;
    const invitedSponsorId = provider !== "line" && sponsorTutorId
        ? await resolveActiveTutorSponsorId(sponsorTutorId)
        : null;
    // 1. Check if OAuth Identity already exists
    const existingIdentity = await database_1.prisma.oAuthIdentity.findUnique({
        where: {
            provider_providerSubject: {
                provider,
                providerSubject,
            },
        },
        include: {
            user: true,
        },
    });
    if (existingIdentity) {
        user = existingIdentity.user;
        // If the identity already exists, optionally update the profile picture if missing
        if (picture && !user.profilePictureUrl) {
            user = await database_1.prisma.user.update({
                where: { userId: user.userId },
                data: { profilePictureUrl: picture },
            });
        }
    }
    else {
        // 2. If no identity, check if user exists by email (if email is provided by OAuth)
        if (email) {
            user = await database_1.prisma.user.findUnique({
                where: { email },
            });
        }
        // 3. If still no user, create a new one.
        if (!user) {
            // Default role based on provider
            const role = provider === "line" ? "STUDENT" : "TUTOR";
            // Create user and link identity in one transaction
            user = await database_1.prisma.user.create({
                data: {
                    role,
                    displayName: name,
                    email: email,
                    profilePictureUrl: picture || null,
                    sponsorTutorId: role === "TUTOR" ? invitedSponsorId : null,
                    sponsorLockedAt: role === "TUTOR" && invitedSponsorId ? new Date() : null,
                    oauthIdentities: {
                        create: {
                            provider,
                            providerSubject,
                        },
                    },
                },
            });
        }
        else {
            // User exists by email, but new provider linkage
            // Optionally update picture if they don't have one
            if (picture && !user.profilePictureUrl) {
                user = await database_1.prisma.user.update({
                    where: { userId: user.userId },
                    data: { profilePictureUrl: picture },
                });
            }
            await database_1.prisma.oAuthIdentity.create({
                data: {
                    userId: user.userId,
                    provider,
                    providerSubject,
                },
            });
        }
    }
    if (provider !== "line" &&
        invitedSponsorId &&
        user.userId !== invitedSponsorId &&
        !user.sponsorTutorId &&
        !user.sponsorLockedAt) {
        user = await database_1.prisma.user.update({
            where: { userId: user.userId },
            data: {
                sponsorTutorId: invitedSponsorId,
                sponsorLockedAt: new Date(),
            },
        });
    }
    // Generate JWT token
    const sessionToken = jsonwebtoken_1.default.sign({ userId: user.userId, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    return {
        sessionToken,
        user: {
            id: user.userId,
            name: user.displayName || "",
            role: user.role,
            requiresGuardian: false, // Tutors are adults
        },
    };
}
async function resolveActiveTutorSponsorId(sponsorTutorId) {
    const sponsor = await database_1.prisma.user.findFirst({
        where: { userId: sponsorTutorId, role: "TUTOR", isActive: true },
        select: { userId: true },
    });
    return sponsor?.userId || null;
}
