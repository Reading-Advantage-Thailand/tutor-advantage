"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { QrCode, ScanLine, School, SearchX } from "lucide-react";
import { toast } from "sonner";
import {
  EmptyState,
  ErrorState,
  FilterChip,
  HScroll,
  IconButton,
  IconTile,
  ListGroup,
  ListRow,
  LoadingAnnouncement,
  PageHeader,
  Screen,
  SearchField,
} from "@/components/mobile";
import { useLiff } from "@/components/providers/LiffProvider";
import { Button } from "@/components/ui/button";
import { studentApi } from "@/lib/api";
import { prefetchResource, useCachedResource } from "@/lib/cachedResource";
import { CEFR_FILTER_LEVELS, cefrFilterChipId } from "@/lib/cefr";
import { classDetailResourceKey, classifyClassLoadError } from "@/lib/classAccess";
import { t } from "@/lib/i18n";
import { buildEnrollPathFromInviteText } from "@/lib/paymentFlow";
import { cn } from "@/lib/utils";
import { ClassCard } from "./_components/ClassCard";
import { ClassListSkeleton } from "./_components/ClassesSkeletons";
import { InviteSheet } from "./_components/InviteSheet";
import { LiffStartupError } from "./_components/LiffStartupError";
import {
  classesResourceKey,
  isClassFilterActive,
  resolveSearchQuery,
  searchDebounceDelay,
  type ClassListResponse,
} from "./_components/classesList";
import { useDebouncedValue } from "./_components/useDebouncedValue";

export default function ClassesPage() {
  const router = useRouter();
  const { liff, isReady, error: liffError, profile } = useLiff();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Only typing is debounced; an emptied search box and chip taps fetch at once.
  const debouncedQuery = useDebouncedValue(searchQuery, searchDebounceDelay(searchQuery));
  const query = resolveSearchQuery(searchQuery, debouncedQuery);

  const { data, error, isLoading, isValidating, isPreviousData, refetch } = useCachedResource<ClassListResponse>(
    profile ? classesResourceKey(profile.userId, query, activeFilter) : null,
    () =>
      studentApi.getAvailableClasses({
        q: query || undefined,
        cefr: activeFilter ?? undefined,
      }),
    { enabled: isReady, keepPreviousData: true },
  );

  const goToEnroll = (enrollPath: string) => {
    setInviteOpen(false);
    // buildEnrollPathFromInviteText always returns a relative "/enroll?…" path.
    router.push(enrollPath);
  };

  const handleScanQr = async () => {
    if (!isReady || !liff) return;

    try {
      if (liffError) {
        toast.error(t("classes.liffNotReady"));
        return;
      }

      if (!liff.isInClient()) {
        toast.info(t("classes.qrLineOnly"));
        return;
      }

      let scannedText = "";

      if (liff.scanCodeV2) {
        const result = await liff.scanCodeV2();
        scannedText = result.value || "";
      } else if ("scanCode" in liff) {
        const result = await (liff as { scanCode: () => Promise<{ value: string }> }).scanCode();
        scannedText = result.value || "";
      } else {
        toast.warning(t("classes.qrUnsupported"));
        return;
      }

      if (scannedText) {
        const enrollPath = buildEnrollPathFromInviteText(scannedText);
        if (enrollPath) {
          goToEnroll(enrollPath);
        } else {
          toast.error(t("classes.qrInvalid"));
        }
      }
    } catch {
      toast.error(t("classes.qrScanError"));
    }
  };

  /** Warm the detail screen's cache on touch-down (same key + request as /classes/[id]). */
  const prefetchClass = (classId: string) => {
    if (!profile) return;
    void prefetchResource(classDetailResourceKey(profile.userId, classId), () => studentApi.getClassDetails(classId));
  };

  const clearFilters = () => {
    setSearchQuery("");
    setActiveFilter(null);
  };

  const classes = data?.classes ?? [];
  const filtered = isClassFilterActive(searchQuery, activeFilter);

  let content: ReactNode;
  if (!isReady || isLoading || (isPreviousData && classes.length === 0)) {
    content = <ClassListSkeleton />;
  } else if (liffError || !profile) {
    content = <LiffStartupError />;
  } else if (error && (!data || isPreviousData)) {
    content = (
      <ErrorState
        title={t("classes.loadErrorTitle")}
        kind={classifyClassLoadError(error) === "offline" ? "offline" : "error"}
        onRetry={() => void refetch()}
        retrying={isValidating}
      />
    );
  } else if (classes.length === 0) {
    content = filtered ? (
      <EmptyState
        icon={SearchX}
        tone="neutral"
        title={t("classes.emptySearchTitle")}
        description={t("classes.emptySearchDescription")}
        action={
          <Button variant="brandSoft" size="touch" onClick={clearFilters}>
            {t("classes.clearFilters")}
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={School}
        title={t("classes.emptyOpenTitle")}
        description={t("classes.emptyOpenDescription")}
        action={
          <Button variant="brand" size="touch" onClick={() => setInviteOpen(true)}>
            <QrCode aria-hidden="true" />
            {t("classes.invite.openAction")}
          </Button>
        }
      />
    );
  } else {
    content = (
      <div
        aria-busy={isPreviousData || undefined}
        className={cn("grid gap-3 transition-opacity duration-200 sm:grid-cols-2", isPreviousData && "opacity-50")}
      >
        {isPreviousData ? <LoadingAnnouncement label={t("classes.updating")} /> : null}
        {classes.map((cls) => (
          <ClassCard key={cls.id} cls={cls} onPressStart={prefetchClass} />
        ))}
      </div>
    );
  }

  return (
    <Screen>
      <PageHeader
        title={t("classes.title")}
        subtitle={t("classes.subtitle")}
        actions={
          <IconButton icon={ScanLine} label={t("classes.scanQrTitle")} variant="tonal" onClick={handleScanQr} />
        }
      >
        <SearchField
          id="input-search-classes"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("classes.searchPlaceholder")}
        />
        <HScroll aria-label={t("classes.filterAria")} className="mt-3">
          {[null, ...CEFR_FILTER_LEVELS].map((level) => (
            <span key={level ?? "all"} id={cefrFilterChipId(level, t("classes.allFilter"))} className="inline-flex shrink-0">
              <FilterChip selected={activeFilter === level} onClick={() => setActiveFilter(level)}>
                {level ?? t("classes.allFilter")}
              </FilterChip>
            </span>
          ))}
        </HScroll>
      </PageHeader>

      <div className="flex flex-col gap-4 px-4 pb-6">
        <ListGroup>
          <ListRow
            onClick={() => setInviteOpen(true)}
            leading={<IconTile icon={QrCode} tone="brand" />}
            title={t("classes.invite.rowTitle")}
            subtitle={t("classes.invite.rowSubtitle")}
            chevron
          />
        </ListGroup>
        {content}
      </div>

      <InviteSheet open={inviteOpen} onOpenChange={setInviteOpen} onScan={handleScanQr} onNavigate={goToEnroll} />
    </Screen>
  );
}
