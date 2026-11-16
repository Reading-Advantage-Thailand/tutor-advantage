"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { CheckCircle2, FileImage, FileSearch, Landmark, Pencil, ShieldCheck, Wallet, XCircle } from "lucide-react";
import {
  AdminStatusChip,
  Card,
  Chip,
  ConfirmDialog,
  DescriptionList,
  IconTile,
  Notice,
  Sheet,
  TextField,
  useHasRole,
} from "@/components/app";
import { toast } from "@/components/app/toastStore";
import { useRefreshAdminSummary } from "@/components/app/adminSummaryContext";
import { Button } from "@/components/ui/button";
import { api, newIdempotencyKey } from "@/lib/api";
import { formatThaiDateTime, PLACEHOLDER } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusLabel, statusMeta } from "@/lib/status";
import { keepThaiWords, thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import {
  BANK_LABELS,
  FIELD_ICONS,
  displayName,
  fieldLabel,
  fieldStatusTone,
  invalidateUser,
  isPassportHolder,
  pendingFields,
  useUserDetail,
  visibleFields,
  type UserDetailV2,
  type VerificationField,
} from "../model";
import { expiryWarningLines, type ExpiryMessages } from "../../documentExpiry";
import "@/locales/th/userDetail";
import "@/locales/th/userHeader";

const DocumentViewer = dynamic(() => import("../components/DocumentViewer").then((m) => m.DocumentViewer), { ssr: false });

type DialogState =
  | { mode: "approveAll"; fields: VerificationField[] }
  | { mode: "approve"; field: VerificationField }
  | { mode: "reject"; field: VerificationField }
  | null;

function hidden(user: UserDetailV2, value: string | null | undefined, has?: boolean): ReactNode {
  if (value) return value;
  if (user.piiMasked && has) return <span className="text-fg-muted">{t("userDetail.hiddenValue")}</span>;
  return <span className="text-fg-muted">{t("userDetail.notProvided")}</span>;
}

/** "United Kingdom (GB)" from an ISO code; falls back to the code. */
function countryName(code: string | null | undefined): string {
  if (!code) return PLACEHOLDER;
  try {
    const name = new Intl.DisplayNames(["th"], { type: "region" }).of(code);
    return name && name !== code ? `${name} (${code})` : code;
  } catch {
    return code;
  }
}

function expiryValue(date: string | null | undefined, expired: boolean | undefined): ReactNode {
  if (!date) return <span className="text-fg-muted">{t("userDetail.notProvided")}</span>;
  return (
    <span className={expired ? "font-semibold text-danger-fg" : "tabular"}>
      {date}
      {expired ? ` · ${t("userDetail.documentExpired")}` : ""}
    </span>
  );
}

/** The submitted data for one field, as label/value pairs. */
function fieldData(user: UserDetailV2, field: VerificationField) {
  const s = user.settings;
  const identity = user.identity;
  switch (field) {
    case "idCard":
      return [];
    case "bankBook":
      return [
        { label: t("userDetail.bankBrand"), value: s.bankBrand ? (BANK_LABELS[s.bankBrand] ?? s.bankBrand) : hidden(user, null) },
        { label: t("userDetail.bankAccountNumber"), value: <span className="tabular">{hidden(user, s.bankAccountNumber)}</span> },
        // Payout account name must match the name on the ID document.
        { label: t("userDetail.bankNameMustMatch"), value: hidden(user, s.taxName), wide: true },
      ];
    case "address":
      return [{ label: t("userHeader.deliveryAddress"), value: hidden(user, s.address, s.hasAddress), wide: true }];
    case "taxInfo":
      if (identity && isPassportHolder(user)) {
        return [
          { label: t("userDetail.idType"), value: t("userDetail.idTypePassport") },
          { label: t("userDetail.passportName"), value: hidden(user, s.taxName) },
          { label: t("userDetail.passportNumber"), value: <span className="tabular">{identity.passportNumberMasked ?? PLACEHOLDER}</span> },
          { label: t("userDetail.passportNationality"), value: countryName(identity.passportNationality) },
          { label: t("userDetail.passportExpiresOn"), value: expiryValue(identity.passportExpiresOn, identity.passportExpired) },
          {
            label: t("userDetail.teachingLocation"),
            value:
              identity.teachingLocation === "THAILAND"
                ? t("userDetail.teachingFromThailand")
                : identity.teachingLocation === "ABROAD"
                  ? t("userDetail.teachingFromAbroad")
                  : PLACEHOLDER,
          },
          {
            label: t("userDetail.rightToWork"),
            value: identity.rightToWorkConfirmedAt
              ? t("userDetail.rightToWorkAt", { date: formatThaiDateTime(identity.rightToWorkConfirmedAt) })
              : PLACEHOLDER,
          },
        ];
      }
      return [
        { label: t("userDetail.taxName"), value: hidden(user, s.taxName) },
        { label: t("userDetail.nationalId"), value: <span className="tabular">{hidden(user, s.nationalId, s.hasNationalId)}</span> },
      ];
    case "workPermit":
      return [
        { label: t("userDetail.workPermitExpiresOn"), value: expiryValue(identity?.workPermitExpiresOn, identity?.workPermitExpired) },
      ];
  }
}

function documentFor(user: UserDetailV2, field: VerificationField) {
  if (field === "idCard") return { url: user.idCardImageUrl, has: user.hasIdCardImage };
  if (field === "bankBook") return { url: user.bankBookImageUrl, has: user.hasBankBookImage };
  if (field === "workPermit") return { url: user.identity?.workPermitImageUrl ?? null, has: Boolean(user.identity?.hasWorkPermitImage) };
  return null;
}

const EXPIRY_MESSAGES: ExpiryMessages = {
  passport: t("userDetail.expiryDocPassport"),
  workPermit: t("userDetail.expiryDocWorkPermit"),
  inDays: t("userDetail.expiryWarningInDays"),
  today: t("userDetail.expiryWarningToday"),
  expired: t("userDetail.expiryWarningExpired"),
};

function payoutBlockText(block: NonNullable<UserDetailV2["identity"]>["payoutBlock"] | undefined) {
  if (block === "PASSPORT_EXPIRED") return t("userDetail.payoutBlockedPassportExpired");
  if (block === "WORK_PERMIT_EXPIRED") return t("userDetail.payoutBlockedWorkPermitExpired");
  if (block === "WORK_PERMIT_MISSING") return t("userDetail.payoutBlockedWorkPermitMissing");
  return null;
}

/**
 * A payout-setting card for the rail: icon + title + current value, then its
 * one action underneath (the rail is too narrow for a button beside the title).
 */
function SettingCard({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card padding="md" className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <h2 className="text-[0.9375rem] leading-[1.45] font-semibold text-fg">{title}</h2>
          {description ? <p className="mt-0.5 text-[0.8125rem] leading-[1.6] text-fg-muted">{thaiCopy(description)}</p> : null}
        </div>
      </div>
      {children}
      {action ? <div className="flex min-w-0 pl-11">{action}</div> : null}
    </Card>
  );
}

/** ADMIN sets resident (3%, 50 ทวิ) or non-resident (15%, PND.54). */
function TaxResidencyCard({ user, adminId, canEdit }: { user: UserDetailV2; adminId: string; canEdit: boolean }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const current = user.identity?.taxResidency ?? "RESIDENT";
  const next = current === "RESIDENT" ? "NON_RESIDENT" : "RESIDENT";
  const label = (value: string) =>
    value === "NON_RESIDENT" ? t("userDetail.taxResidencyNonResident") : t("userDetail.taxResidencyResident");

  return (
    <SettingCard
      icon={<IconTile icon={Landmark} tone="neutral" size="sm" />}
      title={t("userDetail.taxResidencyTitle")}
      description={label(current)}
      action={
        canEdit ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIdempotencyKey(newIdempotencyKey());
              setConfirmOpen(true);
            }}
          >
            <Pencil aria-hidden="true" />{" "}
            {next === "NON_RESIDENT" ? t("userDetail.taxResidencySetNonResident") : t("userDetail.taxResidencySetResident")}
          </Button>
        ) : null
      }
    >
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("userDetail.taxResidencyConfirmTitle", { name: displayName(user) })}
        description={t("userDetail.taxResidencyConfirmBody")}
        confirmLabel={next === "NON_RESIDENT" ? t("userDetail.taxResidencySetNonResident") : t("userDetail.taxResidencySetResident")}
        tone="danger"
        reason={{ label: t("userDetail.reasonLabel"), minLength: 3 }}
        details={
          <DescriptionList
            items={[
              { label: t("userDetail.taxResidencyFrom"), value: thaiCopy(label(current)) },
              { label: t("userDetail.taxResidencyTo"), value: thaiCopy(label(next)) },
            ]}
          />
        }
        onConfirm={async ({ reason }) => {
          await api.patch(`/v1/users/${user.id}/tax-residency`, { taxResidency: next, reason }, { idempotencyKey });
          toast.success(t("userDetail.taxResidencySaved"));
          invalidateUser(adminId, user.id);
        }}
      />
    </SettingCard>
  );
}

