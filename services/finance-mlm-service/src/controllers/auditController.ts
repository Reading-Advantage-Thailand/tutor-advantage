import { logger } from "@tutor-advantage/shared-config";
import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import type { Prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { AUDIT_ACTIONS, AUDIT_ENTITY, recordAuditEvent } from "../services/auditService";

/**
 * GET /v1/audit-logs          (paged JSON)
 * GET /v1/audit-logs/export   (CSV, same filters, capped)
 *
 * Query (all optional; documented in finance-mlm.v1.yaml):
 *   page (1..), pageSize (1..100, default 50), order (desc|asc), sort (createdAt)
 *   periodMonth  YYYY-MM   → events whose createdAt falls in that month (Asia/Bangkok).
 *                            Filters by EVENT TIME, so user/fraud/exception events that
 *                            carry no payload.periodMonth are included.
 *   from, to     YYYY-MM-DD (Bangkok calendar days, inclusive)
 *   actionType   one action or a comma list (e.g. "APPROVE,APPROVE_SETTLEMENT")
 *   entityType   e.g. SettlementRun, User, Adjustment
 *   entityId     exact id of the affected record
 *   actor        actor user id (uuid), "SYSTEM", or text matched against actor email/name
 */

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_RE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION_RE = /^[A-Z0-9_]{1,64}$/;
const ENTITY_RE = /^[A-Za-z0-9_]{1,64}$/;
export const AUDIT_EXPORT_MAX_ROWS = 10_000;

export interface AuditLogQuery {
  page: number;
  pageSize: number;
  order: "asc" | "desc";
  createdFrom?: Date;
  createdBefore?: Date;
  actions?: string[];
  entityType?: string;
  entityId?: string;
  actor?: string;
}

type ParseResult = { ok: true; value: AuditLogQuery } | { ok: false; field: string; message: string };

function single(value: unknown): string | undefined {
  if (Array.isArray(value)) return single(value[0]);
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text === "" ? undefined : text;
}

/** Midnight (00:00 Asia/Bangkok) of a calendar day, as a UTC instant. */
export function bangkokDayStart(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day) - BANGKOK_OFFSET_MS);
}

/** [start, end) of a Bangkok calendar month "YYYY-MM". */
export function bangkokMonthRange(periodMonth: string): { start: Date; end: Date } | null {
  const match = MONTH_RE.exec(periodMonth);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  return { start: bangkokDayStart(year, month, 1), end: bangkokDayStart(year, month + 1, 1) };
}

function bangkokDate(value: string): { start: Date; next: Date } | null {
  const match = DATE_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month, day));
  if (check.getUTCMonth() !== month) return null; // 2026-02-31
  return { start: bangkokDayStart(year, month, day), next: bangkokDayStart(year, month, day + 1) };
}

