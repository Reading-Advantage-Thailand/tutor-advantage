import { getCurrentUserAction } from "@/app/dashboard/actions";
import { AlertCircle, Clock, ShieldAlert } from "lucide-react";
import { Notice } from "@/components/app/Feedback";
import { t } from "@/lib/i18n";

type VerificationField = "idCard" | "bankBook" | "address";

type VerificationItem = {
  status?: string;
  comment?: string;
};

interface VerificationBannerProps {
  user?: {
    verificationStatus?: string;
    settings?: {
      verification?: Partial<Record<VerificationField, VerificationItem>>;
    };
  };
}

const verificationFieldLabels: Record<VerificationField, string> = {
  idCard: t("verification.idCard"),
  bankBook: t("verification.bankBook"),
  address: t("verification.address"),
};

const verificationFieldOrder: VerificationField[] = ["idCard", "bankBook", "address"];

export default async function VerificationBanner({
  user: explicitUser,
}: VerificationBannerProps) {
  const user = explicitUser || (await getCurrentUserAction());
  const vStatus = user?.verificationStatus;
  const verification = user?.settings?.verification || {};

  if (!vStatus || vStatus === "VERIFIED") {
    return null;
  }

  const rejectedFields = verificationFieldOrder
    .filter((field) => verification[field]?.status === "REJECTED")
    .map((field) => ({
      field,
      label: verificationFieldLabels[field],
      comment: verification[field]?.comment || "",
    }));

  const pendingFields = verificationFieldOrder
    .filter((field) => verification[field]?.status === "PENDING")
    .map((field) => verificationFieldLabels[field]);

  const missingFields = verificationFieldOrder
    .filter(
      (field) =>
        !verification[field]?.status || verification[field]?.status === "UNVERIFIED",
    )
    .map((field) => verificationFieldLabels[field]);

  const isPending = vStatus === "PENDING";
  const isRejected = vStatus === "REJECTED";

  const title = isPending
    ? t("verification.pendingTitle")
    : isRejected
      ? t("verification.rejectedTitle")
      : t("verification.requiredTitle");

  return (
    <Notice
      href="/dashboard/settings#verify"
      tone={isPending ? "info" : isRejected ? "danger" : "warning"}
      icon={isPending ? Clock : isRejected ? AlertCircle : ShieldAlert}
      title={title}
    >
      {isRejected && rejectedFields.length > 0 ? (
        <span className="flex flex-col gap-0.5">
          <span>{t("verification.rejectionReason")}</span>
          {rejectedFields.map((item) => (
            <span key={item.field}>
              <span className="font-semibold">{item.label}:</span>{" "}
              {item.comment || t("verification.defaultRejectComment")}
            </span>
          ))}
        </span>
      ) : isPending ? (
        pendingFields.length > 0 ? (
          `${t("verification.submittedPrefix")} ${pendingFields.join(", ")} ${t("verification.reviewingSuffix")}`
        ) : (
          t("verification.reviewingDocuments")
        )
      ) : isRejected ? (
        t("verification.openSettingsToResubmit")
      ) : missingFields.length > 0 ? (
        `${t("verification.missingPrefix")} ${missingFields.join(", ")}`
      ) : (
        t("verification.notVerifiedWarning")
      )}
    </Notice>
  );
}