/** ADMIN exempts an established tutor from the new-tutor card limit. */
function CardPaymentsTrustCard({ user, adminId }: { user: UserDetailV2; adminId: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const trusted = user.settings.cardPaymentsTrusted === true;
  const label = (value: boolean) => (value ? t("userDetail.cardTrustOn") : t("userDetail.cardTrustOff"));
  const actionLabel = trusted ? t("userDetail.cardTrustDisable") : t("userDetail.cardTrustEnable");

  return (
    <SettingCard
      icon={<IconTile icon={ShieldCheck} tone={trusted ? "brand" : "neutral"} size="sm" />}
      title={t("userDetail.cardTrustTitle")}
      description={label(trusted)}
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setIdempotencyKey(newIdempotencyKey());
            setConfirmOpen(true);
          }}
        >
          <Pencil aria-hidden="true" /> {actionLabel}
        </Button>
      }
    >
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("userDetail.cardTrustConfirmTitle", { name: displayName(user) })}
        description={t("userDetail.cardTrustConfirmBody")}
        confirmLabel={actionLabel}
        tone={trusted ? "brand" : "danger"}
        reason={{ label: t("userDetail.reasonLabel"), minLength: 3 }}
        details={
          <DescriptionList
            items={[
              { label: t("userDetail.cardTrustFrom"), value: thaiCopy(label(trusted)) },
              { label: t("userDetail.cardTrustTo"), value: thaiCopy(label(!trusted)) },
            ]}
          />
        }
        onConfirm={async ({ reason }) => {
          await api.patch(`/v1/users/${user.id}/card-payments-trust`, { trusted: !trusted, reason }, { idempotencyKey });
          toast.success(t("userDetail.cardTrustSaved"));
          invalidateUser(adminId, user.id);
        }}
      />
    </SettingCard>
  );
}

