import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");
require("pg").types.setTypeParser(1114, (value) => value);
const { parse: parseConnectionString } = require("pg-connection-string");
const dotenv = require("dotenv");

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(rootDir, ".env");
const schemaPath = path.join(rootDir, "packages", "database", "prisma", "schema.prisma");
const prismaCliPath = require.resolve("prisma");
const coreCloneName = "tutor_advantage_local_clone";
const contentCloneName = "reading_advantage_local_clone";
const coreSchemas = ["identity", "learning", "finance_mlm"];
const contentTables = ["article", "MultipleChoiceQuestion", "ShortAnswerQuestion"];
const batchSize = 500;
const replaceExisting = process.argv.includes("--replace-existing");
const dryRun = process.argv.includes("--dry-run");

const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

function log(message) {
  process.stdout.write(`${message}\n`);
}

function requireLoopbackDatabase(rawUrl, expectedPort, expectedDatabase, label) {
  if (!rawUrl) throw new Error(`${label} is missing from .env`);
  const config = parseConnectionString(rawUrl);
  const host = (config.host || "").toLowerCase().replace(/^\[|\]$/g, "");
  const port = Number(config.port || 5432);
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error(`${label} must connect through a loopback address`);
  }
  if (port !== expectedPort) throw new Error(`${label} must use local port ${expectedPort}`);
  if (config.database !== expectedDatabase) {
    throw new Error(`${label} must target database ${expectedDatabase}`);
  }
  return config;
}

function replaceDatabaseName(rawUrl, databaseName) {
  const url = new URL(rawUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function qualifiedName(schemaName, tableName) {
  return `${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`;
}

function mappedUuid(value, uuidMap) {
  if (typeof value !== "string") return value;
  uuidPattern.lastIndex = 0;
  const result = value.replace(uuidPattern, (sourceUuid) => {
    const key = sourceUuid.toLowerCase();
    if (!uuidMap.has(key)) uuidMap.set(key, randomUUID());
    return uuidMap.get(key);
  });
  uuidPattern.lastIndex = 0;
  return result;
}

function mapJsonUuids(value, uuidMap) {
  if (value instanceof Date) return value;
  if (typeof value === "string") return mappedUuid(value, uuidMap);
  if (Array.isArray(value)) return value.map((item) => mapJsonUuids(item, uuidMap));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, mapJsonUuids(item, uuidMap)]),
    );
  }
  return value;
}

function encodeJsonParameter(value, columnMetadata) {
  if (value === null || value === undefined) return value;
  if (columnMetadata?.udt_name === "json" || columnMetadata?.udt_name === "jsonb" || columnMetadata?.data_type === "json" || columnMetadata?.data_type === "jsonb") {
    return JSON.stringify(value);
  }
  if (columnMetadata?.column_type === "json" || columnMetadata?.column_type === "jsonb") return JSON.stringify(value);
  return value;
}

