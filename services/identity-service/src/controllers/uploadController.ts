import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { uploadToGCS } from "../lib/storage";

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
  } catch (error: any) {
    console.error("Upload File Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not upload file",
        requestId: req.id,
      },
    });
  }
}
