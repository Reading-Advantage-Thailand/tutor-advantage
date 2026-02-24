"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processOAuthLogin = processOAuthLogin;
const database_1 = require("@tutor-advantage/database");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || "secret-for-dev-only-change-me";
async function processOAuthLogin(provider, providerSubject, email, name) {
    let user;
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
    }
    else {
        // 2. If no identity, check if user exists by email (if email is provided by OAuth)
        if (email) {
            user = await database_1.prisma.user.findUnique({
                where: { email },
            });
        }
        // 3. If still no user, create a new one. Default role for Google/Facebook is TUTOR
        if (!user) {
            // Create user and link identity in one transaction
            user = await database_1.prisma.user.create({
                data: {
                    role: "TUTOR",
                    displayName: name,
                    email: email,
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
            await database_1.prisma.oAuthIdentity.create({
                data: {
                    userId: user.userId,
                    provider,
                    providerSubject,
                },
            });
        }
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