function localIdentifier(prefix, row, uuidMap) {
  const id = Object.values(row).find((value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
  const mapped = id ? mappedUuid(id, uuidMap) : randomUUID();
  return `${prefix}-${mapped}`;
}

function ageBandDate(value, role) {
  if (!value) return value;
  const birthDate = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  const year = role === "STUDENT" ? (age < 13 ? 2016 : age < 18 ? 2010 : 1990) : 1990;
  return `${year}-01-01`;
}

function safeUserLabel(role, index) {
  const normalized = String(role || "USER").toUpperCase();
  const type = normalized === "STUDENT" ? "Student" : normalized === "TUTOR" ? "Tutor" : normalized === "ADMIN" ? "Admin" : "User";
  return `Local ${type} ${String(index).padStart(3, "0")}`;
}

function sanitizeCoreValue({ schemaName, tableName, columnName, value, row, context }) {
  if (value === null || value === undefined) return value;
  const table = `${schemaName}.${tableName}`;
  const column = columnName.toLowerCase();
  const { uuidMap, userIndex, userLabels, ownerIds, ownerEmail } = context;
  const sourceUserId = row.user_id || row.student_user_id || row.tutor_user_id || row.created_by_user_id;
  const localLabel = sourceUserId ? userLabels.get(String(sourceUserId).toLowerCase()) : null;

  if (table === "identity.users") {
    const userId = String(row.user_id).toLowerCase();
    switch (column) {
      case "display_name": return userLabels.get(userId) || safeUserLabel(row.role, userIndex.get(userId) || 999);
      case "email": return ownerIds.has(userId) ? ownerEmail : `local-${mappedUuid(String(row.user_id), uuidMap)}@example.test`;
      case "phone_number":
      case "profile_picture_url":
      case "id_card_image_url":
      case "bank_book_image_url":
      case "verification_comment": return null;
      case "date_of_birth": return ageBandDate(value, row.role);
      case "settings": return {};
    }
  }

  if (table === "identity.oauth_identities" && column === "provider_subject") {
    const localSubject = context.localProviderSubjects.get(String(row.provider).toLowerCase());
    return ownerIds.has(String(row.user_id).toLowerCase()) ? (localSubject || value) : `local-${randomUUID()}`;
  }
  if (table === "identity.guardian_consents" && column === "guardian_name") {
    return `Local Guardian ${mappedUuid(String(row.consent_id), uuidMap).slice(0, 8)}`;
  }

  if (table === "learning.classes") {
    if (column === "title") return `Local Test Class ${mappedUuid(String(row.class_id), uuidMap).slice(0, 8)}`;
    if (column === "schedule_description") return "Local sample schedule";
    if (column === "schedule_data" || column === "meeting_url") return null;
  }
  if (table === "learning.messages") {
    if (column === "content") return "Local test message";
    if (column === "attachments") return null;
  }
  if (table === "learning.assessment_attempts") {
    if (column === "answers" || column === "draft_answers") return null;
    if (column === "teacher_comment") return "Local test teacher comment";
  }
  if (table === "learning.session_answers") {
    if (column === "question_text") return "Local sample question";
    if (column === "answer_text") return "Local sample answer";
    if (column === "correct_answer") return "Local sample correct answer";
    if (column === "ai_feedback") return "Local sample feedback";
  }
  if (table === "learning.tutor_reviews" && column === "comment") return "Local sample review";
  if (table === "learning.class_transfer_requests" && column === "reason") return "Local sample transfer reason";
  if (table === "learning.enrollments" && column === "referral_token") return localIdentifier("LOCAL-REF", row, uuidMap);
  if (table === "learning.referrals") {
    if (column === "token") return localIdentifier("LOCAL-REF", row, uuidMap);
    if (column === "campaign_label") return "Local test campaign";
  }
  if (table === "learning.teaching_hour_coupons") {
    if (column === "code") return localIdentifier("LOCAL-COUPON", row, uuidMap);
    if (column === "note") return "Local test coupon";
  }
  if (table === "learning.legacy_link_mappings") {
    const id = mappedUuid(String(row.mapping_id), uuidMap);
    if (column === "source_url") return `https://local.invalid/legacy/${id}`;
    if (column === "target_path") return `/local/legacy/${id}`;
  }
  if (table === "learning.unresolved_legacy_links" && column === "url") {
    return `https://local.invalid/unresolved/${randomUUID()}`;
  }

  if (table === "finance_mlm.payment_intents") {
    if (column === "idempotency_key") return localIdentifier("LOCAL-PAY", row, uuidMap);
    if (column === "provider_ref") return null;
  }
  if (table === "finance_mlm.payment_events") {
    if (column === "provider_event_id") return localIdentifier("LOCAL-EVENT", row, uuidMap);
    if (column === "raw_payload") return { localCopy: true };
  }
  if (table === "finance_mlm.payment_receipts" && column === "receipt_number") {
    return localIdentifier("LOCAL-RECEIPT", row, uuidMap);
  }
  if (table === "finance_mlm.payout_documents") {
    if (column === "document_number") return localIdentifier("LOCAL-DOC", row, uuidMap);
    if (column === "provider_transfer_id") return null;
    if (column === "transfer_failure_message") return value ? "Local test transfer message" : null;
  }
  if (table === "finance_mlm.payout_lines" && column === "recipient_snapshot") {
    return localLabel || "Local Tutor";
  }
  if (table === "finance_mlm.adjustments" && column === "reason") return "Local test adjustment";
  if (table === "finance_mlm.audit_events" && column === "payload") return { localCopy: true };
  if (table === "finance_mlm.settlement_runs" && column === "preview_payload") return { localCopy: true };
  if (table === "finance_mlm.exceptions") {
    if (column === "student_name") return "Local Student";
    if (column === "error_detail") return value ? "Local test error detail" : null;
  }
  if (table === "finance_mlm.fraud_flags") {
    if (column === "target_name") return "Local test target";
    if (column === "description") return value ? "Local test fraud description" : null;
  }

  if (["created_by", "approved_by", "actor_id"].includes(column)) {
    const remapped = mappedUuid(String(value), uuidMap);
    return remapped === String(value) ? "local-system" : remapped;
  }
  if (["entity_id", "target_id"].includes(column)) {
    const remapped = mappedUuid(String(value), uuidMap);
    return remapped === String(value) ? "local-target" : remapped;
  }

  if (column === "payment_transaction_id") return value ? localIdentifier("LOCAL-TX", row, uuidMap) : null;
  if (typeof value === "string") return mappedUuid(value, uuidMap);
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) return mapJsonUuids(value, uuidMap);
  return value;
}

async function createLocalDatabase(baseLocalUrl, databaseName) {
  const maintenanceUrl = replaceDatabaseName(baseLocalUrl, "postgres");
  const config = parseConnectionString(maintenanceUrl);
  const pool = new Pool({ ...config, max: 1, connectionTimeoutMillis: 8000 });
  try {
    const role = await pool.query("SELECT current_user AS role_name, rolsuper FROM pg_roles WHERE rolname = current_user");
    if (!role.rows[0]?.rolsuper) throw new Error("Local PostgreSQL account must be a superuser to create an isolated clone");
    const found = await pool.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
    if (found.rowCount) {
      if (!replaceExisting) throw new Error(`Local database ${databaseName} already exists; use --replace-existing to refresh it`);
      await pool.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [databaseName]);
      await pool.query(`DROP DATABASE ${quoteIdentifier(databaseName)}`);
    }
    await pool.query(`CREATE DATABASE ${quoteIdentifier(databaseName)} OWNER ${quoteIdentifier(role.rows[0].role_name)}`);
  } finally {
    await pool.end();
  }
}

