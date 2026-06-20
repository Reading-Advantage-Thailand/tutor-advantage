import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { uploadToGCS } from "../lib/storage";
import { logger } from "@tutor-advantage/shared-config";

export async function uploadFile(req: AuthenticatedRequest, res: Response) {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "No file uploaded" },
      });
    }

    const publicUrl = await uploadToGCS(file);

    return res.status(200).json({ url: publicUrl });
  } catch (error) {
    const err = error as Error;
    logger.error("Upload File Error:", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: `Could not upload file: ${err.message}`,
        requestId: req.id,
      },
    });
  }
}
