import { getCurrentUserAction } from "@/app/dashboard/actions";
import Link from "next/link";
import { AlertCircle, AlertTriangle, Clock, ChevronRight } from "lucide-react";
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

  return (
    <Link href="/dashboard/settings#verify" className="block group mb-6 lg:mb-8">
      <div
        className={`border rounded-xl p-4 flex items-center gap-3 shadow-sm transition-all ${
          isPending
            ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500/15"
            : isRejected
              ? "bg-destructive/10 border-destructive/20 text-destructive group-hover:bg-destructive/15"
              : "bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400 group-hover:bg-orange-500/15"
        }`}
      >
        <div
          className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center ${
            isPending
              ? "bg-amber-500/20"
              : isRejected
                ? "bg-destructive/20"
                : "bg-orange-500/20"
          }`}
        >
          {isPending ? (
            <Clock className="w-5 h-5" />
          ) : isRejected ? (
            <AlertCircle className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm sm:text-base flex items-center gap-1.5">
            {isPending
              ? t("verification.pendingTitle")
              : isRejected
                ? t("verification.rejectedTitle")
                : t("verification.requiredTitle")}
          </p>

          {isRejected && rejectedFields.length > 0 ? (
            <div className="mt-1 space-y-1">
              <p className="text-xs font-medium opacity-95">{t("verification.rejectionReason")}</p>
              {rejectedFields.map((item) => (
                <p key={item.field} className="text-xs opacity-90">
                  <span className="font-semibold">{item.label}:</span>{" "}
                  {item.comment || t("verification.defaultRejectComment")}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs opacity-85 mt-0.5">
              {isPending
                ? pendingFields.length > 0
                  ? `${t("verification.submittedPrefix")} ${pendingFields.join(", ")} ${t("verification.reviewingSuffix")}`
                  : t("verification.reviewingDocuments")
                : isRejected
                  ? t("verification.openSettingsToResubmit")
                  : missingFields.length > 0
                    ? `${t("verification.missingPrefix")} ${missingFields.join(", ")}`
                    : t("verification.notVerifiedWarning")}
            </p>
          )}
        </div>

        <ChevronRight className="w-5 h-5 shrink-0 text-muted-foreground group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
}