/** Validate + normalise query params (pure; unit-tested). */
export function parseAuditLogQuery(query: Record<string, unknown>, defaults = { pageSize: 50 }): ParseResult {
  const pageRaw = single(query.page);
  const sizeRaw = single(query.pageSize);
  const page = pageRaw === undefined ? 1 : Number(pageRaw);
  const pageSize = sizeRaw === undefined ? defaults.pageSize : Number(sizeRaw);
  if (!Number.isInteger(page) || page < 1 || page > 100_000) {
    return { ok: false, field: "page", message: "page must be an integer ≥ 1" };
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return { ok: false, field: "pageSize", message: "pageSize must be an integer between 1 and 100" };
  }

  const orderRaw = (single(query.order) ?? "desc").toLowerCase();
  if (orderRaw !== "asc" && orderRaw !== "desc") {
    return { ok: false, field: "order", message: "order must be asc or desc" };
  }
  const sort = single(query.sort);
  if (sort !== undefined && sort !== "createdAt") {
    return { ok: false, field: "sort", message: "sort supports createdAt only" };
  }

  let createdFrom: Date | undefined;
  let createdBefore: Date | undefined;
  const narrow = (start: Date, end: Date) => {
    if (!createdFrom || start > createdFrom) createdFrom = start;
    if (!createdBefore || end < createdBefore) createdBefore = end;
  };

  const periodMonth = single(query.periodMonth);
  if (periodMonth !== undefined) {
    const range = bangkokMonthRange(periodMonth);
    if (!range) return { ok: false, field: "periodMonth", message: "periodMonth must be YYYY-MM" };
    narrow(range.start, range.end);
  }

  const fromRaw = single(query.from);
  const toRaw = single(query.to);
  const from = fromRaw === undefined ? null : bangkokDate(fromRaw);
  const to = toRaw === undefined ? null : bangkokDate(toRaw);
  if (fromRaw !== undefined && !from) return { ok: false, field: "from", message: "from must be a valid YYYY-MM-DD date" };
  if (toRaw !== undefined && !to) return { ok: false, field: "to", message: "to must be a valid YYYY-MM-DD date" };
  if (from && to && from.start > to.start) {
    return { ok: false, field: "from", message: "from must be on or before to" };
  }
  if (from || to) {
    narrow(from?.start ?? new Date(0), to?.next ?? new Date(8.64e15));
  }

  const actionRaw = single(query.actionType ?? query.action);
  let actions: string[] | undefined;
  if (actionRaw !== undefined) {
    actions = [...new Set(actionRaw.split(",").map((a) => a.trim()).filter(Boolean))];
    if (actions.length === 0 || actions.length > 30 || !actions.every((a) => ACTION_RE.test(a))) {
      return { ok: false, field: "actionType", message: "actionType must be action names (A-Z, 0-9, _) separated by commas" };
    }
  }

  const entityType = single(query.entityType);
  if (entityType !== undefined && !ENTITY_RE.test(entityType)) {
    return { ok: false, field: "entityType", message: "entityType is invalid" };
  }
  const entityId = single(query.entityId);
  if (entityId !== undefined && entityId.length > 128) {
    return { ok: false, field: "entityId", message: "entityId is too long" };
  }
  const actor = single(query.actor ?? query.actorId);
  if (actor !== undefined && actor.length > 120) {
    return { ok: false, field: "actor", message: "actor is too long" };
  }

  return {
    ok: true,
    value: { page, pageSize, order: orderRaw, createdFrom, createdBefore, actions, entityType, entityId, actor },
  };
}

/** Prisma where for parsed filters. Text actor search resolves to matching user ids. */
export async function buildAuditWhere(q: AuditLogQuery): Promise<Prisma.AuditEventWhereInput> {
  const where: Prisma.AuditEventWhereInput = {};
  if (q.createdFrom || q.createdBefore) {
    where.createdAt = {
      ...(q.createdFrom ? { gte: q.createdFrom } : {}),
      ...(q.createdBefore ? { lt: q.createdBefore } : {}),
    };
  }
  if (q.actions) where.action = q.actions.length === 1 ? q.actions[0] : { in: q.actions };
  if (q.entityType) where.entityType = q.entityType;
  if (q.entityId) where.entityId = q.entityId;
  if (q.actor) {
    if (UUID_RE.test(q.actor) || q.actor.toUpperCase() === "SYSTEM") {
      where.actorId = UUID_RE.test(q.actor) ? q.actor.toLowerCase() : "SYSTEM";
    } else {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: q.actor, mode: "insensitive" } },
            { displayName: { contains: q.actor, mode: "insensitive" } },
          ],
        },
        select: { userId: true },
        take: 100,
      });
      where.actorId = { in: users.map((u) => u.userId) };
    }
  }
  return where;
}

type AuditRow = {
  auditEventId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  payload: unknown;
  createdAt: Date;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pickString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

async function mapRows(rows: AuditRow[]) {
  const actorIds = [...new Set(rows.map((r) => r.actorId))].filter((id) => UUID_RE.test(id));
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { userId: { in: actorIds } },
        select: { userId: true, displayName: true, email: true, role: true },
      })
    : [];
  const actorMap = new Map(actors.map((u) => [u.userId, u]));

  return rows.map((ev) => {
    const payload = asRecord(ev.payload);
    const body = asRecord(payload.body);
    const actor = actorMap.get(ev.actorId);
    const displayName =
      actor?.displayName ??
      actor?.email ??
      (ev.actorId === "SYSTEM" ? "SYSTEM" : UUID_RE.test(ev.actorId) ? `User …${ev.actorId.slice(-4)}` : ev.actorId);
    return {
      auditId: ev.auditEventId,
      actionType: ev.action,
      actorUserId: ev.actorId,
      displayName,
      actorEmail: actor?.email ?? null,
      actorRole: actor?.role ?? null,
      entityType: ev.entityType,
      targetId: ev.entityId,
      periodMonth: pickString(payload, "periodMonth") ?? pickString(body, "periodMonth") ?? "",
      previousStatus: pickString(payload, "previousStatus", "fromStatus", "oldStatus", "previousRole", "fromRole", "oldRole"),
      newStatus: pickString(payload, "newStatus", "toStatus", "status", "newRole", "toRole", "role"),
      reason: pickString(payload, "reason", "note", "comment", "rejectReason") ?? pickString(body, "reason", "note", "comment"),
      createdAt: ev.createdAt instanceof Date ? ev.createdAt.toISOString() : String(ev.createdAt),
      metadata: ev.payload ?? null,
    };
  });
}