function FieldCard({
  user,
  field,
  canReview,
  onView,
  onApprove,
  onReject,
}: {
  user: UserDetailV2;
  field: VerificationField;
  canReview: boolean;
  onView: (url: string, title: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const item = user.settings.verification?.[field];
  const status = item?.status ?? "UNVERIFIED";
  const Icon = FIELD_ICONS[field];
  const doc = documentFor(user, field);
  const data = fieldData(user, field);
  const isPending = status === "PENDING";
  const titleId = `verify-${field}-title`;

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        // A size container: the submitted data goes two-up only when the card itself is wide.
        "card @container/card flex min-w-0 flex-col overflow-hidden",
        // Waiting for review: warning rim + a 3px leading edge (the chip carries the word).
        isPending && "border-warning-border shadow-[inset_3px_0_0_var(--warning-solid),var(--shadow-card)]",
      )}
    >
      <div className="flex items-start gap-3 px-4 pt-4">
        <IconTile icon={Icon} tone={fieldStatusTone(status)} size="sm" />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-[0.9375rem] leading-[1.45] font-semibold text-fg">
            {keepThaiWords(fieldLabel(field, user))}
          </h2>
          {status === "UNVERIFIED" ? (
            <p className="text-[0.8125rem] leading-[1.6] text-fg-muted">{thaiCopy(t("userDetail.fieldNotSubmitted"))}</p>
          ) : item?.updatedAt ? (
            <p className="text-[0.8125rem] leading-[1.6] text-fg-muted tabular">
              {t("userDetail.fieldSubmittedAt", { date: formatThaiDateTime(item.updatedAt) })}
            </p>
          ) : null}
        </div>
        <AdminStatusChip domain="verification" status={status} />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {doc ? (
          doc.url ? (
            <button
              type="button"
              onClick={() => onView(doc.url!, fieldLabel(field, user))}
              aria-label={`${t("userDetail.viewDocument")}: ${fieldLabel(field, user)}`}
              className="group relative flex h-44 w-full items-center justify-center overflow-hidden rounded-lg border border-hairline bg-surface-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary document URL */}
              <img src={doc.url} alt="" loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
              <span className="absolute right-2 bottom-2 inline-flex items-center gap-1.5 rounded-(--radius-ctl) border border-clay-rim bg-surface px-2.5 py-1 text-[0.8125rem] font-medium text-fg shadow-card group-hover:bg-row-hover">
                <FileImage aria-hidden="true" className="size-4" /> {t("userDetail.viewDocument")}
              </span>
            </button>
          ) : (
            <p className="flex h-16 items-center justify-center gap-2 rounded-lg bg-surface-muted px-3 text-center text-[0.8125rem] text-fg-muted">
              <FileImage aria-hidden="true" className="size-4 shrink-0" />
              {doc.has ? t("userDetail.documentHidden") : t("userDetail.documentMissing")}
            </p>
          )
        ) : null}

        {/*
          Two cards share a row at 1024 and 1440 (about 350px each): there a two-column list
          splits Thai labels and dates mid-phrase, so it stays one column below a 32rem card.
        */}
        {data.length ? <DescriptionList items={data} columns={1} className="@lg/card:grid-cols-2" /> : null}

        {status === "REJECTED" && item?.comment ? (
          <Notice tone="danger" title={t("userDetail.fieldRejectReason")}>
            {item.comment}
          </Notice>
        ) : null}
        {item?.reviewedAt ? (
          <p className="mt-auto inline-flex items-center gap-1.5 text-[0.8125rem] text-fg-muted tabular">
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
            {t("userDetail.fieldReviewedAt", { date: formatThaiDateTime(item.reviewedAt) })}
          </p>
        ) : null}
      </div>

      {canReview && isPending ? (
        <div className="flex gap-2 border-t border-hairline px-4 py-3 sm:justify-end">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={onReject}>
            <XCircle aria-hidden="true" /> {t("userDetail.rejectAction")}
          </Button>
          <Button variant="soft" size="sm" className="flex-1 sm:flex-none" onClick={onApprove}>
            <CheckCircle2 aria-hidden="true" /> {t("userDetail.approveAction")}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function OmiseRecipientCard({ user, adminId }: { user: UserDetailV2; adminId: string }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const current = user.settings.omiseRecipientId;

  const review = () => {
    const trimmed = value.trim();
    if (trimmed && !/^recp_[A-Za-z0-9_]+$/.test(trimmed)) {
      setError(t("userDetail.omiseInvalid"));
      return;
    }
    setIdempotencyKey(newIdempotencyKey());
    setSheetOpen(false);
    setConfirmOpen(true);
  };

  return (
    <SettingCard
      icon={<IconTile icon={Wallet} tone={current ? "brand" : "neutral"} size="sm" />}
      title={t("userDetail.omiseTitle")}
      description={current ? undefined : t("userDetail.omiseNone")}
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setValue(current ?? "");
            setError(null);
            setSheetOpen(true);
          }}
        >
          <Pencil aria-hidden="true" /> {t("userDetail.omiseEdit")}
        </Button>
      }
    >
      {current ? (
        <p className="ml-11 rounded-lg bg-surface-muted px-3 py-2 font-mono text-[0.8125rem] break-all text-fg">{current}</p>
      ) : null}

      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={t("userDetail.omiseEdit")}
        description={t("userDetail.omiseSheetDescription")}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              {t("shell.cancel")}
            </Button>
            <Button onClick={review}>{t("userDetail.reviewAndConfirm")}</Button>
          </div>
        }
      >
        <TextField
          label={t("userDetail.omiseLabel")}
          hint={t("userDetail.omiseHintClear")}
          error={error ?? undefined}
          value={value}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
        />
      </Sheet>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("userDetail.omiseConfirmTitle", { name: displayName(user) })}
        description={t("userDetail.omiseSheetDescription")}
        confirmLabel={t("userDetail.omiseConfirm")}
        tone="danger"
        reason={{ label: t("userDetail.reasonLabel") }}
        details={
          <DescriptionList
            items={[
              { label: t("userDetail.omiseFrom"), value: current ?? PLACEHOLDER },
              { label: t("userDetail.omiseTo"), value: value.trim() || PLACEHOLDER },
            ]}
          />
        }
        onConfirm={async ({ reason }) => {
          await api.patch(`/v1/users/${user.id}/omise-recipient`, { omiseRecipientId: value.trim(), reason }, { idempotencyKey });
          toast.success(t("userDetail.omiseSaved"));
          invalidateUser(adminId, user.id);
        }}
      />
    </SettingCard>
  );
}

