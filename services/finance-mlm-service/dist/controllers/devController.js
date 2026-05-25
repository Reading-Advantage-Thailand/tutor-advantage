"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.devPurge = exports.devSeedAdjustment = exports.devDeleteFraudFlag = exports.devSeedFraudFlag = exports.devRunSettlement = exports.devGetState = exports.devDeleteUser = exports.devUpdateUser = exports.devCreateUser = exports.devListUsers = void 0;
const database_1 = require("@tutor-advantage/database");
const settlementService_1 = require("../services/settlementService");
const ALLOWED_ROLES = ["ADMIN", "TUTOR", "STUDENT", "FINANCE_CHECKER"];
// GET /v1/dev/users
const devListUsers = async (_req, res) => {
    try {
        const users = await database_1.prisma.user.findMany({
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
                    select: { provider: true, providerSubject: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json({ users });
    }
    catch (err) {
        console.error("devListUsers error:", err);
        res.status(500).json({ error: "Could not list users" });
    }
};
exports.devListUsers = devListUsers;
// POST /v1/dev/users
const devCreateUser = async (req, res) => {
    const { role, displayName, email, phoneNumber, isActive, verificationStatus } = req.body;
    if (!role || !ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({ error: `role must be one of: ${ALLOWED_ROLES.join(", ")}` });
    }
    try {
        const user = await database_1.prisma.user.create({
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
    }
    catch (err) {
        if (err?.code === "P2002") {
            return res.status(409).json({ error: "Email already exists" });
        }
        console.error("devCreateUser error:", err);
        res.status(500).json({ error: "Could not create user" });
    }
};
exports.devCreateUser = devCreateUser;
// PATCH /v1/dev/users/:id
const devUpdateUser = async (req, res) => {
    const { id } = req.params;
    const { role, displayName, email, phoneNumber, profilePictureUrl, isActive, verificationStatus, verificationComment, sponsorTutorId, } = req.body;
    if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({ error: `role must be one of: ${ALLOWED_ROLES.join(", ")}` });
    }
    const data = {};
    if (role !== undefined)
        data.role = role;
    if (displayName !== undefined)
        data.displayName = displayName || null;
    if (email !== undefined)
        data.email = email || null;
    if (phoneNumber !== undefined)
        data.phoneNumber = phoneNumber || null;
    if (profilePictureUrl !== undefined)
        data.profilePictureUrl = profilePictureUrl || null;
    if (isActive !== undefined)
        data.isActive = Boolean(isActive);
    if (verificationStatus !== undefined)
        data.verificationStatus = verificationStatus;
    if (verificationComment !== undefined)
        data.verificationComment = verificationComment || null;
    if (sponsorTutorId !== undefined)
        data.sponsorTutorId = sponsorTutorId || null;
    if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
    }
    try {
        const user = await database_1.prisma.user.update({
            where: { userId: id },
            data,
        });
        res.json({ user });
    }
    catch (err) {
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
exports.devUpdateUser = devUpdateUser;
// DELETE /v1/dev/users/:id
const devDeleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        // Hard delete — cascade handled by DB foreign key constraints
        await database_1.prisma.user.delete({ where: { userId: id } });
        res.json({ success: true, message: `User ${id} permanently deleted` });
    }
    catch (err) {
        if (err?.code === "P2025") {
            return res.status(404).json({ error: "User not found" });
        }
        console.error("devDeleteUser error:", err);
        res.status(500).json({ error: "Could not delete user" });
    }
};
exports.devDeleteUser = devDeleteUser;
// ─────────────────────────────────────────────────────────────────────────────
// DEV ACTION ENDPOINTS — trigger real service operations without auth checks
// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/dev/state — snapshot of current system state for the toolbar
const devGetState = async (_req, res) => {
    try {
        const now = new Date();
        const ictOffset = 7 * 60 * 60 * 1000;
        const ict = new Date(now.getTime() + ictOffset);
        const currentMonth = `${ict.getUTCFullYear()}-${String(ict.getUTCMonth() + 1).padStart(2, "0")}`;
        const prevMonth = (() => {
            const d = new Date(Date.UTC(ict.getUTCFullYear(), ict.getUTCMonth(), 1) - 1);
            return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        })();
        const [userCount, tutorCount, latestRun, pendingAdjustments, openFraudFlags,] = await Promise.all([
            database_1.prisma.user.count(),
            database_1.prisma.user.count({ where: { role: "TUTOR" } }),
            database_1.prisma.settlementRun.findFirst({ orderBy: { createdAt: "desc" } }),
            database_1.prisma.adjustment.count({ where: { status: "PENDING" } }),
            database_1.prisma.fraudFlag.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
        ]);
        res.json({
            currentMonth,
            prevMonth,
            userCount,
            tutorCount,
            latestRun: latestRun
                ? { id: latestRun.settlementRunId, period: latestRun.periodMonth, status: latestRun.status }
                : null,
            pendingAdjustments,
            openFraudFlags,
        });
    }
    catch (err) {
        console.error("devGetState error:", err);
        res.status(500).json({ error: "Could not fetch state" });
    }
};
exports.devGetState = devGetState;
// POST /v1/dev/actions/settlement — preview settlement for given or current month
const devRunSettlement = async (req, res) => {
    try {
        const now = new Date();
        const ictOffset = 7 * 60 * 60 * 1000;
        const ict = new Date(now.getTime() + ictOffset);
        const currentMonth = `${ict.getUTCFullYear()}-${String(ict.getUTCMonth() + 1).padStart(2, "0")}`;
        const periodMonth = req.body?.periodMonth || currentMonth;
        if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
            return res.status(400).json({ error: "periodMonth must be YYYY-MM" });
        }
        // Check idempotency
        const existing = await database_1.prisma.settlementRun.findFirst({
            where: { periodMonth },
            orderBy: { createdAt: "desc" },
        });
        if (existing) {
            return res.status(200).json({
                message: `Settlement run for ${periodMonth} already exists — skipped`,
                settlementRunId: existing.settlementRunId,
                periodMonth,
                skipped: true,
            });
        }
        const preview = await settlementService_1.SettlementService.previewSettlement(periodMonth, "DEV_TOOL");
        const lineCount = await database_1.prisma.payoutLine.count({
            where: { settlementRunId: preview.snapshotId },
        });
        res.status(201).json({
            message: `Settlement preview created for ${periodMonth}`,
            settlementRunId: preview.snapshotId,
            periodMonth,
            tutorCount: lineCount,
            skipped: false,
        });
    }
    catch (err) {
        console.error("devRunSettlement error:", err);
        res.status(500).json({ error: err.message || "Could not run settlement" });
    }
};
exports.devRunSettlement = devRunSettlement;
// POST /v1/dev/actions/fraud-flag — create mock fraud flag
const devSeedFraudFlag = async (req, res) => {
    try {
        const { type = "SUSPICIOUS_VOLUME", severity = "HIGH", targetId = "dev-test-target", targetName = "[DEV] Test Target", description = "Automatically created by Dev Toolbar for testing", } = req.body || {};
        const flag = await database_1.prisma.fraudFlag.create({
            data: { type, severity, targetId, targetName, description, status: "OPEN" },
        });
        res.status(201).json({ flag });
    }
    catch (err) {
        console.error("devSeedFraudFlag error:", err);
        res.status(500).json({ error: "Could not create fraud flag" });
    }
};
exports.devSeedFraudFlag = devSeedFraudFlag;
// DELETE /v1/dev/actions/fraud-flag/:id — hard delete a specific fraud flag
const devDeleteFraudFlag = async (req, res) => {
    const { id } = req.params;
    try {
        await database_1.prisma.fraudFlag.delete({ where: { flagId: id } });
        res.json({ success: true });
    }
    catch (err) {
        if (err?.code === "P2025")
            return res.status(404).json({ error: "Flag not found" });
        console.error("devDeleteFraudFlag error:", err);
        res.status(500).json({ error: "Could not delete flag" });
    }
};
exports.devDeleteFraudFlag = devDeleteFraudFlag;
// POST /v1/dev/actions/adjustment — create mock adjustment on latest settlement run
const devSeedAdjustment = async (req, res) => {
    try {
        const { tutorUserId, amountTHB = 100, reason = "[DEV] Test adjustment" } = req.body || {};
        // Find latest settlement run
        const run = await database_1.prisma.settlementRun.findFirst({ orderBy: { createdAt: "desc" } });
        if (!run) {
            return res.status(404).json({ error: "No settlement run found — run settlement first" });
        }
        // Resolve tutorUserId: use provided or pick first TUTOR
        let resolvedTutorId = tutorUserId;
        if (!resolvedTutorId) {
            const tutor = await database_1.prisma.user.findFirst({ where: { role: "TUTOR", isActive: true } });
            if (!tutor)
                return res.status(404).json({ error: "No TUTOR user found — create one first" });
            resolvedTutorId = tutor.userId;
        }
        const amountMinor = BigInt(Math.round(Number(amountTHB) * 100));
        const adjustment = await database_1.prisma.adjustment.create({
            data: {
                settlementRunId: run.settlementRunId,
                tutorUserId: resolvedTutorId,
                amountMinor,
                reason,
                status: "PENDING",
                createdBy: "DEV_TOOL",
            },
        });
        res.status(201).json({
            adjustment: {
                ...adjustment,
                amountMinor: adjustment.amountMinor.toString(),
            },
            settlementRunId: run.settlementRunId,
            periodMonth: run.periodMonth,
        });
    }
    catch (err) {
        console.error("devSeedAdjustment error:", err);
        res.status(500).json({ error: err.message || "Could not create adjustment" });
    }
};
exports.devSeedAdjustment = devSeedAdjustment;
// DELETE /v1/dev/actions/purge — purge all dev-created seeded data
const devPurge = async (req, res) => {
    const { resource } = req.body;
    try {
        const results = {};
        if (!resource || resource === "fraud") {
            const r = await database_1.prisma.fraudFlag.deleteMany({
                where: { targetName: { contains: "[DEV]" } },
            });
            results.fraudFlags = r.count;
        }
        if (!resource || resource === "adjustments") {
            const r = await database_1.prisma.adjustment.deleteMany({ where: { createdBy: "DEV_TOOL" } });
            results.adjustments = r.count;
        }
        if (!resource || resource === "settlements") {
            // Only purge PENDING runs created by DEV_TOOL
            const runs = await database_1.prisma.settlementRun.findMany({
                where: { createdBy: "DEV_TOOL", status: "PENDING" },
                select: { settlementRunId: true },
            });
            if (runs.length) {
                await database_1.prisma.adjustment.deleteMany({
                    where: { settlementRunId: { in: runs.map((r) => r.settlementRunId) } },
                });
                const r = await database_1.prisma.settlementRun.deleteMany({
                    where: { settlementRunId: { in: runs.map((r) => r.settlementRunId) } },
                });
                results.settlementRuns = r.count;
            }
        }
        if (resource === "all-settlements") {
            // Nuclear option — wipe ALL settlement data regardless of status/creator
            const allRuns = await database_1.prisma.settlementRun.findMany({
                select: { settlementRunId: true },
            });
            const ids = allRuns.map((r) => r.settlementRunId);
            if (ids.length) {
                await database_1.prisma.payoutDocument.deleteMany({ where: { payoutLine: { settlementRunId: { in: ids } } } });
                await database_1.prisma.payoutLine.deleteMany({ where: { settlementRunId: { in: ids } } });
                await database_1.prisma.adjustment.deleteMany({ where: { settlementRunId: { in: ids } } });
                const r = await database_1.prisma.settlementRun.deleteMany({
                    where: { settlementRunId: { in: ids } },
                });
                results.settlementRuns = r.count;
            }
        }
        res.json({ success: true, deleted: results });
    }
    catch (err) {
        console.error("devPurge error:", err);
        res.status(500).json({ error: "Could not purge data" });
    }
};
exports.devPurge = devPurge;