function runMigrations(databaseUrl) {
  log("Applying the repository migrations to the new local database...");
  const result = spawnSync(
    process.execPath,
    [prismaCliPath, "migrate", "deploy", "--schema", schemaPath],
    {
      cwd: rootDir,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.status !== 0) {
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`Prisma migrations failed with exit code ${result.status ?? "unknown"}`);
  }
}

async function loadCoreMetadata(client) {
  const tables = await client.query(
    `SELECT table_schema, table_name
     FROM information_schema.tables
     WHERE table_type = 'BASE TABLE' AND table_schema = ANY($1::text[])
     ORDER BY table_schema, table_name`,
    [coreSchemas],
  );
  const columns = await client.query(
    `SELECT table_schema, table_name, column_name, data_type, udt_name, ordinal_position
     FROM information_schema.columns
     WHERE table_schema = ANY($1::text[])
     ORDER BY table_schema, table_name, ordinal_position`,
    [coreSchemas],
  );
  const keys = await client.query(
    `SELECT tc.table_schema, tc.table_name, kcu.column_name, kcu.ordinal_position
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
      AND tc.table_name = kcu.table_name
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = ANY($1::text[])
     ORDER BY tc.table_schema, tc.table_name, tc.constraint_name, kcu.ordinal_position`,
    [coreSchemas],
  );
  const dependencies = await client.query(
    `SELECT DISTINCT
       tc.table_schema AS child_schema, tc.table_name AS child_table,
       ccu.table_schema AS parent_schema, ccu.table_name AS parent_table
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
      AND tc.table_name = kcu.table_name
     JOIN information_schema.constraint_column_usage ccu
       ON tc.constraint_schema = ccu.constraint_schema
      AND tc.constraint_name = ccu.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = ANY($1::text[])
       AND ccu.table_schema = ANY($1::text[])`,
    [coreSchemas],
  );
  return { tables: tables.rows, columns: columns.rows, foreignKeyColumns: keys.rows, dependencies: dependencies.rows };
}

function compareCoreSchema(source, target) {
  const targetTables = new Set(target.tables.map((row) => `${row.table_schema}.${row.table_name}`));
  const sourceColumns = new Map(source.columns.map((row) => [
    `${row.table_schema}.${row.table_name}.${row.column_name}`,
    `${row.data_type}/${row.udt_name}`,
  ]));
  const targetColumns = new Map(target.columns.map((row) => [
    `${row.table_schema}.${row.table_name}.${row.column_name}`,
    `${row.data_type}/${row.udt_name}`,
  ]));
  const missingTables = source.tables
    .map((row) => `${row.table_schema}.${row.table_name}`)
    .filter((name) => !targetTables.has(name));
  const differences = [...sourceColumns.entries()]
    .filter(([key, type]) => targetColumns.get(key) !== type)
    .map(([key]) => key);
  if (missingTables.length || differences.length) {
    throw new Error("Production and local core schema differ; update local migrations before cloning");
  }
}

function orderTablesByDependencies(tables, dependencies) {
  const names = new Set(tables.map((row) => `${row.table_schema}.${row.table_name}`));
  const requiredParents = new Map([...names].map((name) => [name, new Set()]));
  for (const edge of dependencies) {
    const child = `${edge.child_schema}.${edge.child_table}`;
    const parent = `${edge.parent_schema}.${edge.parent_table}`;
    if (child !== parent && names.has(child) && names.has(parent)) requiredParents.get(child).add(parent);
  }
  const remaining = new Set(names);
  const ordered = [];
  while (remaining.size) {
    const ready = [...remaining].filter((name) => [...requiredParents.get(name)].every((parent) => !remaining.has(parent)));
    if (!ready.length) throw new Error("Core database contains a cyclic foreign-key dependency");
    ready.sort();
    for (const name of ready) {
      ordered.push(name);
      remaining.delete(name);
    }
  }
  return ordered;
}

async function validateEmptyTargets(coreClient, contentClient) {
  const coreTables = await coreClient.query(
    `SELECT table_schema, table_name
     FROM information_schema.tables
     WHERE table_type = 'BASE TABLE' AND table_schema = ANY($1::text[])
     ORDER BY table_schema, table_name`,
    [coreSchemas],
  );
  for (const table of coreTables.rows) {
    const count = await coreClient.query(`SELECT COUNT(*)::bigint AS count FROM ${qualifiedName(table.table_schema, table.table_name)}`);
    if (BigInt(count.rows[0].count) !== 0n) throw new Error("New local core clone database is not empty");
  }
  for (const table of contentTables) {
    const exists = await contentClient.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) AS present",
      [table],
    );
    if (exists.rows[0].present) throw new Error("New local content clone database is not empty");
  }
}