export default function UserVerificationTab() {
  const { data: user, me } = useUserDetail();
  const isAdmin = useHasRole("ADMIN");
  const refreshSummary = useRefreshAdminSummary();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [viewer, setViewer] = useState<{ url: string; title: string } | null>(null);

  if (!user || !me) return null;
  if (user.role !== "TUTOR") {
    return <Notice tone="neutral">{t("userDetail.verificationNotApplicable")}</Notice>;
  }

  const pending = pendingFields(user);
  const anonymized = user.accountStatus === "ANONYMIZED";
  const canReview = isAdmin && !anonymized;
  const name = displayName(user);
  const fields = visibleFields(user);
  // Fields waiting for review first: they are what the reviewer came for.
  const reviewOrder = [...fields].sort(
    (a, b) =>
      Number(user.settings.verification?.[b]?.status === "PENDING") - Number(user.settings.verification?.[a]?.status === "PENDING"),
  );

  const openDialog = (next: DialogState) => {
    setIdempotencyKey(newIdempotencyKey());
    setDialog(next);
  };

  const submit = async (body: Record<string, unknown>, successMessage: string) => {
    await api.post(`/v1/users/${user.id}/verify`, body, { idempotencyKey });
    toast.success(successMessage);
    invalidateUser(me.userId, user.id);
    refreshSummary();
  };

  const bankBookIn = (fields: VerificationField[]) => fields.includes("bankBook") && !user.settings.omiseRecipientId;
  const blockText = payoutBlockText(user.identity?.payoutBlock);
  const expiryLines = expiryWarningLines(user.identity?.expiryWarnings, EXPIRY_MESSAGES);

  return (
    <>
      {blockText ? (
        <Notice tone="danger" role="alert">
          {blockText}
        </Notice>
      ) : null}
      {expiryLines.length ? (
        <Notice tone="warning" title={t("userDetail.expiryWarningTitle")}>
          <ul className="flex flex-col gap-0.5">
            {expiryLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-1">{t("userDetail.expiryWarningBody")}</p>
        </Notice>
      ) : null}
      {/* Review summary: overall status, how many fields sit in each state, and the page's one primary action. */}
      <div
        className={cn(
          "card flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-5",
          pending.length > 0 && "border-warning-border shadow-[inset_3px_0_0_var(--warning-solid),var(--shadow-card)]",
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <IconTile icon={pending.length ? FileSearch : ShieldCheck} tone={pending.length ? "amber" : fieldStatusTone(user.verificationStatus)} size="md" />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.9375rem] leading-[1.45] font-semibold text-fg">
              {t("userDetail.verificationOverall")}: <AdminStatusChip domain="verification" status={user.verificationStatus} size="md" />
            </p>
            <p className="mt-1 text-[0.8125rem] leading-[1.6] text-pretty text-fg-muted">
              {thaiCopy(isAdmin ? t("userDetail.verificationIntro") : t("userDetail.readOnlyChecker"))}
            </p>
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {(["PENDING", "REJECTED", "UNVERIFIED", "VERIFIED"] as const).map((state) => {
                const count = fields.filter((field) => (user.settings.verification?.[field]?.status ?? "UNVERIFIED") === state).length;
                if (!count) return null;
                const meta = statusMeta("verification", state);
                return (
                  <li key={state}>
                    <Chip tone={meta.tone}>
                      {statusLabel("verification", state)} <span className="font-semibold tabular">{count}</span>
                    </Chip>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        {canReview && pending.length > 0 ? (
          <Button className="w-full shrink-0 md:w-auto" onClick={() => openDialog({ mode: "approveAll", fields: pending })}>
            <CheckCircle2 aria-hidden="true" /> {t("userDetail.approveSubmitted", { count: pending.length })}
          </Button>
        ) : null}
      </div>

      {/* Two columns from 1280: the documents, then the payout settings rail (patterns.md A3). */}
      <div className={cn("grid grid-cols-1 items-start gap-5", !anonymized && "xl:grid-cols-[minmax(0,1fr)_22rem]")}>
        <div className="@container min-w-0">
          <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
            {reviewOrder.map((field) => (
              <FieldCard
                key={field}
                user={user}
                field={field}
                canReview={canReview}
                onView={(url, title) => setViewer({ url, title })}
                onApprove={() => openDialog({ mode: "approve", field })}
                onReject={() => openDialog({ mode: "reject", field })}
              />
            ))}
          </div>
        </div>

        {!anonymized ? (
          <div className="flex min-w-0 flex-col gap-4">
            <TaxResidencyCard user={user} adminId={me.userId} canEdit={isAdmin} />
            {isAdmin ? <OmiseRecipientCard user={user} adminId={me.userId} /> : null}
            {isAdmin ? <CardPaymentsTrustCard user={user} adminId={me.userId} /> : null}
          </div>
        ) : null}
      </div>

      <DocumentViewer open={viewer !== null} onOpenChange={(open) => !open && setViewer(null)} title={viewer?.title ?? ""} url={viewer?.url ?? null} />

      <ConfirmDialog
        open={dialog?.mode === "approveAll"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t("userDetail.approveSubmittedTitle", { count: dialog?.mode === "approveAll" ? dialog.fields.length : 0 })}
        description={t("userDetail.approveSubmittedBody")}
        confirmLabel={t("userDetail.approveSubmitted", { count: dialog?.mode === "approveAll" ? dialog.fields.length : 0 })}
        details={
          dialog?.mode === "approveAll" ? (
            <div className="flex flex-col gap-2">
              <ul className="flex flex-col gap-1 text-sm text-fg">
                {dialog.fields.map((field) => (
                  <li key={field} className="flex items-center gap-2">
                    <CheckCircle2 aria-hidden="true" className="size-4 text-success-fg" /> {fieldLabel(field, user)}
                  </li>
                ))}
              </ul>
              {bankBookIn(dialog.fields) ? <p className="text-[0.8125rem] text-fg-muted">{t("userDetail.omiseWillCreate")}</p> : null}
            </div>
          ) : null
        }
        onConfirm={() =>
          dialog?.mode === "approveAll"
            ? submit(
                { status: "VERIFIED", field: "ALL", fields: dialog.fields },
                t("userDetail.approvedToast", { count: dialog.fields.length }),
              )
            : undefined
        }
      />

      <ConfirmDialog
        open={dialog?.mode === "approve"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog?.mode === "approve" ? t("userDetail.approveFieldTitle", { field: fieldLabel(dialog.field, user) }) : ""}
        description={t("userDetail.approveFieldBody", { name })}
        confirmLabel={t("userDetail.approveAction")}
        details={
          dialog?.mode === "approve" && bankBookIn([dialog.field]) ? (
            <p className="text-[0.8125rem] text-fg-muted">{t("userDetail.omiseWillCreate")}</p>
          ) : undefined
        }
        onConfirm={() =>
          dialog?.mode === "approve"
            ? submit({ status: "VERIFIED", field: dialog.field }, t("userDetail.approvedToast", { count: 1 }))
            : undefined
        }
      />

      <ConfirmDialog
        open={dialog?.mode === "reject"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog?.mode === "reject" ? t("userDetail.rejectFieldTitle", { field: fieldLabel(dialog.field, user) }) : ""}
        description={t("userDetail.rejectFieldBody")}
        confirmLabel={t("userDetail.rejectAction")}
        tone="danger"
        reason={{ label: t("userDetail.rejectReasonLabel"), placeholder: t("userDetail.rejectReasonPlaceholder"), minLength: 5 }}
        onConfirm={({ reason }) =>
          dialog?.mode === "reject"
            ? submit(
                { status: "REJECTED", field: dialog.field, fieldComments: { [dialog.field]: reason } },
                t("userDetail.rejectedToast"),
              )
            : undefined
        }
      />
    </>
  );
}
