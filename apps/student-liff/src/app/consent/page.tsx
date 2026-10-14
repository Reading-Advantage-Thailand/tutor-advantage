"use client";

import { FileText, Shield, ShieldCheck, Users } from "lucide-react";
import { AppBar, Chip, ErrorState, IconTile, ListGroup, ListRow, Notice, Screen, type ChipTone } from "@/components/mobile";
import { useLiff } from "@/components/providers/LiffProvider";
import { studentApi } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { ConsentSkeleton } from "./_components/ConsentSkeleton";
import {
  buildConsentSummary,
  type ConsentSummary,
  type GuardianConsentResponse,
  type MeResponse,
} from "./_components/consentSummary";

/** GET /v1/users/me + GET /v1/guardian/consent, reduced to what this screen shows. */
async function fetchConsentSummary(): Promise<ConsentSummary> {
  const [me, guardian] = await Promise.all([
    studentApi.getCurrentUser() as Promise<MeResponse>,
    studentApi.checkGuardianConsent() as Promise<GuardianConsentResponse>,
  ]);
  return buildConsentSummary(me, guardian);
}

/** "My consents": the student's real PDPA consent records and the legal documents. */
export default function ConsentPage() {
  const { isReady, profile, error: liffError, errorCode, retry } = useLiff();
  const { data, error, isLoading, isValidating, refetch } = useCachedResource(
    profile ? `${profile.userId}:consents` : null,
    fetchConsentSummary,
    // Always revalidate on open: coming back from /guardian right after giving
    // consent must not show the cached "ยังไม่มี" (the guardian page only updates its own key).
    { enabled: isReady, staleTime: 0 },
  );

  if (!isReady || isLoading) return <ConsentSkeleton />;

  let body: React.ReactNode;
  if (liffError || !profile) {
    body = <ErrorState kind={errorCode === "network" ? "offline" : "error"} onRetry={retry} />;
  } else if (error && !data) {
    body = <ErrorState onRetry={() => void refetch()} retrying={isValidating} />;
  } else if (data) {
    body = <ConsentDetails summary={data} />;
  }

  return (
    <Screen>
      <AppBar title={t("legal.consentTitle")} back fallbackHref="/profile" />
      {body}
    </Screen>
  );
}

function ConsentDetails({ summary }: { summary: ConsentSummary }) {
  const { terms, guardian } = summary;

  const termsStatus: StatusLineProps = terms.accepted
    ? {
        tone: "success",
        chip: t("legal.chipGranted"),
        detail: terms.acceptedAt
          ? `${t("legal.consentAcceptedOn")} ${formatThaiDate(terms.acceptedAt, "long")}`
          : null,
      }
    : { tone: "neutral", chip: t("legal.chipMissing"), detail: t("legal.consentNotAccepted") };

  const guardianStatus: Record<ConsentSummary["guardian"], StatusLineProps> = {
    granted: { tone: "success", chip: t("legal.chipGranted"), detail: null },
    required: { tone: "warning", chip: t("legal.chipMissing"), detail: t("legal.consentGuardianRequired") },
    notNeeded: { tone: "neutral", chip: t("legal.chipNotNeeded"), detail: t("legal.consentGuardianNotNeeded") },
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-2 pb-[calc(24px+var(--safe-bottom))]">
      <p className="text-sm leading-[1.6] text-fg-muted">{t("legal.consentSubtitle")}</p>

      <ListGroup header={t("legal.consentStatusHeader")}>
        <ListRow
          leading={<IconTile icon={ShieldCheck} tone={terms.accepted ? "brand" : "neutral"} />}
          title={t("legal.consentTermsTitle")}
          subtitle={<StatusLine {...termsStatus} />}
        />
        <ListRow
          leading={
            <IconTile
              icon={Users}
              tone={guardian === "granted" ? "brand" : guardian === "required" ? "amber" : "neutral"}
            />
          }
          title={t("legal.consentGuardianTitle")}
          subtitle={<StatusLine {...guardianStatus[guardian]} />}
          // Missing guardian consent → the guardian form.
          href={guardian === "required" ? "/guardian" : undefined}
        />
      </ListGroup>

      <Notice tone="warning" title={t("legal.revokeTitle")} description={t("legal.revokeDescription")} />

      <ListGroup header={t("legal.documentsHeader")}>
        <ListRow href="/privacy" leading={<IconTile icon={Shield} tone="brand" />} title={t("app.privacyPolicy")} />
        <ListRow href="/terms" leading={<IconTile icon={FileText} tone="blue" />} title={t("app.terms")} />
      </ListGroup>
    </div>
  );
}

interface StatusLineProps {
  tone: ChipTone;
  chip: string;
  detail: string | null;
}

/** Status chip + optional detail, used as a ListRow subtitle. */
function StatusLine({ tone, chip, detail }: StatusLineProps) {
  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
      <Chip tone={tone}>{chip}</Chip>
      {detail ? <span>{detail}</span> : null}
    </span>
  );
}
