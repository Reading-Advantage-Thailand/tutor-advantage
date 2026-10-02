"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AdminStatusChip, Field, IdCell, ListGroup, ListRow, SearchField, Spinner, UserAvatar } from "@/components/app";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import "@/locales/th/adjustments";

export interface PickedTutor {
  id: string;
  name: string | null;
  email: string | null;
  verificationStatus: string | null;
}

interface UserListItem {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  verificationStatus?: string | null;
}

/**
 * Searchable tutor picker (name, email, phone or UUID) backed by
 * GET /v1/users?role=TUTOR&q=… — replaces the free-text "tutor user id" field.
 */
export function TutorPicker({
  value,
  onChange,
  error,
  disabled,
}: {
  value: PickedTutor | null;
  onChange: (tutor: PickedTutor | null) => void;
  error?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (value) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setFailed(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const data = await api.get<{ users?: UserListItem[]; items?: UserListItem[] }>("/v1/users", {
          query: { role: "TUTOR", q, pageSize: 8 },
        });
        const list = (data.items ?? data.users ?? []).filter((user) => user.role === "TUTOR");
        // Older list endpoints ignore q: filter on the client as a fallback.
        const needle = q.toLowerCase();
        const filtered = list.filter(
          (user) =>
            user.id === q ||
            (user.name ?? "").toLowerCase().includes(needle) ||
            (user.email ?? "").toLowerCase().includes(needle),
        );
        if (!cancelled) setResults(filtered.slice(0, 8));
      } catch {
        if (!cancelled) {
          setResults([]);
          setFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, value]);

  if (value) {
    return (
      <Field label={t("adjustments.fieldTutor")} required>
        <div className="flex items-center gap-3 rounded-xl border border-hairline bg-surface-muted px-3 py-2.5">
          <UserAvatar name={value.name ?? value.email ?? "?"} size="sm" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium text-fg">{value.name ?? t("adjustments.noName")}</span>
            <span className="flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-fg-muted">
              {value.email ? <span className="truncate">{value.email}</span> : null}
              <IdCell id={value.id} />
            </span>
            {value.verificationStatus ? (
              <span className="mt-1">
                <AdminStatusChip domain="verification" status={value.verificationStatus} />
              </span>
            ) : null}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={t("adjustments.changeTutor")}
            onClick={() => onChange(null)}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      </Field>
    );
  }

  return (
    <Field label={t("adjustments.fieldTutor")} required error={error} hint={t("adjustments.tutorSearchHint")}>
      {() => (
        <div className="flex flex-col gap-2">
          <SearchField
            value={query}
            onValueChange={setQuery}
            placeholder={t("adjustments.tutorSearchPlaceholder")}
            label={t("adjustments.fieldTutor")}
            disabled={disabled}
          />
          {loading ? (
            <span className="flex items-center gap-2 px-1 text-[0.8125rem] text-fg-muted">
              <Spinner /> {t("adjustments.tutorSearching")}
            </span>
          ) : failed ? (
            <span className="px-1 text-[0.8125rem] text-danger-fg">{t("adjustments.tutorSearchFailed")}</span>
          ) : query.trim().length >= 2 && results.length === 0 ? (
            <span className="px-1 text-[0.8125rem] text-fg-muted">{t("adjustments.tutorNoResults")}</span>
          ) : null}
          {results.length > 0 ? (
            <ListGroup aria-label={t("adjustments.tutorResults")}>
              {results.map((user) => (
                <ListRow
                  key={user.id}
                  onClick={() =>
                    onChange({
                      id: user.id,
                      name: user.name,
                      email: user.email,
                      verificationStatus: user.verificationStatus ?? null,
                    })
                  }
                  leading={<UserAvatar name={user.name ?? user.email ?? "?"} size="sm" />}
                  title={user.name ?? t("adjustments.noName")}
                  subtitle={user.email ?? undefined}
                  trailing={
                    user.verificationStatus ? (
                      <AdminStatusChip domain="verification" status={user.verificationStatus} />
                    ) : undefined
                  }
                  chevron={false}
                />
              ))}
            </ListGroup>
          ) : null}
        </div>
      )}
    </Field>
  );
}