async function loadUserContext(sourceClient, ownerEmail, uuidMap) {
  const result = await sourceClient.query(
    "SELECT user_id::text, role, email FROM identity.users ORDER BY user_id",
  );
  const userIndex = new Map();
  const userLabels = new Map();
  const ownerIds = new Set();
  result.rows.forEach((row, index) => {
    const id = row.user_id.toLowerCase();
    userIndex.set(id, index + 1);
    userLabels.set(id, safeUserLabel(row.role, index + 1));
    mappedUuid(id, uuidMap);
    if (ownerEmail && String(row.email || "").toLowerCase() === ownerEmail) ownerIds.add(id);
  });
  if (ownerEmail && ownerIds.size === 0) {
    throw new Error("LOCAL_TEST_ACCOUNT_EMAIL is not present in the Production user table");
  }
  return { userIndex, userLabels, ownerIds, ownerEmail };
}

async function loadLocalAuthSubjects(localBaseUrl, ownerEmail) {
  const subjects = new Map();
  if (!ownerEmail) return subjects;
  const pool = new Pool({ ...parseConnectionString(localBaseUrl), max: 1, connectionTimeoutMillis: 8000 });
  try {
    const result = await pool.query(
      `SELECT oi.provider, oi.provider_subject
       FROM identity.oauth_identities oi
       JOIN identity.users u ON u.user_id = oi.user_id
       WHERE lower(u.email) = $1`,
      [ownerEmail],
    );
    for (const row of result.rows) subjects.set(String(row.provider).toLowerCase(), row.provider_subject);
  } finally {
    await pool.end();
  }
  return subjects;
}

async function copyCoreDatabase(sourceClient, targetClient, sourceMetadata, targetMetadata, ownerEmail, localProviderSubjects) {
  compareCoreSchema(sourceMetadata, targetMetadata);
  const uuidMap = new Map();
  const userContext = await loadUserContext(sourceClient, ownerEmail, uuidMap);
  const context = { uuidMap, localProviderSubjects, ...userContext };
  const orderedTables = orderTablesByDependencies(sourceMetadata.tables, sourceMetadata.dependencies);
  const sourceColumnsByTable = new Map();
  const sourceColumnTypesByTable = new Map();
  for (const column of sourceMetadata.columns) {
    const key = `${column.table_schema}.${column.table_name}`;
    if (!sourceColumnsByTable.has(key)) sourceColumnsByTable.set(key, []);
    sourceColumnsByTable.get(key).push(column.column_name);
    if (!sourceColumnTypesByTable.has(key)) sourceColumnTypesByTable.set(key, new Map());
    sourceColumnTypesByTable.get(key).set(column.column_name, column);
  }

  await targetClient.query("BEGIN");
  try {
    for (const key of orderedTables) {
      const [schemaName, tableName] = key.split(".");
      const columns = sourceColumnsByTable.get(key);
      const columnTypes = sourceColumnTypesByTable.get(key);
      const rows = await sourceClient.query(`SELECT * FROM ${qualifiedName(schemaName, tableName)}`);
      const chunkSize = Math.max(1, Math.min(batchSize, Math.floor(60000 / columns.length)));
      for (let start = 0; start < rows.rows.length; start += chunkSize) {
        const chunk = rows.rows.slice(start, start + chunkSize);
        const values = [];
        const tuples = chunk.map((row) => {
          const placeholders = columns.map((columnName) => {
            const value = sanitizeCoreValue({ schemaName, tableName, columnName, value: row[columnName], row, context });
            values.push(encodeJsonParameter(value, columnTypes.get(columnName)));
            return `$${values.length}`;
          });
          return `(${placeholders.join(", ")})`;
        });
        const columnList = columns.map(quoteIdentifier).join(", ");
        await targetClient.query("SAVEPOINT clone_batch");
        try {
          await targetClient.query(
            `INSERT INTO ${qualifiedName(schemaName, tableName)} (${columnList}) VALUES ${tuples.join(", ")}`,
            values,
          );
          await targetClient.query("RELEASE SAVEPOINT clone_batch");
        } catch (error) {
          await targetClient.query("ROLLBACK TO SAVEPOINT clone_batch");
          await targetClient.query("RELEASE SAVEPOINT clone_batch");
          for (let rowIndex = 0; rowIndex < chunk.length; rowIndex += 1) {
            const row = chunk[rowIndex];
            const rowValues = columns.map((columnName) => encodeJsonParameter(
              sanitizeCoreValue({ schemaName, tableName, columnName, value: row[columnName], row, context }),
              columnTypes.get(columnName),
            ));
            const rowPlaceholders = rowValues.map((_, index) => `$${index + 1}`).join(", ");
            await targetClient.query("SAVEPOINT clone_row");
            try {
              await targetClient.query(
                `INSERT INTO ${qualifiedName(schemaName, tableName)} (${columnList}) VALUES (${rowPlaceholders})`,
                rowValues,
              );
              await targetClient.query("RELEASE SAVEPOINT clone_row");
            } catch (rowError) {
              await targetClient.query("ROLLBACK TO SAVEPOINT clone_row");
              await targetClient.query("RELEASE SAVEPOINT clone_row");
              const safeError = new Error(`Failed importing ${key}, batch ${start + 1}-${start + chunk.length}, row ${start + rowIndex + 1}`);
              safeError.code = rowError.code || error.code;
              safeError.safeSummary = true;
              throw safeError;
            }
          }
          log(`  ${key}: used row-wise fallback for one batch`);
        }
      }
      log(`  copied ${key}: ${rows.rowCount} rows (sanitized)`);
    }
    await targetClient.query("COMMIT");
  } catch (error) {
    await targetClient.query("ROLLBACK");
    throw error;
  }
}

