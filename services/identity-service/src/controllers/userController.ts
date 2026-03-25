import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

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
