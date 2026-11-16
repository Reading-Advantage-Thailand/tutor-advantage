"use client";

/**
 * Markup of the live lobby (phase 0), split from LobbyClient so it can be
 * rendered without a socket (dev presenter preview). LobbyClient owns every
 * value and handler and passes them in unchanged.
 *
 * Layout: the lesson hero (cover, "บทเรียนวันนี้", the title as the page's
 * h1) and the readiness card (big "พร้อมแล้ว 3/5 คน", bar, one row per
 * student with a status chip: dot + word) on the left; the join card (QR in
 * its own white quiet zone, link + copy, LINE reminder), the activity choice
 * and tips on the right. Phones: lesson → join → students → activity → tips.
 * The dock keeps the one primary "เริ่มบทเรียน".
 */
import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Bell, BookOpen, Check, Copy, Lightbulb, Play, QrCode, Trash2, UserMinus, Users, WifiOff, X, type LucideIcon } from "lucide-react";
import { Chip, EmptyState, IconTile, LessonBarActions, LessonDock, ProgressBar, Skeleton, Spinner, LoadingAnnouncement, UserAvatar } from "@/components/app";
import { Button } from "@/components/ui/button";
import type { Participant } from "@/lib/lesson-types";
import { t } from "@/lib/i18n";
import { thaiCopy, thaiLabel } from "@/lib/thaiText";
import { cn } from "@/lib/utils";

function LobbyPanel({ className, children, ...rest }: React.ComponentProps<"section">) {
  return (
    <section className={cn("rounded-(--radius-card) border border-clay-rim bg-surface shadow-card", className)} {...rest}>
      {children}
    </section>
  );
}

