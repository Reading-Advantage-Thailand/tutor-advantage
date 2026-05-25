/**
 * devController.ts
 *
 * DEV-ONLY endpoints for managing users (create / update / delete).
 * All routes mounting this controller are guarded by devOnlyMiddleware —
 * they will never be reachable in production.
 */
import { Request, Response } from "express";
import { prisma } from "@tutor-advantage/database";

const ALLOWED_ROLES = ["ADMIN", "TUTOR", "STUDENT", "FINANCE_CHECKER"];

// GET /v1/dev/users
export const devListUsers = async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        userId: true,
        role: true,
        displayName: true,
        email: true,
        phoneNumber: true,
        profilePictureUrl: true,
        isActive: true,
        verificationStatus: true,
        verificationComment: true,
        sponsorTutorId: true,
        createdAt: true,
        updatedAt: true,
        oauthIdentities: {
          select: { provider: true, providerUserId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ users });
  } catch (err) {
    console.error("devListUsers error:", err);
    res.status(500).json({ error: "Could not list users" });
  }
};

// POST /v1/dev/users
export const devCreateUser = async (req: Request, res: Response) => {
  const { role, displayName, email, phoneNumber, isActive, verificationStatus } = req.body;

  if (!role || !ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${ALLOWED_ROLES.join(", ")}` });
  }

  try {
    const user = await prisma.user.create({
      data: {
        role,
        displayName: displayName || null,
        email: email || null,
        phoneNumber: phoneNumber || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        verificationStatus: verificationStatus || "UNVERIFIED",
      },
    });
    res.status(201).json({ user });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Email already exists" });
    }
    console.error("devCreateUser error:", err);
    res.status(500).json({ error: "Could not create user" });
  }
};

// PATCH /v1/dev/users/:id
export const devUpdateUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    role,
    displayName,
    email,
    phoneNumber,
    profilePictureUrl,
    isActive,
    verificationStatus,
    verificationComment,
    sponsorTutorId,
  } = req.body;

  if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${ALLOWED_ROLES.join(", ")}` });
  }

  const data: Record<string, unknown> = {};
  if (role !== undefined) data.role = role;
  if (displayName !== undefined) data.displayName = displayName || null;
  if (email !== undefined) data.email = email || null;
  if (phoneNumber !== undefined) data.phoneNumber = phoneNumber || null;
  if (profilePictureUrl !== undefined) data.profilePictureUrl = profilePictureUrl || null;
  if (isActive !== undefined) data.isActive = Boolean(isActive);
  if (verificationStatus !== undefined) data.verificationStatus = verificationStatus;
  if (verificationComment !== undefined) data.verificationComment = verificationComment || null;
  if (sponsorTutorId !== undefined) data.sponsorTutorId = sponsorTutorId || null;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  try {
    const user = await prisma.user.update({
      where: { userId: id },
      data,
    });
    res.json({ user });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Email already exists" });
    }
    console.error("devUpdateUser error:", err);
    res.status(500).json({ error: "Could not update user" });
  }
};

// DELETE /v1/dev/users/:id
export const devDeleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // Hard delete — cascade handled by DB foreign key constraints
    await prisma.user.delete({ where: { userId: id } });
    res.json({ success: true, message: `User ${id} permanently deleted` });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    console.error("devDeleteUser error:", err);
    res.status(500).json({ error: "Could not delete user" });
  }
};
