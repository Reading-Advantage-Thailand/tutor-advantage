import type { NoticeTone } from "@/components/app/Feedback";
import { t } from "@/lib/i18n";

export type LoginErrorNotice = { tone: NoticeTone; message: string };

/**
 * `/?error=` code for a rejected identity-service callback. Identity refuses
 * an unverified Google email that would claim an existing (e.g. admin
 * pre-provisioned) account with 401 details EMAIL_NOT_VERIFIED; trying again
 * cannot help there, so it gets its own message.
 */
export function identityCallbackErrorCode(body: unknown): string {
  const details = (body as { error?: { details?: unknown } } | null)?.error?.details;
  return details === "EMAIL_NOT_VERIFIED" ? "email_not_verified" : "identity_service_error";
}

/**
 * `/?error=<code>` → the notice shown above the sign-in button. Codes come
 * from the OAuth callback (api/auth/callback/[provider]) and the middleware
 * (not_tutor, account_suspended).
 */
export function getLoginError(code: string | string[] | null | undefined): LoginErrorNotice | null {
  const value = Array.isArray(code) ? code[0] : code;
  if (!value) return null;
  switch (value) {
    case "not_tutor":
      return { tone: "warning", message: t("app.loginErrorNotTutor") };
    case "account_suspended":
      return { tone: "danger", message: t("app.loginErrorSuspended") };
    case "email_not_verified":
      return { tone: "warning", message: t("app.loginErrorEmailNotVerified") };
    case "invalid_state":
      return { tone: "warning", message: t("app.loginErrorExpired") };
    case "missing_code":
      return { tone: "warning", message: t("app.loginErrorCancelled") };
    case "facebook_login_disabled":
      return { tone: "info", message: t("app.loginErrorFacebook") };
    case "server_error":
    case "missing_session_token":
      return { tone: "danger", message: t("app.loginErrorServer") };
    default:
      // identity_service_error and anything unknown.
      return { tone: "danger", message: t("app.loginErrorRejected") };
  }
}