async function createContentTables(sourceClient, targetClient) {
  const allowedTypePattern = /^(?:text|text\[\]|integer|double precision|jsonb|boolean|timestamp(?:\([0-6]\))? without time zone)$/;
  const columnTypesByTable = new Map();
  for (const tableName of contentTables) {
    const columns = await sourceClient.query(
      `SELECT a.attname AS column_name,
              pg_catalog.format_type(a.atttypid, a.atttypmod) AS column_type,
              a.attnotnull AS not_null
       FROM pg_catalog.pg_attribute a
       JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = $1
         AND a.attnum > 0 AND NOT a.attisdropped
       ORDER BY a.attnum`,
      [tableName],
    );
    if (!columns.rowCount) throw new Error(`Production content table ${tableName} is missing`);
    const hasId = columns.rows.some((column) => column.column_name === "id");
    if (!hasId) throw new Error(`Production content table ${tableName} has no id column`);
    const unexpectedType = columns.rows.find((column) => !allowedTypePattern.test(column.column_type));
    if (unexpectedType) throw new Error(`Unsupported content type in ${tableName}.${unexpectedType.column_name}`);
    const definitions = columns.rows.map((column) =>
      `${quoteIdentifier(column.column_name)} ${column.column_type}${column.not_null ? " NOT NULL" : ""}`,
    );
    definitions.push(`PRIMARY KEY (${quoteIdentifier("id")})`);
    await targetClient.query(`CREATE TABLE ${qualifiedName("public", tableName)} (${definitions.join(", ")})`);
    columnTypesByTable.set(tableName, new Map(columns.rows.map((column) => [column.column_name, { column_type: column.column_type }])));
  }
  return columnTypesByTable;
}

