import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { logger } from "@tutor-advantage/shared-config";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

export async function getSystemRoles(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ error: { message: "Forbidden: ADMIN only" } });
    }

    const users = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "FINANCE_CHECKER"] }
      },
      select: {
        userId: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(users);
  } catch (error) {
    logger.error("Error fetching system roles:", error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
}

export async function upsertSystemRole(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ error: { message: "Forbidden: ADMIN only" } });
    }

    const { email, role } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: { message: "Email is required" } });
    }
    if (!["ADMIN", "FINANCE_CHECKER"].includes(role)) {
      return res.status(400).json({ error: { message: "Invalid role" } });
    }

    const emailLower = email.toLowerCase().trim();

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email: emailLower },
    });

    if (user) {
      // Update role
      user = await prisma.user.update({
        where: { userId: user.userId },
        data: { role },
      });
    } else {
      // Create pre-assigned shell user
      user = await prisma.user.create({
        data: {
          email: emailLower,
          role,
          displayName: emailLower, // Placeholder
          isActive: true,
        },
      });
    }

    return res.status(200).json({
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
    });
  } catch (error) {
    logger.error("Error upserting system role:", error);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
}
