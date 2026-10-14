import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, type Prisma } from "@tutor-advantage/database";
import { ADMIN_TOKEN_COOKIE, devRoutesEnabled, verifyAdminToken } from "@/lib/security";
import { cascadeClosure, databaseNameFromUrl, type FkEdge } from "./guards";

/**
 * Dev-only database inspector + TRUNCATE (local QA resets).
 * Defence in depth on top of the middleware gate (dev routes opt-in + ADMIN):
 *  - re-checks devRoutesEnabled() and the admin session with verifyAdminToken
 *    (signature, iss, aud, role) — never a bare jwtVerify;
 *  - destructive actions require `confirm` === the database name (type-to-confirm);
 *  - refuses when CASCADE would reach a preserved table.
 */

const TARGET_SCHEMAS = ["identity", "learning", "finance_mlm", "public"];
const RESET_SCHEMAS = ["identity", "learning", "finance_mlm"];
const PRESERVED_TABLES = new Set([
  "learning.series",
  "learning.books",
  "learning.articles",
  "public._prisma_migrations",
]);

type DbTable = {
  schemaName: string;
  tableName: string;
  rowCount: number;
  isPreserved: boolean;
};

function qualifiedName(schemaName: string, tableName: string) {
  return `"${schemaName.replaceAll('"', '""')}"."${tableName.replaceAll('"', '""')}"`;
}