async function copyContentTable(sourceClient, targetClient, tableName, columnTypes) {
  let lastId = null;
  let copied = 0;
  const qname = qualifiedName("public", tableName);
  while (true) {
    const result = lastId === null
      ? await sourceClient.query(`SELECT * FROM ${qname} ORDER BY ${quoteIdentifier("id")} LIMIT $1`, [batchSize])
      : await sourceClient.query(`SELECT * FROM ${qname} WHERE ${quoteIdentifier("id")} > $1 ORDER BY ${quoteIdentifier("id")} LIMIT $2`, [lastId, batchSize]);
    if (!result.rowCount) break;
    const columns = Object.keys(result.rows[0]);
    const values = [];
    const tuples = result.rows.map((row) => {
      if (tableName === "article" && row.author_id) row.author_id = null;
      const placeholders = columns.map((columnName) => {
        values.push(encodeJsonParameter(row[columnName], columnTypes.get(columnName)));
        return `$${values.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    const columnList = columns.map(quoteIdentifier).join(", ");
    await targetClient.query("SAVEPOINT content_batch");
    try {
      await targetClient.query(
        `INSERT INTO ${qname} (${columnList}) VALUES ${tuples.join(", ")}`,
        values,
      );
      await targetClient.query("RELEASE SAVEPOINT content_batch");
    } catch (error) {
      await targetClient.query("ROLLBACK TO SAVEPOINT content_batch");
      await targetClient.query("RELEASE SAVEPOINT content_batch");
      for (let rowIndex = 0; rowIndex < result.rows.length; rowIndex += 1) {
        const row = result.rows[rowIndex];
        if (tableName === "article" && row.author_id) row.author_id = null;
        const rowValues = columns.map((columnName) => encodeJsonParameter(row[columnName], columnTypes.get(columnName)));
        const rowPlaceholders = rowValues.map((_, index) => `$${index + 1}`).join(", ");
        await targetClient.query("SAVEPOINT content_row");
        try {
          await targetClient.query(`INSERT INTO ${qname} (${columnList}) VALUES (${rowPlaceholders})`, rowValues);
          await targetClient.query("RELEASE SAVEPOINT content_row");
        } catch (rowError) {
          await targetClient.query("ROLLBACK TO SAVEPOINT content_row");
          await targetClient.query("RELEASE SAVEPOINT content_row");
          const safeError = new Error(`Failed importing Reading Advantage ${tableName}, batch ${copied + 1}-${copied + result.rowCount}, row ${copied + rowIndex + 1}`);
          safeError.code = rowError.code || error.code;
          safeError.safeSummary = true;
          throw safeError;
        }
      }
      log(`  ${tableName}: used row-wise fallback for one content batch`);
    }
    copied += result.rowCount;
    lastId = result.rows[result.rows.length - 1].id;
    if (copied % 5000 === 0) log(`    ${tableName}: ${copied} rows copied`);
  }
  log(`  copied public content ${tableName}: ${copied} rows`);
}

async function copyReadingContent(sourceClient, targetClient) {
  const columnTypesByTable = await createContentTables(sourceClient, targetClient);
  await targetClient.query("BEGIN");
  try {
    for (const tableName of contentTables) await copyContentTable(sourceClient, targetClient, tableName, columnTypesByTable.get(tableName));
    await targetClient.query(`CREATE INDEX ON ${qualifiedName("public", "MultipleChoiceQuestion")} (${quoteIdentifier("article_id")})`);
    await targetClient.query(`CREATE INDEX ON ${qualifiedName("public", "ShortAnswerQuestion")} (${quoteIdentifier("article_id")})`);
    await targetClient.query("ANALYZE");
    await targetClient.query("COMMIT");
  } catch (error) {
    await targetClient.query("ROLLBACK");
    throw error;
  }
}

async function verifyCoreIntegrity(client, ownerEmail) {
  const checks = [
    ["identity.users.email", "SELECT COUNT(*)::int AS count FROM identity.users WHERE email IS NOT NULL AND email !~* '^[^@]+@example\\.test$' AND lower(email) <> lower($1)", "LOCAL_TEST_ACCOUNT_EMAIL"],
    ["identity.users.sensitive_fields", "SELECT COUNT(*)::int AS count FROM identity.users WHERE phone_number IS NOT NULL OR profile_picture_url IS NOT NULL OR id_card_image_url IS NOT NULL OR bank_book_image_url IS NOT NULL OR verification_comment IS NOT NULL", null],
    ["learning.messages.content", "SELECT COUNT(*)::int AS count FROM learning.messages WHERE content <> 'Local test message' OR attachments IS NOT NULL", null],
    ["learning.session_answers.free_text", "SELECT COUNT(*)::int AS count FROM learning.session_answers WHERE (question_text IS NOT NULL AND question_text <> 'Local sample question') OR (answer_text IS NOT NULL AND answer_text <> 'Local sample answer') OR (correct_answer IS NOT NULL AND correct_answer <> 'Local sample correct answer') OR (ai_feedback IS NOT NULL AND ai_feedback <> 'Local sample feedback')", null],
    ["learning.classes.private_fields", "SELECT COUNT(*)::int AS count FROM learning.classes WHERE meeting_url IS NOT NULL OR schedule_data IS NOT NULL", null],
    ["finance_mlm.payment_events.raw_payload", "SELECT COUNT(*)::int AS count FROM finance_mlm.payment_events WHERE raw_payload <> '{\"localCopy\": true}'::jsonb", null],
  ];
  for (const [label, sql, param] of checks) {
    const result = param
      ? await client.query(sql, [ownerEmail || ""])
      : await client.query(sql);
    if (Number(result.rows[0].count) !== 0) throw new Error(`Sanitization check failed: ${label}`);
  }
}

async function verifyRowCounts(sourceClient, targetClient, sourceTables, sourceReadingClient, targetReadingClient) {
  for (const table of sourceTables) {
    const sourceCount = await sourceClient.query(`SELECT COUNT(*)::bigint AS count FROM ${qualifiedName(table.table_schema, table.table_name)}`);
    const targetCount = await targetClient.query(`SELECT COUNT(*)::bigint AS count FROM ${qualifiedName(table.table_schema, table.table_name)}`);
    if (sourceCount.rows[0].count !== targetCount.rows[0].count) {
      throw new Error(`Row-count verification failed for ${table.table_schema}.${table.table_name}`);
    }
  }
  for (const tableName of contentTables) {
    const sourceCount = await sourceReadingClient.query(`SELECT COUNT(*)::bigint AS count FROM ${qualifiedName("public", tableName)}`);
    const targetCount = await targetReadingClient.query(`SELECT COUNT(*)::bigint AS count FROM ${qualifiedName("public", tableName)}`);
    if (sourceCount.rows[0].count !== targetCount.rows[0].count) {
      throw new Error(`Row-count verification failed for content table ${tableName}`);
    }
  }
}

async function updateRuntimeUrls(coreUrl, contentUrl, ownerEmail) {
  let text = await readFile(envPath, "utf8");
  const lines = text.split(/\r?\n/);
  const indicesFor = (key) => lines.flatMap((line, index) => new RegExp(`^\\s*${key}\\s*=`).test(line) ? [index] : []);
  let coreIndices = indicesFor("DATABASE_URL");
  let productionCoreIndices = indicesFor("PRODUCTION_DATABASE_URL");
  if (productionCoreIndices.length === 0 && coreIndices.length === 2) {
    const sourceLine = lines[coreIndices[0]];
    lines[coreIndices[0]] = sourceLine.replace(/^\s*DATABASE_URL(?=\s*=)/, "PRODUCTION_DATABASE_URL");
    coreIndices = indicesFor("DATABASE_URL");
    productionCoreIndices = indicesFor("PRODUCTION_DATABASE_URL");
  }
  if (coreIndices.length !== 1 || productionCoreIndices.length !== 1) {
    throw new Error(".env must have one local DATABASE_URL and one PRODUCTION_DATABASE_URL before switching");
  }
  const coreLine = lines[coreIndices[0]];
  lines[coreIndices[0]] = `${coreLine.slice(0, coreLine.indexOf("=") + 1)}${coreUrl}`;

  let contentIndices = indicesFor("DATABASE_URL_READING_ADVANTAGE");
  let productionContentIndices = indicesFor("PRODUCTION_DATABASE_URL_READING_ADVANTAGE");
  if (productionContentIndices.length === 0 && contentIndices.length === 1) {
    const sourceLine = lines[contentIndices[0]];
    lines[contentIndices[0]] = sourceLine.replace(/^\s*DATABASE_URL_READING_ADVANTAGE(?=\s*=)/, "PRODUCTION_DATABASE_URL_READING_ADVANTAGE");
    contentIndices = indicesFor("DATABASE_URL_READING_ADVANTAGE");
    productionContentIndices = indicesFor("PRODUCTION_DATABASE_URL_READING_ADVANTAGE");
  }
  if (contentIndices.length > 1 || productionContentIndices.length !== 1) {
    throw new Error(".env must have one local and one Production Reading Advantage URL before switching");
  }
  if (contentIndices.length === 1) {
    const contentLine = lines[contentIndices[0]];
    lines[contentIndices[0]] = `${contentLine.slice(0, contentLine.indexOf("=") + 1)}${contentUrl}`;
  } else {
    lines.push(`DATABASE_URL_READING_ADVANTAGE=${contentUrl}`);
  }
  const ownerIndices = indicesFor("LOCAL_TEST_ACCOUNT_EMAIL");
  if (ownerEmail && ownerIndices.length === 0) lines.push(`LOCAL_TEST_ACCOUNT_EMAIL=${ownerEmail}`);
  else if (ownerEmail && ownerIndices.length === 1) lines[ownerIndices[0]] = `LOCAL_TEST_ACCOUNT_EMAIL=${ownerEmail}`;
  else if (ownerIndices.length > 1) throw new Error(".env contains duplicate LOCAL_TEST_ACCOUNT_EMAIL settings");
  for (let index = 0; index < lines.length; index += 1) {
    if (/Local manual-test database override/i.test(lines[index])) lines[index] = "# Local runtime database for app services.";
  }
  text = lines.join("\n");
  await writeFile(envPath, text, "utf8");
}

async function main() {
  const envText = await readFile(envPath, "utf8");
  const parsedEnv = dotenv.parse(envText);
  const runtimeDbLines = envText.split(/\r?\n/).filter((line) => /^\s*DATABASE_URL\s*=/.test(line));
  const firstRuntimeDbUrl = runtimeDbLines[0]?.slice(runtimeDbLines[0].indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
  const sourceCoreUrl = process.env.PRODUCTION_DATABASE_URL || parsedEnv.PRODUCTION_DATABASE_URL || (runtimeDbLines.length === 2 ? firstRuntimeDbUrl : undefined);
  const sourceReadingUrl = process.env.PRODUCTION_DATABASE_URL_READING_ADVANTAGE || parsedEnv.PRODUCTION_DATABASE_URL_READING_ADVANTAGE || parsedEnv.DATABASE_URL_READING_ADVANTAGE;
  const localBaseUrl = process.env.DATABASE_URL || parsedEnv.DATABASE_URL;
  const ownerEmail = String(process.env.LOCAL_TEST_ACCOUNT_EMAIL || parsedEnv.LOCAL_TEST_ACCOUNT_EMAIL || "").trim().toLowerCase();

  requireLoopbackDatabase(sourceCoreUrl, 5432, "tutor_advantage", "PRODUCTION_DATABASE_URL");
  requireLoopbackDatabase(sourceReadingUrl, 5432, "reading_advantage", "PRODUCTION_DATABASE_URL_READING_ADVANTAGE");
  requireLoopbackDatabase(localBaseUrl, 5433, parseConnectionString(localBaseUrl).database, "DATABASE_URL");

  const coreTargetUrl = replaceDatabaseName(localBaseUrl, coreCloneName);
  const contentTargetUrl = replaceDatabaseName(localBaseUrl, contentCloneName);
  const sourceCorePool = new Pool({ ...parseConnectionString(sourceCoreUrl), max: 1, connectionTimeoutMillis: 8000 });
  const sourceReadingPool = new Pool({ ...parseConnectionString(sourceReadingUrl), max: 1, connectionTimeoutMillis: 8000 });
  let sourceCoreClient;
  let sourceReadingClient;
  let localCoreClient;
  let localContentClient;
  let localCorePool;
  let localContentPool;
  let coreCreated = false;
  let contentCreated = false;

  try {
    const localProviderSubjects = await loadLocalAuthSubjects(localBaseUrl, ownerEmail);
    const sourceCoreMeta = await sourceCorePool.query("SELECT current_database() AS database_name");
    const sourceReadingMeta = await sourceReadingPool.query("SELECT current_database() AS database_name");
    if (sourceCoreMeta.rows[0].database_name !== "tutor_advantage" || sourceReadingMeta.rows[0].database_name !== "reading_advantage") {
      throw new Error("Production connection did not resolve to the expected databases");
    }

    if (dryRun) {
      sourceCoreClient = await sourceCorePool.connect();
      sourceReadingClient = await sourceReadingPool.connect();
      await sourceCoreClient.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await sourceReadingClient.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await sourceCoreClient.query("SELECT 1 FROM identity.users LIMIT 0");
      await sourceReadingClient.query("SELECT 1 FROM public.article LIMIT 0");
      await sourceReadingClient.query(`SELECT 1 FROM ${qualifiedName("public", "MultipleChoiceQuestion")} LIMIT 0`);
      await sourceReadingClient.query(`SELECT 1 FROM ${qualifiedName("public", "ShortAnswerQuestion")} LIMIT 0`);
      const localAdminPool = new Pool({ ...parseConnectionString(replaceDatabaseName(localBaseUrl, "postgres")), max: 1 });
      try {
        const localRole = await localAdminPool.query("SELECT rolsuper FROM pg_roles WHERE rolname = current_user");
        if (!localRole.rows[0]?.rolsuper) throw new Error("Local PostgreSQL account must be a superuser to create an isolated clone");
      } finally {
        await localAdminPool.end();
      }
      if (ownerEmail) {
        const owner = await sourceCoreClient.query("SELECT 1 FROM identity.users WHERE lower(email) = $1 LIMIT 1", [ownerEmail]);
        if (!owner.rowCount) throw new Error("LOCAL_TEST_ACCOUNT_EMAIL is not present in the Production user table");
      }
      await sourceCoreClient.query("ROLLBACK");
      await sourceReadingClient.query("ROLLBACK");
      log("Dry run passed: Production sources are readable in read-only transactions and local PostgreSQL can create clone databases.");
      return;
    }

    log("Creating isolated local clone databases...");
    await createLocalDatabase(localBaseUrl, coreCloneName);
    coreCreated = true;
    await createLocalDatabase(localBaseUrl, contentCloneName);
    contentCreated = true;

    runMigrations(coreTargetUrl);

    sourceCoreClient = await sourceCorePool.connect();
    sourceReadingClient = await sourceReadingPool.connect();
    await sourceCoreClient.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await sourceReadingClient.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await sourceCoreClient.query("SET LOCAL statement_timeout = '10min'");
    await sourceReadingClient.query("SET LOCAL statement_timeout = '10min'");

    localCorePool = new Pool({ ...parseConnectionString(coreTargetUrl), max: 1 });
    localContentPool = new Pool({ ...parseConnectionString(contentTargetUrl), max: 1 });
    localCoreClient = await localCorePool.connect();
    localContentClient = await localContentPool.connect();

    const [sourceCoreMetadata, localCoreMetadata] = await Promise.all([
      loadCoreMetadata(sourceCoreClient),
      loadCoreMetadata(localCoreClient),
    ]);
    compareCoreSchema(sourceCoreMetadata, localCoreMetadata);
    await validateEmptyTargets(localCoreClient, localContentClient);

    log("Copying and sanitizing Tutor Advantage production data...");
    await copyCoreDatabase(sourceCoreClient, localCoreClient, sourceCoreMetadata, localCoreMetadata, ownerEmail, localProviderSubjects);

    log("Copying Reading Advantage article content (student accounts and activity are excluded)...");
    await copyReadingContent(sourceReadingClient, localContentClient);

    await verifyCoreIntegrity(localCoreClient, ownerEmail);
    await verifyRowCounts(sourceCoreClient, localCoreClient, sourceCoreMetadata.tables, sourceReadingClient, localContentClient);
    await sourceCoreClient.query("ROLLBACK");
    await sourceReadingClient.query("ROLLBACK");

    await updateRuntimeUrls(coreTargetUrl, contentTargetUrl, ownerEmail);
    log("Clone completed. .env now points the local apps at the sanitized local databases.");
  } catch (error) {
    if (sourceCoreClient) await sourceCoreClient.query("ROLLBACK").catch(() => undefined);
    if (sourceReadingClient) await sourceReadingClient.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    if (localCoreClient) localCoreClient.release();
    if (localContentClient) localContentClient.release();
    if (localCorePool) await localCorePool.end();
    if (localContentPool) await localContentPool.end();
    if (sourceCoreClient) sourceCoreClient.release();
    if (sourceReadingClient) sourceReadingClient.release();
    await sourceCorePool.end();
    await sourceReadingPool.end();
  }
}

main().catch((error) => {
  if (error?.safeSummary) process.stderr.write(`Production clone stopped: ${error.message} (PostgreSQL code ${error.code || "unknown"}). Row values were not logged.\n`);
  else if (error?.code) process.stderr.write(`Production clone stopped during a database operation (PostgreSQL code ${error.code}). No database URL or row data was logged.\n`);
  else process.stderr.write(`Production clone stopped: ${error.message}\n`);
  process.exitCode = 1;
});