function badRequest(req: AuthenticatedRequest, res: Response, field: string, message: string) {
  return res.status(400).json({
    error: { code: "INVALID_AUDIT_QUERY", message, details: { field }, requestId: req.id },
  });
}

export async function getAuditLogs(req: AuthenticatedRequest, res: Response) {
  const parsed = parseAuditLogQuery(req.query as Record<string, unknown>);
  if (!parsed.ok) return badRequest(req, res, parsed.field, parsed.message);
  const q = parsed.value;
  try {
    const where = await buildAuditWhere(q);
    const [total, logs] = await Promise.all([
      prisma.auditEvent.count({ where }),
      prisma.auditEvent.findMany({
        where,
        orderBy: [{ createdAt: q.order }, { auditEventId: q.order }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);

    return res.status(200).json({
      logs: await mapRows(logs as AuditRow[]),
      pagination: {
        total,
        page: q.page,
        pageSize: q.pageSize,
        totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
      },
    });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string };
    logger.error("AuditLogs Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch audit logs",
        requestId: req.id,
      },
    });
  }
}

/** Neutralise spreadsheet formulas and quote a CSV cell. */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function exportAuditLogs(req: AuthenticatedRequest, res: Response) {
  const parsed = parseAuditLogQuery(req.query as Record<string, unknown>);
  if (!parsed.ok) return badRequest(req, res, parsed.field, parsed.message);
  const q = parsed.value;
  try {
    const where = await buildAuditWhere(q);
    const rows = (await prisma.auditEvent.findMany({
      where,
      orderBy: [{ createdAt: q.order }, { auditEventId: q.order }],
      take: AUDIT_EXPORT_MAX_ROWS + 1,
    })) as AuditRow[];
    const truncated = rows.length > AUDIT_EXPORT_MAX_ROWS;
    const mapped = await mapRows(rows.slice(0, AUDIT_EXPORT_MAX_ROWS));

    const header = [
      "created_at",
      "action",
      "entity_type",
      "entity_id",
      "actor_id",
      "actor_name",
      "actor_email",
      "period_month",
      "previous_status",
      "new_status",
      "reason",
      "payload_json",
    ];
    const lines = mapped.map((r) =>
      [
        r.createdAt,
        r.actionType,
        r.entityType,
        r.targetId,
        r.actorUserId,
        r.displayName,
        r.actorEmail,
        r.periodMonth,
        r.previousStatus,
        r.newStatus,
        r.reason,
        r.metadata,
      ]
        .map(csvCell)
        .join(","),
    );
    // BOM so Excel opens Thai text as UTF-8.
    const csv = `﻿${[header.join(","), ...lines].join("\n")}\n`;

    await recordAuditEvent({
      actorId: req.user?.userId,
      action: AUDIT_ACTIONS.AUDIT_EXPORT,
      entityType: AUDIT_ENTITY.AUDIT_LOG,
      entityId: "export",
      payload: {
        rowCount: mapped.length,
        truncated,
        filters: {
          ...req.query,
        },
      },
      requestId: req.id,
    });

    const stamp = new Date(Date.now() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="audit-log-${stamp}.csv"`);
    res.setHeader("X-Export-Row-Count", String(mapped.length));
    res.setHeader("X-Export-Truncated", truncated ? "true" : "false");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(csv);
  } catch (error) {
    logger.error("AuditLogs Export Error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Could not export audit logs", requestId: req.id },
    });
  }
}
