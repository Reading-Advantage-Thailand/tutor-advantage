"use client";

import { Database, Lock, Rows3, Table2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Chip,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  Grid,
  Notice,
  Page,
  PageHeader,
  SearchField,
  Section,
  SelectField,
  StatCard,
  Surface,
  useAdminSession,
  type DataTableColumn,
} from "@/components/app";
import { toast } from "@/components/app/Toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { invalidateResource, useCachedResource } from "@/lib/cachedResource";
import { formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type DbTable = { schemaName: string; tableName: string; rowCount: number; isPreserved: boolean };
type DbColumn = {
  schemaName: string;
  tableName: string;
  columnName: string;
  dataType: string;
  isNullable: "YES" | "NO";
  columnDefault: string | null;
  ordinalPosition: number;
};
type DbIndex = { schemaName: string; tableName: string; indexName: string; indexDef: string };
type DbConstraint = { schemaName: string; tableName: string; constraintName: string; constraintType: string; columns: string };
type DbForeignKey = {
  schemaName: string;
  tableName: string;
  columnName: string;
  foreignSchemaName: string;
  foreignTableName: string;
  foreignColumnName: string;
  constraintName: string;
};
type DatabasePayload = {
  database: { host: string; port: string; name: string | null } | null;
  preservedTables: string[];
  resetSchemas: string[];
  tables: DbTable[];
  columns: DbColumn[];
  indexes: DbIndex[];
  constraints: DbConstraint[];
  foreignKeys: DbForeignKey[];
};

const BOOK_TABLES = new Set(["learning.series", "learning.books", "learning.articles"]);
const tableKey = (table: Pick<DbTable, "schemaName" | "tableName">) => `${table.schemaName}.${table.tableName}`;

async function dbRequest<T>(init?: RequestInit): Promise<T> {
  const res = await fetch("/api/dev/database", { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = (await res.json().catch(() => null)) as (T & { error?: { message?: string } | string }) | null;
  if (!res.ok) {
    const message = typeof body?.error === "string" ? body.error : body?.error?.message;
    throw new Error(message || t("dev.dbLoadFailed"));
  }
  return body as T;
}

const columnColumns: DataTableColumn<DbColumn>[] = [
  { key: "pos", header: "#", width: "48px", mobile: "hidden", cell: (column) => <span className="text-fg-muted">{column.ordinalPosition}</span> },
  { key: "name", header: t("dev.dbColName"), mobile: "primary", cell: (column) => <code className="font-mono text-[0.8125rem] font-semibold">{column.columnName}</code> },
  { key: "type", header: t("dev.dbColType"), mobile: "secondary", cell: (column) => <span className="text-[0.8125rem]">{column.dataType}</span> },
  {
    key: "nullable",
    header: t("dev.dbColNullable"),
    mobile: "trailing",
    cell: (column) => <Chip size="sm" tone={column.isNullable === "YES" ? "neutral" : "info"}>{column.isNullable === "YES" ? t("dev.dbYes") : t("dev.dbNo")}</Chip>,
  },
  {
    key: "default",
    header: t("dev.dbColDefault"),
    cell: (column) => (
      <code className="block max-w-72 truncate font-mono text-xs text-fg-muted" title={column.columnDefault ?? undefined}>
        {column.columnDefault ?? "–"}
      </code>
    ),
  },
];

export function DevDatabaseClient() {
  const me = useAdminSession();
  const key = me ? `${me.userId}:dev-db` : null;
  const { data, error, isLoading, isValidating, refetch } = useCachedResource(key, () => dbRequest<DatabasePayload>(), {
    keepPreviousData: true,
  });
  const [search, setSearch] = useState("");
  const [schema, setSchema] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<"truncate_selected" | "reset_except_books" | null>(null);

  const tables = useMemo(() => data?.tables ?? [], [data]);
  const dbName = data?.database?.name ?? "";
  const schemas = useMemo(() => Array.from(new Set(tables.map((table) => table.schemaName))).sort(), [tables]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tables.filter((table) => (!schema || table.schemaName === schema) && (!query || tableKey(table).toLowerCase().includes(query)));
  }, [tables, schema, search]);
  const active = tables.find((table) => tableKey(table) === activeKey) ?? null;
  const details = useMemo(() => {
    if (!active || !data) return null;
    const same = (item: { schemaName: string; tableName: string }) =>
      item.schemaName === active.schemaName && item.tableName === active.tableName;
    return {
      columns: data.columns.filter(same),
      indexes: data.indexes.filter(same),
      constraints: data.constraints.filter(same),
      foreignKeys: data.foreignKeys.filter(same),
    };
  }, [active, data]);

  const selectedTables = tables.filter((table) => selected.has(tableKey(table)) && !table.isPreserved);
  const selectedRows = selectedTables.reduce((sum, table) => sum + table.rowCount, 0);
  const resetTables = tables.filter((table) => !table.isPreserved && (data?.resetSchemas ?? []).includes(table.schemaName));
  const totalRows = tables.reduce((sum, table) => sum + table.rowCount, 0);
  const preservedRows = tables.filter((table) => table.isPreserved).reduce((sum, table) => sum + table.rowCount, 0);
  const sqlPreview = selectedTables.length
    ? `TRUNCATE TABLE ${selectedTables.map((table) => `"${table.schemaName}"."${table.tableName}"`).join(", ")} RESTART IDENTITY CASCADE;`
    : t("dev.dbSqlEmpty");

  const toggle = (tableId: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(tableId);
      else next.delete(tableId);
      return next;
    });

  const confirmTables = confirm === "reset_except_books" ? resetTables : selectedTables;
  const confirmRows = confirmTables.reduce((sum, table) => sum + table.rowCount, 0);

  return (
    <Page>
      <PageHeader
        title={t("dev.dbTitle")}
        description={t("dev.dbDescription")}
        meta={<Chip tone="warning">{t("dev.devOnlyBadge")}</Chip>}
        actions={
          <Button variant="outline" onClick={() => key && invalidateResource(key)} loading={isValidating}>
            {t("shell.refresh")}
          </Button>
        }
      />

      {error && !data ? (
        <ErrorState onRetry={refetch} description={error instanceof Error ? error.message : undefined} />
      ) : (
        <>
          <Grid cols={4} className="grid-cols-2">
            <StatCard label={t("dev.dbName")} value={<span className="text-lg break-all">{dbName || "–"}</span>} icon={Database} tone="neutral" hint={data?.database ? `${data.database.host}:${data.database.port}` : undefined} />
            <StatCard label={t("dev.dbTables")} value={formatNumber(tables.length)} icon={Table2} tone="blue" />
            <StatCard label={t("dev.dbRows")} value={formatNumber(totalRows)} icon={Rows3} tone="purple" />
            <StatCard label={t("dev.dbPreservedRows")} value={formatNumber(preservedRows)} icon={Lock} tone="teal" />
          </Grid>

          <Notice tone="warning" title={t("dev.dbSharedWarning")}>
            {t("dev.dbPreservedNotice")}
          </Notice>

          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
            <Surface className="flex min-w-0 flex-col gap-3 p-0">
              <div className="flex flex-col gap-2 border-b border-hairline p-4">
                <SearchField value={search} onValueChange={setSearch} label={t("dev.dbSearch")} containerClassName="min-w-0 flex-1" />
                <SelectField
                  aria-label={t("dev.dbSchema")}
                  containerClassName="w-full"
                  value={schema}
                  onChange={(event) => setSchema(event.target.value)}
                  options={[{ value: "", label: t("dev.dbAllSchemas") }, ...schemas.map((name) => ({ value: name, label: name }))]}
                />
              </div>
              {isLoading && !data ? (
                <p className="px-4 pb-4 text-sm text-fg-muted">{t("shell.loading")}</p>
              ) : (
                <ul className="max-h-[560px] divide-y divide-hairline overflow-y-auto" aria-label={t("dev.dbTables")}>
                  {filtered.map((table) => {
                    const id = tableKey(table);
                    const isActive = id === activeKey;
                    return (
                      <li key={id} className={cn("flex items-center gap-3 px-4 py-2.5", isActive && "bg-brand-soft")}>
                        <Checkbox
                          checked={selected.has(id)}
                          disabled={table.isPreserved}
                          onCheckedChange={(value) => toggle(id, Boolean(value))}
                          aria-label={t("dev.dbSelectTable", { table: id })}
                        />
                        <button
                          type="button"
                          onClick={() => setActiveKey(id)}
                          aria-current={isActive || undefined}
                          className="flex min-w-0 flex-1 flex-col items-start text-left"
                        >
                          <span className="flex max-w-full items-center gap-1.5">
                            <code className="truncate font-mono text-[0.8125rem] font-semibold text-fg">{id}</code>
                            {BOOK_TABLES.has(id) ? <Chip size="sm" tone="success">{t("dev.dbBook")}</Chip> : table.isPreserved ? <Chip size="sm">{t("dev.dbLocked")}</Chip> : null}
                          </span>
                          <span className="text-xs text-fg-muted">{t("dev.dbRowsCount", { count: formatNumber(table.rowCount) })}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Surface>

            <div className="flex min-w-0 flex-col gap-6">
              <Section title={t("dev.dbActionsTitle")}>
                <Surface className="flex min-w-0 flex-col gap-4">
                  <p className="text-sm text-fg-muted">
                    {t("dev.dbSelectedCount", { count: formatNumber(selectedTables.length), rows: formatNumber(selectedRows) })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelected(new Set(tables.filter((table) => !table.isPreserved && table.schemaName !== "public").map(tableKey)))}
                    >
                      {t("dev.dbSelectAll")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
                      {t("dev.dbClear")}
                    </Button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[0.8125rem] font-medium text-fg-muted">{t("dev.dbSqlPreview")}</p>
                    <pre className="max-h-32 overflow-auto rounded-lg border border-hairline bg-surface-muted p-3 font-mono text-xs break-all whitespace-pre-wrap text-fg">
                      {sqlPreview}
                    </pre>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="danger" disabled={selectedTables.length === 0 || !dbName} onClick={() => setConfirm("truncate_selected")}>
                      <Trash2 aria-hidden="true" />
                      {t("dev.dbTruncate")}
                    </Button>
                    <Button variant="destructive" disabled={!dbName} onClick={() => setConfirm("reset_except_books")}>
                      {t("dev.dbReset")}
                    </Button>
                  </div>
                </Surface>
              </Section>

              <Section
                title={t("dev.dbDetails")}
                action={active ? <code className="truncate font-mono text-[0.8125rem] text-fg-muted">{tableKey(active)}</code> : undefined}
              >
                {!active || !details ? (
                  <EmptyState compact icon={Table2} title={t("dev.dbPickTable")} />
                ) : (
                  <div className="flex min-w-0 flex-col gap-5">
                    <div className="flex min-w-0 flex-col gap-2">
                      <h3 className="text-sm font-semibold text-fg">{t("dev.dbColumns")}</h3>
                      <DataTable
                        caption={t("dev.dbColumns")}
                        rows={details.columns}
                        columns={columnColumns}
                        getRowKey={(column) => column.columnName}
                        breakpoint="lg"
                      />
                    </div>
                    <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
                      <DetailList
                        title={t("dev.dbConstraints")}
                        items={details.constraints.map((item) => ({
                          key: item.constraintName,
                          title: item.constraintName,
                          badge: item.constraintType,
                          body: item.columns || "–",
                        }))}
                      />
                      <DetailList
                        title={t("dev.dbForeignKeys")}
                        items={details.foreignKeys.map((item) => ({
                          key: `${item.constraintName}-${item.columnName}`,
                          title: item.columnName,
                          body: `→ ${item.foreignSchemaName}.${item.foreignTableName}.${item.foreignColumnName}`,
                        }))}
                      />
                    </div>
                    <DetailList
                      title={t("dev.dbIndexes")}
                      items={details.indexes.map((item) => ({ key: item.indexName, title: item.indexName, body: item.indexDef, code: true }))}
                    />
                  </div>
                )}
              </Section>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        tone="danger"
        irreversible
        title={
          confirm === "reset_except_books"
            ? t("dev.dbResetTitle", { name: dbName })
            : t("dev.dbTruncateTitle", { count: formatNumber(confirmTables.length) })
        }
        description={confirm === "reset_except_books" ? t("dev.dbResetDescription") : t("dev.dbTruncateDescription")}
        details={
          <DescriptionList
            columns={2}
            items={[
              { label: t("dev.dbTables"), value: formatNumber(confirmTables.length) },
              { label: t("dev.dbRows"), value: formatNumber(confirmRows) },
            ]}
          />
        }
        requireText={dbName}
        confirmLabel={confirm === "reset_except_books" ? t("dev.dbResetConfirm") : t("dev.dbTruncateConfirm")}
        cancelLabel={t("dev.close")}
        onConfirm={async () => {
          if (!confirm) return;
          const result = await dbRequest<{ truncatedTables: string[]; estimatedRowsRemoved: number }>({
            method: "POST",
            body: JSON.stringify({ action: confirm, tables: Array.from(selected), confirm: dbName }),
          });
          toast.success(
            t("dev.dbDone", { count: formatNumber(result.truncatedTables.length), rows: formatNumber(result.estimatedRowsRemoved) }),
          );
          setSelected(new Set());
          if (key) invalidateResource(key);
        }}
      />
    </Page>
  );
}

function DetailList({
  title,
  items,
}: {
  title: string;
  items: { key: string; title: string; badge?: string; body: string; code?: boolean }[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-fg-muted">{t("dev.dbNone")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.key} className="min-w-0 rounded-lg border border-hairline bg-surface p-3">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <code className="truncate font-mono text-[0.8125rem] font-semibold text-fg">{item.title}</code>
                {item.badge ? <Chip size="sm">{item.badge}</Chip> : null}
              </div>
              {item.code ? (
                <pre className="mt-2 max-h-28 overflow-auto rounded bg-surface-muted p-2 font-mono text-xs break-all whitespace-pre-wrap text-fg-muted">{item.body}</pre>
              ) : (
                <p className="mt-1 text-[0.8125rem] break-all text-fg-muted">{item.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