function LessonCover({ src, title }: { src: string | null; title: string }) {
  const [failed, setFailed] = React.useState(false);
  if (!src || failed) {
    return (
      <div className="flex aspect-[16/9] w-full shrink-0 items-center justify-center rounded-(--radius-ctl) bg-tile-brand sm:aspect-[4/3] sm:w-52 lg:w-56">
        <BookOpen aria-hidden="true" className="size-10 text-icon-brand" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={title}
      onError={() => setFailed(true)}
      className="aspect-[16/9] w-full shrink-0 rounded-(--radius-ctl) bg-surface-muted object-cover sm:aspect-[4/3] sm:w-52 lg:w-56"
    />
  );
}

// Every way to join in one card: QR, link and a LINE reminder.
function JoinCard({
  referralLink,
  isSending,
  notificationStatus,
  onSendNotification,
}: {
  referralLink: string | null;
  isSending: boolean;
  notificationStatus: string | null;
  onSendNotification: () => void | Promise<void>;
}) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard
      .writeText(referralLink)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };

  return (
    <LobbyPanel id="lobby-invite" aria-labelledby="lobby-join-title" className="order-2 flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <IconTile icon={QrCode} tone="brand" />
        <div className="min-w-0">
          <h2 id="lobby-join-title" className="type-card text-fg">
            {t("lesson.live.joinTitle")}
          </h2>
          <p className="text-sm leading-[1.6] text-fg-muted">{thaiCopy(t("lesson.live.joinHelp"))}</p>
        </div>
      </div>

      {referralLink ? (
        <>
          {/* The QR carries its own white quiet zone in both themes (scanners need it). */}
          <div className="mx-auto overflow-hidden rounded-(--radius-card) border border-clay-rim shadow-card">
            <QRCodeSVG value={referralLink} size={200} level="M" marginSize={2} aria-label={t("lesson.live.joinLinkLabel")} className="block" />
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={referralLink}
              aria-label={t("lesson.live.joinLinkLabel")}
              onFocus={(event) => event.currentTarget.select()}
              className="h-11 min-w-0 flex-1 truncate rounded-(--radius-field) border border-field-border bg-surface-muted px-3 text-sm text-fg-muted"
            />
            <Button variant="outline" size="lg" onClick={handleCopy} aria-label={t("lesson.live.copyLink")}>
              {copied ? <Check aria-hidden="true" className="text-success-fg" /> : <Copy aria-hidden="true" />}
              <span className="hidden sm:inline xl:hidden 2xl:inline">{copied ? t("lesson.live.linkCopied") : t("lesson.live.copyLink")}</span>
            </Button>
          </div>
          <p aria-live="polite" className="sr-only">
            {copied ? t("lesson.live.linkCopied") : ""}
          </p>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-(--radius-card) bg-surface-muted px-4 py-8 text-center">
          <Spinner className="text-fg-subtle" />
          <p className="text-sm text-fg-muted">{t("lesson.live.joinLinkPreparing")}</p>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-hairline pt-4">
        <p className="text-sm font-semibold text-fg">{t("lesson.live.lineTitle")}</p>
        <p className="-mt-1.5 text-sm leading-[1.6] text-fg-muted">{t("lesson.live.lineHelp")}</p>
        <Button variant="soft" size="lg" disabled={isSending} loading={isSending} onClick={() => void onSendNotification()}>
          {!isSending ? <Bell aria-hidden="true" /> : null}
          {isSending ? t("lesson.live.lineSending") : t("lesson.live.lineSend")}
        </Button>
        {notificationStatus ? (
          <p role="status" className="text-[0.8125rem] leading-[1.6] text-fg-muted">
            {notificationStatus}
          </p>
        ) : null}
      </div>
    </LobbyPanel>
  );
}

export interface LobbyViewProps {
  demo: boolean;
  articleTitle: string;
  coverUrl: string | null;
  summary: string;
  cefr: string | null;
  genre?: unknown;
  participants: Participant[];
  readyCount: number;
  totalCount: number;
  isEveryoneReady: boolean;
  readyPct: number;
  referralLink: string | null;
  isSendingLobbyNotification: boolean;
  lobbyNotificationStatus: string | null;
  onSendNotification: () => void | Promise<void>;
  /** The activity picker (LiveAssessmentControls), when assessments are supported. */
  activity?: React.ReactNode;
  tutorTips: Array<[LucideIcon, string]>;
  onNudge: (participant: Participant) => void;
  onKick: (participant: Participant) => void;
  /** Dev builds: delete the session from the lesson bar. */
  onDevDelete?: () => void;
  onCloseRoom: () => void;
  startLabel: string;
  startDisabled: boolean;
  starting: boolean;
  onStart: () => void;
  /** Dev builds: start before everyone is ready. */
  onDevStart?: () => void;
}

export function LobbyView({
  demo,
  articleTitle,
  coverUrl,
  summary,
  cefr,
  genre,
  participants,
  readyCount,
  totalCount,
  isEveryoneReady,
  readyPct,
  referralLink,
  isSendingLobbyNotification,
  lobbyNotificationStatus,
  onSendNotification,
  activity,
  tutorTips,
  onNudge,
  onKick,
  onDevDelete,
  onCloseRoom,
  startLabel,
  startDisabled,
  starting,
  onStart,
  onDevStart,
}: LobbyViewProps) {
  return (
    <>
      <LessonBarActions>
        {demo ? (
          <Chip tone="info">{t("lesson.live.demoChip")}</Chip>
        ) : (
          <Chip tone="success" dot className="hidden sm:inline-flex">
            {t("lesson.live.lobbyLiveChip")}
          </Chip>
        )}
        {onDevDelete ? (
          <Button variant="ghost" size="sm" onClick={onDevDelete} className="hidden text-fg-subtle md:inline-flex">
            <Trash2 aria-hidden="true" />
            {t("lesson.live.devDelete")}
          </Button>
        ) : null}
        <Button variant="destructive" size="sm" onClick={onCloseRoom}>
          <X aria-hidden="true" />
          <span className="hidden sm:inline">{t("lesson.live.closeRoom")}</span>
          <span className="sr-only sm:hidden">{t("lesson.live.closeRoom")}</span>
        </Button>
      </LessonBarActions>

      <div className="flex min-h-[var(--lesson-viewport-h)] flex-col">
        {/* Phones/tablets: lesson → join → students → activity → tips.
            Desktop: lesson + students on the left, join/activity/tips on the right. */}
        <div className="mx-auto grid w-full max-w-7xl flex-1 content-start gap-4 px-4 pt-4 pb-6 md:px-6 md:pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] lg:grid-rows-[auto_1fr] lg:gap-5">
          <LobbyPanel
            aria-labelledby="lobby-lesson-title"
            className="order-1 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5 lg:col-start-1 lg:row-start-1"
          >
            <LessonCover src={coverUrl} title={articleTitle} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Chip tone="brand" icon={BookOpen} className="self-start">
                {t("lesson.live.lessonCardEyebrow")}
              </Chip>
              <h1
                id="lobby-lesson-title"
                lang={articleTitle ? "en" : undefined}
                className="font-heading text-[1.625rem] leading-[1.3] font-semibold text-balance-th text-fg md:text-[1.75rem]"
              >
                {articleTitle || t("lesson.interactive.lessonLoading")}
              </h1>
              <p className="line-clamp-2 text-[0.9375rem] leading-[1.6] text-fg-muted">{summary}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Chip>{t("lesson.live.stepsCount")}</Chip>
                {cefr ? (
                  <Chip tone="info">
                    {t("lesson.live.levelLabel")} {cefr}
                  </Chip>
                ) : null}
                {genre ? (
                  <Chip>
                    {t("lesson.live.genreLabel")} {String(genre)}
                  </Chip>
                ) : null}
              </div>
            </div>
          </LobbyPanel>

          <LobbyPanel
            id="lobby-students"
            aria-labelledby="lobby-students-title"
            className="order-3 flex flex-col lg:col-start-1 lg:row-start-2 lg:self-start"
          >
            <div className="flex flex-col gap-3 border-b border-hairline p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <IconTile icon={Users} tone="teal" />
                  <h2 id="lobby-students-title" className="type-section text-fg">
                    {thaiLabel(t("lesson.live.rosterReadyTitle"))}
                  </h2>
                </div>
                <p className="shrink-0 text-sm text-fg-muted">
                  {t("lesson.live.readyCount")}{" "}
                  <span className={cn("type-stat", isEveryoneReady ? "text-success-fg" : "text-fg")}>
                    {readyCount}/{totalCount}
                  </span>{" "}
                  {t("lesson.interactive.peopleUnit")}
                </p>
              </div>
              <ProgressBar value={readyPct} tone={isEveryoneReady ? "success" : "brand"} label={t("lesson.live.rosterReadyTitle")} />
            </div>

            {participants.length === 0 ? (
              <EmptyState
                compact
                mascot
                icon={Users}
                title={demo ? t("lesson.interactive.demoEmptyTitle") : t("lesson.interactive.emptyStudentsTitle")}
                description={
                  <span className="leading-[1.6]">
                    {thaiCopy(demo ? t("lesson.interactive.demoEmptyMessage") : t("lesson.interactive.emptyStudentsLinkMessage"))}
                  </span>
                }
              />
            ) : (
              <ul className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4">
                {participants.map((participant) => (
                  <li
                    key={participant.studentId}
                    className={cn(
                      "flex min-h-16 items-center gap-3 rounded-(--radius-ctl) border px-3 py-2.5",
                      participant.isReady ? "border-success-border bg-success-bg" : "border-clay-rim bg-surface",
                    )}
                  >
                    <UserAvatar name={participant.name} src={participant.pictureUrl} toneKey={participant.studentId} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.9375rem] font-semibold text-fg" title={participant.name}>
                        {participant.name}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[0.8125rem]",
                            participant.isReady ? "font-semibold text-success-fg" : "text-fg-muted",
                          )}
                        >
                          {participant.isReady ? (
                            <Check aria-hidden="true" className="size-3.5" strokeWidth={2.6} />
                          ) : (
                            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                          )}
                          {participant.isReady ? t("lesson.live.statusReady") : t("lesson.live.statusWaiting")}
                        </span>
                        {participant.offlineSince ? (
                          <span className="inline-flex items-center gap-1 text-[0.8125rem] font-medium whitespace-nowrap text-warning-fg">
                            <WifiOff aria-hidden="true" className="size-3.5" />
                            {t("lesson.live.statusOffline")}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!participant.isReady ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onNudge(participant)}
                          aria-label={`${t("lesson.interactive.nudgeTitle")} ${participant.name}`}
                          title={t("lesson.interactive.nudgeTitle")}
                        >
                          <Bell aria-hidden="true" />
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onKick(participant)}
                        aria-label={`${t("lesson.live.removeTitle")} ${participant.name}`}
                        title={t("lesson.live.removeTitle")}
                        className="text-fg-subtle hover:text-danger-fg"
                      >
                        <UserMinus aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </LobbyPanel>

          {/* Right column on desktop (display: contents below lg so the cards interleave) */}
          <div className="contents lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
            {!demo ? (
              <JoinCard
                referralLink={referralLink}
                isSending={isSendingLobbyNotification}
                notificationStatus={lobbyNotificationStatus}
                onSendNotification={onSendNotification}
              />
            ) : null}
            {activity ? (
              <div id="lobby-activity" className="order-4">
                {activity}
              </div>
            ) : null}
            <LobbyPanel aria-labelledby="lobby-tips-title" className="order-5 p-4 sm:p-5">
              <h2 id="lobby-tips-title" className="flex items-center gap-2 type-card text-fg">
                <Lightbulb aria-hidden="true" className="size-5 text-icon-amber" />
                {t("lesson.live.tipsTitle")}
              </h2>
              <ul className="mt-3 flex flex-col gap-2.5">
                {tutorTips.map(([Icon, tip]) => (
                  <li key={tip} className="flex items-start gap-2.5 text-sm leading-[1.6] text-fg-muted">
                    <span aria-hidden="true" className="inline-flex size-7 shrink-0 items-center justify-center rounded-(--radius-ctl-sm) bg-surface-muted">
                      <Icon className="size-4 text-fg-subtle" />
                    </span>
                    <span className="min-w-0">{thaiCopy(tip)}</span>
                  </li>
                ))}
              </ul>
            </LobbyPanel>
          </div>
        </div>

        {/* Start dock: always visible at the bottom edge */}
        <LessonDock className="mt-auto">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 md:px-2">
            <div className="flex min-w-0 items-center gap-2.5 text-sm text-fg-muted">
              {demo ? (
                t("lesson.interactive.demoSoloNote")
              ) : (
                <>
                  <span
                    aria-hidden="true"
                    className={cn("size-2 shrink-0 rounded-full", isEveryoneReady ? "bg-success-solid" : "bg-field-border")}
                  />
                  <span>
                    <span className="font-semibold text-fg">
                      {t("lesson.live.readyCount")} <span className="tabular-nums">{readyCount}/{totalCount}</span> {t("lesson.interactive.peopleUnit")}
                    </span>
                    {!isEveryoneReady ? (
                      <span className="hidden sm:inline">
                        {" · "}
                        {totalCount === 0 ? t("lesson.live.startHintEmpty") : t("lesson.live.startHint")}
                      </span>
                    ) : null}
                  </span>
                </>
              )}
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              {onDevStart ? (
                <Button variant="outline" size="lg" onClick={onDevStart} className="hidden md:inline-flex">
                  {t("lesson.live.devStartAnyway")}
                </Button>
              ) : null}
              <Button size="xl" className="w-full sm:w-auto sm:min-w-56" disabled={startDisabled} loading={starting} onClick={onStart}>
                {!starting ? <Play aria-hidden="true" fill="currentColor" /> : null}
                {startLabel}
              </Button>
            </div>
          </div>
        </LessonDock>
      </div>
    </>
  );
}

/** Lobby skeleton while the room is created (patterns.md loading: the final layout, not a spinner). */
export function LobbySkeleton({ label }: { label: string }) {
  return (
    <div className="flex min-h-[var(--lesson-viewport-h)] flex-col">
      <LoadingAnnouncement label={label} />
      <h1 className="sr-only">{t("lesson.live.lobbyTitle")}</h1>
      <div className="mx-auto grid w-full max-w-7xl flex-1 content-start gap-4 px-4 pt-4 pb-6 md:px-6 md:pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] lg:gap-5">
        <p className="text-sm leading-[1.6] font-medium text-fg-muted lg:col-span-2">{label}</p>
        <div aria-hidden="true" className="flex flex-col gap-4 lg:col-start-1">
          <div className="flex flex-col gap-4 rounded-(--radius-card) border border-clay-rim bg-surface p-5 sm:flex-row sm:items-center">
            <Skeleton className="aspect-[16/9] h-auto w-full rounded-(--radius-ctl) sm:aspect-[4/3] sm:w-52" />
            <div className="flex flex-1 flex-col gap-2.5">
              <Skeleton className="h-7 w-32 rounded-full" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
          <div className="rounded-(--radius-card) border border-clay-rim bg-surface p-5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-4 h-2.5 w-full rounded-full" />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Skeleton className="h-16 rounded-(--radius-ctl)" />
              <Skeleton className="h-16 rounded-(--radius-ctl)" />
              <Skeleton className="h-16 rounded-(--radius-ctl)" />
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="flex flex-col items-center gap-4 rounded-(--radius-card) border border-clay-rim bg-surface p-5 lg:col-start-2 lg:row-start-2">
          <Skeleton className="h-6 w-40 self-start" />
          <Skeleton className="size-[200px] rounded-(--radius-card)" />
          <Skeleton className="h-11 w-full rounded-(--radius-field)" />
        </div>
      </div>
    </div>
  );
}

/** Finishing the lesson: a calm status card while the room closes. */
export function LobbyFinishing({ label }: { label: string }) {
  return (
    <div className="flex min-h-[var(--lesson-viewport-h)] items-center justify-center p-4">
      <div role="status" className="flex max-w-sm flex-col items-center gap-3 rounded-(--radius-card) border border-clay-rim bg-surface px-8 py-8 text-center shadow-card">
        <IconTile icon={Check} tone="brand" size="xl" />
        <h1 className="inline-flex items-center gap-2 type-section text-fg">
          <Spinner className="text-brand-fg" />
          {label}
        </h1>
      </div>
    </div>
  );
}
