"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { BookOpen, Check, Clock, Copy, Play, Plus, Users } from "lucide-react";
import { Chip, EmptyState, Grid, Notice, Section, SelectField, Surface, toast } from "@/components/app";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatThaiDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { createDemoClass, type Book, type DemoClass } from "../actions";
import { activeDemoClasses, demoInviteUrl, expiryParts } from "../lib/demo";

/** Current time, updated every minute after mount (null during SSR/hydration). */
function useMinuteClock(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function ExpiryChip({ expiresAt, now }: { expiresAt: string; now: number | null }) {
  if (now === null) {
    return (
      <Chip tone="warning" icon={Clock} size="sm">
        {t("demo.expiresAtPrefix")} {formatThaiDateTime(expiresAt, "short")}
      </Chip>
    );
  }
  const { expired, hours, minutes } = expiryParts(expiresAt, now);
  return (
    <Chip tone={expired ? "danger" : "warning"} icon={Clock} size="sm">
      {expired
        ? t("demo.expired")
        : hours > 0
          ? `${t("demo.expiresInPrefix")} ${hours} ${t("demo.hoursUnit")} ${minutes} ${t("demo.minutesUnit")}`
          : `${t("demo.expiresInPrefix")} ${minutes} ${t("demo.minutesUnit")}`}
    </Chip>
  );
}

function InviteLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = demoInviteUrl(origin, token);

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface-muted py-1.5 pr-1.5 pl-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-fg-muted">{t("demo.inviteLinkLabel")}</p>
        <p className="truncate text-[0.8125rem] text-fg" title={url}>
          {url.replace(/^https?:\/\//, "")}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={handleCopy} aria-label={t("demo.copyInviteLink")} disabled={!origin}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? t("shell.copied") : t("shell.copy")}
      </Button>
    </div>
  );
}

function DemoRoomCard({ room, now }: { room: DemoClass; now: number | null }) {
  return (
    <Surface padding="md" as="article">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tone="info" size="sm">
          CEFR {room.cefrLevel}
        </Chip>
        <ExpiryChip expiresAt={room.expiresAt} now={now} />
      </div>
      <h3 className="mt-2 truncate text-[0.9375rem] font-semibold text-fg">{room.bookTitle}</h3>
      <p className="mt-0.5 flex items-center gap-1 text-[0.8125rem] text-fg-muted">
        <Users aria-hidden="true" className="size-3.5" />
        <span className="tabular">
          {room.enrolledCount} / {room.capacity}
        </span>{" "}
        {t("demo.studentsUnit")}
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {room.referralToken ? <InviteLink token={room.referralToken} /> : null}
        <Link
          href={`/lesson/${room.classId}/interactive`}
          className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto sm:self-end")}
        >
          <Play aria-hidden="true" className="fill-current" />
          {t("demo.startTeaching")}
        </Link>
      </div>
    </Surface>
  );
}

export function DemoWorkspace({
  books,
  initialClasses,
  loadError,
}: {
  books: Book[];
  initialClasses: DemoClass[];
  loadError: boolean;
}) {
  const [demoClasses, setDemoClasses] = useState<DemoClass[]>(initialClasses);
  const [creating, startCreating] = useTransition();
  const [error, setError] = useState<string | null>(loadError ? t("demo.loadDataFailed") : null);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const now = useMinuteClock();

  const handleCreate = () => {
    if (!selectedBookId) return;
    setError(null);
    startCreating(async () => {
      try {
        const newClass = await createDemoClass(selectedBookId);
        setDemoClasses((prev) => [newClass, ...prev]);
        setSelectedBookId(null);
        toast.success(t("demo.createSuccess"));
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : t("demo.createFailed"));
      }
    });
  };

  const activeClasses = activeDemoClasses(demoClasses, now ?? Date.now());

  return (
    <>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}

      {activeClasses.length === 0 ? (
        <Section title={t("demo.createTitle")}>
          <Surface padding="md">
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                handleCreate();
              }}
            >
              <SelectField
                id="demo-book"
                label={t("demo.bookLabel")}
                placeholder={t("demo.bookPlaceholder")}
                hint={t("demo.createHint")}
                containerClassName="flex-1"
                value={selectedBookId ?? ""}
                onChange={(event) => setSelectedBookId(event.target.value || null)}
                options={books.map((book) => ({ value: book.bookId, label: `[${book.cefrLevel}] ${book.title}` }))}
                disabled={creating}
              />
              <Button
                type="submit"
                size="lg"
                disabled={!selectedBookId || creating}
                loading={creating}
                className="w-full sm:mb-[1.625rem] sm:w-auto"
              >
                {!creating ? <Plus aria-hidden="true" /> : null}
                {creating ? t("demo.creating") : t("demo.createButton")}
              </Button>
            </form>
          </Surface>
        </Section>
      ) : (
        <Notice tone="info" title={t("demo.activeExistsTitle")}>
          {t("demo.activeExistsDescription")}
        </Notice>
      )}

      {activeClasses.length > 0 ? (
        <Section title={t("demo.activeTitle")}>
          <Grid cols={2}>
            {activeClasses.map((room) => (
              <DemoRoomCard key={room.classId} room={room} now={now} />
            ))}
          </Grid>
        </Section>
      ) : null}

      {demoClasses.length === 0 && !loadError ? (
        <EmptyState
          compact
          icon={BookOpen}
          tone="brand"
          title={t("demo.emptyTitle")}
          description={t("demo.emptyDescription")}
        />
      ) : null}
    </>
  );
}