function tableKey(schemaName: string, tableName: string) {
  return `${schemaName}.${tableName}`;
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

async function requireDevAdmin() {
  if (!devRoutesEnabled()) return errorResponse(404, "NOT_FOUND", "Not found");
  const session = await verifyAdminToken((await cookies()).get(ADMIN_TOKEN_COOKIE)?.value);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Admin session required");
  if (session.role !== "ADMIN") return errorResponse(403, "FORBIDDEN", "Admin role required");
  return null;
}

async function loadForeignKeyEdges(): Promise<FkEdge[]> {
  return prisma.$queryRaw<FkEdge[]>`
    SELECT
      child_ns.nspname || '.' || child.relname AS "child",
      parent_ns.nspname || '.' || parent.relname AS "parent"
    FROM pg_constraint con
    JOIN pg_class child ON child.oid = con.conrelid
    JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
    JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
    WHERE con.contype = 'f'
  `;
}

async function loadTables(): Promise<DbTable[]> {
  const rows = await prisma.$queryRaw<Array<{ schema_name: string; table_name: string }>>`
    SELECT table_schema AS schema_name, table_name
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
      AND table_schema = ANY(${TARGET_SCHEMAS})
    ORDER BY table_schema, table_name
  `;

  return Promise.all(
    rows.map(async (row) => {
      const countRows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*)::bigint AS count FROM ${qualifiedName(row.schema_name, row.table_name)}`,
      );
      return {
        schemaName: row.schema_name,
        tableName: row.table_name,
        rowCount: Number(countRows[0]?.count ?? 0),
        isPreserved: PRESERVED_TABLES.has(tableKey(row.schema_name, row.table_name)),
      };
    }),
  );
}

export async function GET() {
  const guard = await requireDevAdmin();
  if (guard) return guard;

  const [tables, columns, indexes, constraints, foreignKeys] = await Promise.all([
    loadTables(),
    prisma.$queryRaw`
      SELECT
        table_schema AS "schemaName",
        table_name AS "tableName",
        column_name AS "columnName",
        data_type AS "dataType",
        is_nullable AS "isNullable",
        column_default AS "columnDefault",
        ordinal_position AS "ordinalPosition"
      FROM information_schema.columns
      WHERE table_schema = ANY(${TARGET_SCHEMAS})
      ORDER BY table_schema, table_name, ordinal_position
    `,
    prisma.$queryRaw`
      SELECT
        schemaname AS "schemaName",
        tablename AS "tableName",
        indexname AS "indexName",
        indexdef AS "indexDef"
      FROM pg_indexes
      WHERE schemaname = ANY(${TARGET_SCHEMAS})
      ORDER BY schemaname, tablename, indexname
    `,
    prisma.$queryRaw`
      SELECT
        tc.table_schema AS "schemaName",
        tc.table_name AS "tableName",
        tc.constraint_name AS "constraintName",
        tc.constraint_type AS "constraintType",
        COALESCE(string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position), '') AS "columns"
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_schema = tc.constraint_schema
       AND kcu.constraint_name = tc.constraint_name
       AND kcu.table_schema = tc.table_schema
       AND kcu.table_name = tc.table_name
      WHERE tc.table_schema = ANY(${TARGET_SCHEMAS})
      GROUP BY tc.table_schema, tc.table_name, tc.constraint_name, tc.constraint_type
      ORDER BY tc.table_schema, tc.table_name, tc.constraint_type, tc.constraint_name
    `,
    prisma.$queryRaw`
      SELECT
        tc.table_schema AS "schemaName",
        tc.table_name AS "tableName",
        kcu.column_name AS "columnName",
        ccu.table_schema AS "foreignSchemaName",
        ccu.table_name AS "foreignTableName",
        ccu.column_name AS "foreignColumnName",
        tc.constraint_name AS "constraintName"
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = ANY(${TARGET_SCHEMAS})
      ORDER BY tc.table_schema, tc.table_name, tc.constraint_name
    `,
  ]);

  const databaseUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;

  return NextResponse.json({
    database: databaseUrl
      ? {
          host: databaseUrl.hostname,
          port: databaseUrl.port || "5432",
          name: databaseNameFromUrl(process.env.DATABASE_URL),
        }
      : null,
    preservedTables: Array.from(PRESERVED_TABLES),
    resetSchemas: RESET_SCHEMAS,
    tables,
    columns,
    indexes,
    constraints,
    foreignKeys,
  });
}

export async function POST(request: NextRequest) {
  const guard = await requireDevAdmin();
  if (guard) return guard;

  const body = await request.json().catch(() => ({}));
  const action = body.action;

  // Type-to-confirm: the exact database name, so a stray click/script can't wipe the shared QA DB.
  const databaseName = databaseNameFromUrl(process.env.DATABASE_URL);
  if (!databaseName) {
    return errorResponse(500, "DATABASE_URL_MISSING", "DATABASE_URL is not configured");
  }
  if (typeof body.confirm !== "string" || body.confirm !== databaseName) {
    return errorResponse(400, "CONFIRMATION_MISMATCH", `Type the database name "${databaseName}" to confirm`);
  }

  const allTables = await loadTables();
  let targets: DbTable[] = [];

  if (action === "reset_except_books") {
    targets = allTables.filter(
      (table) =>
        RESET_SCHEMAS.includes(table.schemaName) &&
        !PRESERVED_TABLES.has(tableKey(table.schemaName, table.tableName)),
    );
  } else if (action === "truncate_selected") {
    const requested = Array.isArray(body.tables) ? body.tables : [];
    const requestedSet = new Set(requested);
    targets = allTables.filter((table) =>
      requestedSet.has(tableKey(table.schemaName, table.tableName)),
    );
  } else {
    return errorResponse(400, "UNSUPPORTED_ACTION", "Unsupported database action");
  }

  const invalid = targets.filter((table) =>
    PRESERVED_TABLES.has(tableKey(table.schemaName, table.tableName)),
  );
  if (invalid.length > 0) {
    return errorResponse(
      400,
      "PRESERVED_TABLE",
      `Cannot truncate preserved tables: ${invalid.map((t) => tableKey(t.schemaName, t.tableName)).join(", ")}`,
    );
  }

  if (targets.length === 0) {
    return errorResponse(400, "NO_TABLES", "No tables selected");
  }

  // TRUNCATE … CASCADE also empties every table that references a target. Refuse if that reaches a preserved table.
  const cascaded = cascadeClosure(
    targets.map((table) => tableKey(table.schemaName, table.tableName)),
    await loadForeignKeyEdges(),
  );
  const cascadedPreserved = cascaded.filter((key) => PRESERVED_TABLES.has(key));
  if (cascadedPreserved.length > 0) {
    return errorResponse(
      400,
      "CASCADE_REACHES_PRESERVED",
      `CASCADE would also truncate preserved tables: ${cascadedPreserved.join(", ")}`,
    );
  }

  const beforeCounts = Object.fromEntries(
    targets.map((table) => [tableKey(table.schemaName, table.tableName), table.rowCount]),
  );
  const sql = `TRUNCATE TABLE ${targets
    .map((table) => qualifiedName(table.schemaName, table.tableName))
    .join(", ")} RESTART IDENTITY CASCADE`;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRawUnsafe(sql);
  });

  return NextResponse.json({
    ok: true,
    truncatedTables: targets.map((table) => tableKey(table.schemaName, table.tableName)),
    cascadedTables: cascaded.filter(
      (key) => !targets.some((table) => tableKey(table.schemaName, table.tableName) === key),
    ),
    estimatedRowsRemoved: Object.values(beforeCounts).reduce((sum, count) => sum + count, 0),
    beforeCounts,
  });
}
