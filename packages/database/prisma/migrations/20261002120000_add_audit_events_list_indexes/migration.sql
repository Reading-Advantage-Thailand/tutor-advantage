-- Audit trail (GET /v1/audit-logs, export, admin overview "recent activity"):
-- time-ordered scans and the actionType filter. The (entity_type, entity_id,
-- created_at) index already exists (20260227104401_add_adjustment_status).
-- Names are Prisma's derived names (< 63 chars), so migrate diff reports no drift.

-- CreateIndex
CREATE INDEX "audit_events_created_at_idx" ON "finance_mlm"."audit_events"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_events_action_created_at_idx" ON "finance_mlm"."audit_events"("action", "created_at" DESC);
