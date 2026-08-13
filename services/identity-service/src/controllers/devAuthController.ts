import { Request, Response } from "express";
import { processDevLogin } from "../services/authService";

const DEV_PROFILES = {
  TUTOR: {
    subject: "tutor",
    email: "dev-tutor@localhost",
    name: "Dev Tutor",
  },
  STUDENT: {
    subject: "student",
    email: "dev-student@localhost",
    name: "Dev Student",
  },
} as const;

/**
 * Creates a real database-backed session for local development only.
 * The stable provider subject makes repeated logins idempotent.
 */
export async function handleDevLogin(req: Request, res: Response) {
  if (process.env.NODE_ENV === "production" || process.env.ENABLE_DEV_ROUTES !== "true") {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
  }

  const role = req.body?.role === "TUTOR" ? "TUTOR" : req.body?.role === "STUDENT" ? "STUDENT" : null;
  if (!role) {
    return res.status(400).json({
      error: { code: "BAD_REQUEST", message: "role must be TUTOR or STUDENT" },
    });
  }

  try {
    const profile = DEV_PROFILES[role];
    const result = await processDevLogin(
      profile.subject,
      profile.email,
      profile.name,
      role,
    );

    return res.status(200).json({ ...result, dev: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dev login failed";
    return res.status(500).json({
      error: { code: "DEV_LOGIN_FAILED", message },
    });
  }
}
