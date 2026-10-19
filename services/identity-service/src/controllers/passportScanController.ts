import { Response } from "express";
import { logger } from "@tutor-advantage/shared-config";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { InvalidVerificationFileError, validateVerificationFile } from "../lib/storage";
import { isPassportScanConfigured, scanPassportImage } from "../services/passportScan";

function errorResponse(res: Response, req: AuthenticatedRequest, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message, requestId: req.id } });
}

/**
 * POST /v1/users/me/passport-scan — reads a passport photo page and returns
 * suggested form values. Nothing is stored, and the values are never logged.
 */
export async function scanPassportPhoto(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return errorResponse(res, req, 401, "UNAUTHORIZED", "User not identified");
  if (!req.file) return errorResponse(res, req, 400, "BAD_REQUEST", "No file uploaded");

  let mimeType: string;
  try {
    mimeType = validateVerificationFile(req.file).mimeType;
  } catch (error) {
    if (error instanceof InvalidVerificationFileError) return errorResponse(res, req, 400, error.code, error.message);
    throw error;
  }

  if (!isPassportScanConfigured()) {
    return errorResponse(res, req, 503, "PASSPORT_SCAN_UNAVAILABLE", "Passport scan is not available");
  }

  res.set("Cache-Control", "no-store");
  try {
    const scan = await scanPassportImage({ buffer: req.file.buffer, mimeType });
    if (!scan) {
      logger.info("Passport scan found no passport data", { userId });
      return errorResponse(res, req, 422, "PASSPORT_NOT_READABLE", "No passport data could be read from this image");
    }
    logger.info("Passport scan read fields", {
      userId,
      fieldCount: Object.keys(scan.fields).length,
      confirmedCount: scan.confirmed.length,
    });
    return res.status(200).json({ scan });
  } catch (error) {
    // Only the error type: provider errors can echo the model output (passport data).
    logger.error("Passport scan failed", { userId, errorName: (error as Error)?.name ?? "Error" });
    return errorResponse(res, req, 502, "PASSPORT_SCAN_FAILED", "Could not read the passport photo");
  }
}
