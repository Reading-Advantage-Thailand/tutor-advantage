"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileKey2,
  KeyRound,
  Link2,
  RefreshCw,
  Rows3,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DbTable = {
  schemaName: string;
  tableName: string;
  rowCount: number;
  isPreserved: boolean;
};

type DbColumn = {
  schemaName: string;
  tableName: string;
  columnName: string;
  dataType: string;
  isNullable: "YES" | "NO";
  columnDefault: string | null;
  ordinalPosition: number;
};

type DbIndex = {
  schemaName: string;
  tableName: string;
  indexName: string;
  indexDef: string;
};

type DbConstraint = {
  schemaName: string;
  tableName: string;
  constraintName: string;
  constraintType: string;
  columns: string;
};

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
  database: { host: string; port: string; name: string } | null;
  preservedTables: string[];
  resetSchemas: string[];
  tables: DbTable[];
  columns: DbColumn[];
  indexes: DbIndex[];
  constraints: DbConstraint[];
  foreignKeys: DbForeignKey[];
};

const BOOK_TABLES = new Set(["learning.series", "learning.books", "learning.articles"]);

function tableKey(table: Pick<DbTable, "schemaName" | "tableName">) {
  return `${table.schemaName}.${table.tableName}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function DevDatabasePage() {
  const [data, setData] = useState<DatabasePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [schemaFilter, setSchemaFilter] = useState("all");
  const [selectedTableKey, setSelectedTableKey] = useState<string | null>(null);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dev/database", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load database metadata");
      setData(body);
      setSelectedTableKey((prev) => prev ?? (body.tables?.[0] ? tableKey(body.tables[0]) : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const schemas = useMemo(
    () => Array.from(new Set(data?.tables.map((table) => table.schemaName) ?? [])).sort(),
    [data],
  );

  const filteredTables = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.tables ?? []).filter((table) => {
      if (schemaFilter !== "all" && table.schemaName !== schemaFilter) return false;
      if (!query) return true;
      return tableKey(table).toLowerCase().includes(query);
    });
  }, [data, schemaFilter, search]);

  const selectedTable = useMemo(
    () => data?.tables.find((table) => tableKey(table) === selectedTableKey) ?? null,
    [data, selectedTableKey],
  );

  const selectedDetails = useMemo(() => {
    if (!selectedTable || !data) {
      return { columns: [], indexes: [], constraints: [], foreignKeys: [] };
    }
    const sameTable = (item: { schemaName: string; tableName: string }) =>
      item.schemaName === selectedTable.schemaName && item.tableName === selectedTable.tableName;

    return {
      columns: data.columns.filter(sameTable),
      indexes: data.indexes.filter(sameTable),
      constraints: data.constraints.filter(sameTable),
      foreignKeys: data.foreignKeys.filter(sameTable),
    };
  }, [data, selectedTable]);

  const selectedTruncatableTables = useMemo(
    () => (data?.tables ?? []).filter((table) => selectedTables.has(tableKey(table)) && !table.isPreserved),
    [data, selectedTables],
  );

  const sqlPreview = selectedTruncatableTables.length
    ? `TRUNCATE TABLE ${selectedTruncatableTables
        .map((table) => `"${table.schemaName}"."${table.tableName}"`)
        .join(", ")} RESTART IDENTITY CASCADE;`
    : "-- Select non-preserved tables to preview TRUNCATE SQL.";

  const toggleTable = (key: string, checked: boolean) => {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const selectAllNonBookTables = () => {
    setSelectedTables(
      new Set(
        (data?.tables ?? [])
          .filter((table) => !table.isPreserved && table.schemaName !== "public")
          .map(tableKey),
      ),
    );
  };

  const clearSelection = () => {
    setSelectedTables(new Set());
    setConfirmText("");
  };

  const runAction = async (action: "truncate_selected" | "reset_except_books") => {
    if (confirmText !== "DELETE") {
      toast.error('Type DELETE to confirm this destructive action.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/dev/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          tables: Array.from(selectedTables),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Database action failed");
      toast.success(
        `Truncated ${body.truncatedTables.length} tables, removed about ${formatNumber(body.estimatedRowsRemoved)} rows.`,
      );
      clearSelection();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const totalRows = (data?.tables ?? []).reduce((sum, table) => sum + table.rowCount, 0);
  const preservedRows = (data?.tables ?? [])
    .filter((table) => table.isPreserved)
    .reduce((sum, table) => sum + table.rowCount, 0);

  if (process.env.NODE_ENV === "production") {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <p>Database Dev Mode is disabled in production.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">Database Dev Mode</h2>
            <p className="text-sm text-muted-foreground">
              Inspect tables, columns, indexes, keys, and truncate development data.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Database</p>
            <p className="mt-1 truncate text-sm font-bold">{data?.database?.name ?? "-"}</p>
            <p className="text-xs text-muted-foreground">
              {data?.database ? `${data.database.host}:${data.database.port}` : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tables</p>
            <p className="mt-1 text-2xl font-black">{data?.tables.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rows</p>
            <p className="mt-1 text-2xl font-black">{formatNumber(totalRows)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Preserved Book Rows</p>
            <p className="mt-1 text-2xl font-black">{formatNumber(preservedRows)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 flex gap-3">
        <Shield className="h-5 w-5 text-orange-600 shrink-0" />
        <p className="text-orange-800 dark:text-orange-300 text-sm">
          Preserved tables are locked: <strong>learning.series</strong>, <strong>learning.books</strong>, and{" "}
          <strong>learning.articles</strong>. Reset actions truncate everything else in identity, learning, and finance_mlm.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(360px,520px)_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-3 border-b">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Rows3 className="h-4 w-4" />
              Tables
            </CardTitle>
            <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-9 pl-9"
                  placeholder="Search schema.table"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Select value={schemaFilter} onValueChange={setSchemaFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All schemas</SelectItem>
                  {schemas.map((schema) => (
                    <SelectItem key={schema} value={schema}>
                      {schema}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="max-h-[680px] overflow-auto p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="divide-y">
                {filteredTables.map((table) => {
                  const key = tableKey(table);
                  const active = key === selectedTableKey;
                  const disabled = table.isPreserved;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedTableKey(key)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                        active ? "bg-brand-50 dark:bg-brand-900/20" : "hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTables.has(key)}
                        disabled={disabled}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => toggleTable(key, event.target.checked)}
                        className="h-4 w-4"
                        aria-label={`Select ${key}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold">{key}</span>
                          {BOOK_TABLES.has(key) && (
                            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/5 text-[10px] text-emerald-700">
                              BOOK
                            </Badge>
                          )}
                          {disabled && !BOOK_TABLES.has(key) && (
                            <Badge variant="outline" className="text-[10px]">
                              LOCKED
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{formatNumber(table.rowCount)} rows</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={selectAllNonBookTables}>
                  Select all non-book tables
                </Button>
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <div className="space-y-1">
                  <Label className="text-xs">Confirmation</Label>
                  <Input
                    className="h-9 font-mono"
                    value={confirmText}
                    onChange={(event) => setConfirmText(event.target.value)}
                    placeholder="Type DELETE"
                  />
                </div>
                <Button
                  variant="destructive"
                  className="self-end"
                  disabled={submitting || confirmText !== "DELETE" || selectedTruncatableTables.length === 0}
                  onClick={() => void runAction("truncate_selected")}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Truncate selected
                </Button>
                <Button
                  variant="destructive"
                  className="self-end"
                  disabled={submitting || confirmText !== "DELETE"}
                  onClick={() => void runAction("reset_except_books")}
                >
                  Reset except books
                </Button>
              </div>

              <div className="rounded-md border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">SQL Preview</p>
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-xs">{sqlPreview}</pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-sm">
                <span>Table Details</span>
                {selectedTable && (
                  <Badge variant="outline" className="font-mono">
                    {tableKey(selectedTable)}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {!selectedTable ? (
                <p className="text-sm text-muted-foreground">Select a table to inspect metadata.</p>
              ) : (
                <>
                  <section>
                    <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <FileKey2 className="h-3.5 w-3.5" />
                      Columns
                    </h3>
                    <div className="overflow-auto rounded-md border">
                      <table className="w-full min-w-[640px] text-left text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">Nullable</th>
                            <th className="px-3 py-2">Default</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {selectedDetails.columns.map((column) => (
                            <tr key={column.columnName}>
                              <td className="px-3 py-2 text-muted-foreground">{column.ordinalPosition}</td>
                              <td className="px-3 py-2 font-mono font-bold">{column.columnName}</td>
                              <td className="px-3 py-2">{column.dataType}</td>
                              <td className="px-3 py-2">{column.isNullable}</td>
                              <td className="max-w-[260px] truncate px-3 py-2 font-mono text-muted-foreground">
                                {column.columnDefault ?? "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <KeyRound className="h-3.5 w-3.5" />
                        Constraints
                      </h3>
                      <div className="space-y-2">
                        {selectedDetails.constraints.map((constraint) => (
                          <div key={constraint.constraintName} className="rounded-md border p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate font-mono text-xs font-bold">{constraint.constraintName}</p>
                              <Badge variant="secondary" className="text-[10px]">
                                {constraint.constraintType}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{constraint.columns || "-"}</p>
                          </div>
                        ))}
                        {selectedDetails.constraints.length === 0 && (
                          <p className="text-sm text-muted-foreground">No constraints.</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <Link2 className="h-3.5 w-3.5" />
                        Foreign Keys
                      </h3>
                      <div className="space-y-2">
                        {selectedDetails.foreignKeys.map((fk) => (
                          <div key={`${fk.constraintName}-${fk.columnName}`} className="rounded-md border p-3">
                            <p className="font-mono text-xs font-bold">{fk.columnName}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {fk.foreignSchemaName}.{fk.foreignTableName}.{fk.foreignColumnName}
                            </p>
                          </div>
                        ))}
                        {selectedDetails.foreignKeys.length === 0 && (
                          <p className="text-sm text-muted-foreground">No foreign keys.</p>
                        )}
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Indexes</h3>
                    <div className="space-y-2">
                      {selectedDetails.indexes.map((index) => (
                        <div key={index.indexName} className="rounded-md border p-3">
                          <p className="font-mono text-xs font-bold">{index.indexName}</p>
                          <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/40 p-2 font-mono text-[11px] text-muted-foreground">
                            {index.indexDef}
                          </pre>
                        </div>
                      ))}
                      {selectedDetails.indexes.length === 0 && (
                        <p className="text-sm text-muted-foreground">No indexes.</p>
                      )}
                    </div>
                  </section>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
