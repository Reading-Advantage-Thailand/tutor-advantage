import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose/jwt/verify";
import { prisma } from "@tutor-advantage/database";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "secret-for-dev-only-change-me",
);

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

async function requireDevAdmin() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Database dev tools are disabled in production." },
      { status: 403 },
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid admin session" }, { status: 401 });
  }

  return null;
}

async function loadTables(): Promise<DbTable[]> {
  const rows = await prisma.$queryRaw<Array<{ schema_name: string; table_name: string }>>`
    SELECT table_schema AS schema_name, table_name
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
      AND table_schema = ANY(${TARGET_SCHEMAS})
    ORDER BY table_schema, table_name
  `;

  const tables: DbTable[] = [];
  for (const row of rows) {
    const countRows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count FROM ${qualifiedName(row.schema_name, row.table_name)}`,
    );
    const key = tableKey(row.schema_name, row.table_name);
    tables.push({
      schemaName: row.schema_name,
      tableName: row.table_name,
      rowCount: Number(countRows[0]?.count ?? 0),
      isPreserved: PRESERVED_TABLES.has(key),
    });
  }

  return tables;
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
          name: databaseUrl.pathname.replace(/^\//, ""),
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
    return NextResponse.json({ error: "Unsupported database action" }, { status: 400 });
  }

  const invalid = targets.filter((table) =>
    PRESERVED_TABLES.has(tableKey(table.schemaName, table.tableName)),
  );
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Cannot truncate preserved tables: ${invalid.map((t) => tableKey(t.schemaName, t.tableName)).join(", ")}` },
      { status: 400 },
    );
  }

  if (targets.length === 0) {
    return NextResponse.json({ error: "No tables selected" }, { status: 400 });
  }

  const beforeCounts = Object.fromEntries(
    targets.map((table) => [tableKey(table.schemaName, table.tableName), table.rowCount]),
  );
  const sql = `TRUNCATE TABLE ${targets
    .map((table) => qualifiedName(table.schemaName, table.tableName))
    .join(", ")} RESTART IDENTITY CASCADE`;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(sql);
  });

  return NextResponse.json({
    ok: true,
    truncatedTables: targets.map((table) => tableKey(table.schemaName, table.tableName)),
    estimatedRowsRemoved: Object.values(beforeCounts).reduce((sum, count) => sum + count, 0),
    beforeCounts,
  });
}
