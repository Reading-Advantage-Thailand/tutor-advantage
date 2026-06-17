import { logger } from "@tutor-advantage/shared-config";
import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

const formatAmount = (amountMinor: bigint | number | null | undefined) => {
  if (amountMinor == null) return "-";
  return `${(Number(amountMinor) / 100).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} THB`;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getExceptions = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { status, q } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (q?.trim()) {
      const search = q.trim();
      where.OR = [
        ...(UUID_RE.test(search) ? [{ exceptionId: search }] : []),
        { type: { contains: search, mode: "insensitive" } },
        { studentName: { contains: search, mode: "insensitive" } },
        { classId: { contains: search, mode: "insensitive" } },
        { provider: { contains: search, mode: "insensitive" } },
        { errorDetail: { contains: search, mode: "insensitive" } },
      ];
    }

    const exceptions = await prisma.exception.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.status(200).json({
      exceptions: exceptions.map((item) => ({
        id: item.exceptionId,
        type: item.type,
        studentName: item.studentName ?? "Unknown student",
        classId: item.classId ?? "-",
        provider: item.provider ?? "-",
        amount: formatAmount(item.amountMinor),
        amountMinor:
          item.amountMinor == null ? null : Number(item.amountMinor),
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        errorDetail: item.errorDetail ?? "",
      })),
    });
  } catch (error) {
    logger.error("Get Exceptions Error:", error);
    res.status(500).json({ error: "Could not fetch exceptions" });
  }
};

export const resolveException = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const { id, action } = req.params;
  const userId = req.user?.userId;
  const normalizedAction = action.replace(/\s+/g, "_").toUpperCase();
  const status =
    normalizedAction === "VOID" || normalizedAction === "VOID_CANCEL"
      ? "VOIDED"
      : "RESOLVED";

  try {
    const current = await prisma.exception.findUnique({
      where: { exceptionId: id },
    });

    if (!current) {
      return res.status(404).json({ error: "Exception not found" });
    }

    const exception = await prisma.exception.update({
      where: { exceptionId: id },
      data: { status, updatedAt: new Date() },
    });

    if (userId) {
      await prisma.auditEvent.create({
        data: {
          actorId: userId,
          action: `EXCEPTION_${normalizedAction}`,
          entityType: "Exception",
          entityId: id,
          payload: {
            previousStatus: current.status,
            newStatus: status,
            exceptionType: exception.type,
          },
        },
      });
    }

    res.status(200).json({
      success: true,
      message: `Exception ${id} updated to ${status}`,
    });
  } catch (error) {
    logger.error("Resolve Exception Error:", error);
    res.status(500).json({ error: "Could not update exception" });
  }
};

export const getUnresolvedLinks = async (
  _req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const links = await prisma.unresolvedLegacyLink.findMany({
      orderBy: [{ hits: "desc" }, { lastSeen: "desc" }],
      take: 100,
    });

    res.status(200).json({
      links: links.map((link) => ({
        url: link.url,
        hits: link.hits,
        lastSeen: link.lastSeen,
      })),
    });
  } catch (error) {
    logger.error("Get Unresolved Links Error:", error);
    res.status(500).json({ error: "Could not fetch unresolved links" });
  }
};

export const getMappings = async (
  _req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const mappings = await prisma.legacyLinkMapping.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.status(200).json({
      mappings: mappings.map((mapping) => ({
        id: mapping.mappingId,
        source: mapping.sourceUrl,
        target: mapping.targetPath,
        created: mapping.createdAt.toISOString().split("T")[0],
        createdAt: mapping.createdAt,
      })),
    });
  } catch (error) {
    logger.error("Get Legacy Mappings Error:", error);
    res.status(500).json({ error: "Could not fetch legacy mappings" });
  }
};

export const createMapping = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const { source, target } = req.body as {
    source?: string;
    target?: string;
  };

  if (!source?.trim() || !target?.trim()) {
    return res.status(400).json({ error: "source and target are required" });
  }

  try {
    const mapping = await prisma.legacyLinkMapping.upsert({
      where: { sourceUrl: source.trim() },
      update: { targetPath: target.trim() },
      create: {
        sourceUrl: source.trim(),
        targetPath: target.trim(),
      },
    });

    await prisma.unresolvedLegacyLink.deleteMany({
      where: { url: source.trim() },
    });

    res.status(201).json({
      success: true,
      mapping: {
        id: mapping.mappingId,
        source: mapping.sourceUrl,
        target: mapping.targetPath,
        created: mapping.createdAt.toISOString().split("T")[0],
      },
    });
  } catch (error) {
    logger.error("Create Legacy Mapping Error:", error);
    res.status(500).json({ error: "Could not save legacy mapping" });
  }
};

export const deleteMapping = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const { id } = req.params;

  try {
    await prisma.legacyLinkMapping.delete({ where: { mappingId: id } });
    res.status(200).json({ success: true, message: "Mapping deleted" });
  } catch (error) {
    logger.error("Delete Legacy Mapping Error:", error);
    res.status(500).json({ error: "Could not delete legacy mapping" });
  }
};
