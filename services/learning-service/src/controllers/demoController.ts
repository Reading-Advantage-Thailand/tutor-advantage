import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { getDemoLessons } from "../services/demoLessons";

// Lists the fixed free demo lessons (one per level) for the tutor demo picker.
export async function getDemoLessonCatalog(
  _req: AuthenticatedRequest,
  res: Response,
) {
  return res.status(200).json({ lessons: getDemoLessons() });
}
