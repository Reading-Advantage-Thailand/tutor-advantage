import { prisma } from "@tutor-advantage/database";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "secret-for-dev-only-change-me";

export interface AuthResult {
  sessionToken: string;
  user: {
    id: string;
    name: string;
    role: string;
    requiresGuardian: boolean;
  };
}

export async function processOAuthLogin(
  provider: string,
  providerSubject: string,
  email: string | undefined,
  name: string,
): Promise<AuthResult> {
  let user;

  // 1. Check if OAuth Identity already exists
  const existingIdentity = await prisma.oAuthIdentity.findUnique({
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
  } else {
    // 2. If no identity, check if user exists by email (if email is provided by OAuth)
    if (email) {
      user = await prisma.user.findUnique({
        where: { email },
      });
    }

    // 3. If still no user, create a new one. Default role for Google/Facebook is TUTOR
    if (!user) {
      // Create user and link identity in one transaction
      user = await prisma.user.create({
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
    } else {
      // User exists by email, but new provider linkage
      await prisma.oAuthIdentity.create({
        data: {
          userId: user.userId,
          provider,
          providerSubject,
        },
      });
    }
  }

  // Generate JWT token
  const sessionToken = jwt.sign(
    { userId: user.userId, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" },
  );

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
