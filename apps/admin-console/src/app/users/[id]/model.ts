"use client";

import { useParams } from "next/navigation";
import { useAdminSession } from "@/components/app";
import { api } from "@/lib/api";
import { invalidateResource, useCachedResource } from "@/lib/cachedResource";
import { t } from "@/lib/i18n";
import "@/locales/th/userHeader";

export type VerificationField = "idCard" | "bankBook" | "address" | "taxInfo" | "workPermit";
export const VERIFICATION_FIELDS: VerificationField[] = ["idCard", "bankBook", "address", "taxInfo", "workPermit"];

/** Identity document (GET /v1/users/:id). The passport number is always masked. */
export interface UserIdentity {
  idType: "THAI_ID" | "PASSPORT";
  passportNumberMasked: string | null;
  passportNationality: string | null;
  passportExpiresOn: string | null;
  passportExpired: boolean;
  teachingLocation: "THAILAND" | "ABROAD" | null;
  workPermitRequired: boolean;
  workPermitImageUrl: string | null;
  hasWorkPermitImage: boolean;
  workPermitExpiresOn: string | null;
  workPermitExpired: boolean;
  rightToWorkConfirmedAt: string | null;
  taxResidency: "RESIDENT" | "NON_RESIDENT";
  payoutBlock: "PASSPORT_EXPIRED" | "WORK_PERMIT_EXPIRED" | "WORK_PERMIT_MISSING" | null;
  requiredFields: VerificationField[];
}

export interface VerificationItem {
  status?: string;
  comment?: string;
  updatedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

/** GET /v1/users/:id (PII already masked by the server for FINANCE_CHECKER). */
export interface UserDetailV2 {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  role: string;
  status: "ACTIVE" | "INACTIVE";
  accountStatus: "ACTIVE" | "SUSPENDED" | "ANONYMIZED";
  anonymizedAt: string | null;
  joinedAt: string;
  profilePictureUrl: string | null;
  idCardImageUrl: string | null;
  bankBookImageUrl: string | null;
  hasIdCardImage: boolean;
  hasBankBookImage: boolean;
  verificationStatus: string;
  verificationComment: string | null;
  piiMasked: boolean;
  identity?: UserIdentity;
  settings: {
    address: string | null;
    hasAddress?: boolean;
    bankAccountNumber: string | null;
    bankBrand: string | null;
    taxName: string | null;
    nationalId: string | null;
    hasNationalId?: boolean;
    omiseRecipientId: string | null;
    verification: Partial<Record<VerificationField, VerificationItem>>;
  };
  sponsor: { id: string; name: string | null } | null;
  loginProviders: string[];
  guardianSetup: boolean;
  guardians: { id: string; name: string | null; relation: string; consentedAt: string }[];
  consentLogs: { id: string; version: string; type: string; status: string; timestamp: string }[];
  classes: {
    id: string;
    enrollmentId?: string;
    name: string;
    students: number;
    capacity: number;
    status: string;
    bookTitle?: string;
    startsAt?: string | null;
    enrolledAt?: string;
  }[];
}

export function useUserId(): string {
  const params = useParams<{ id: string }>();
  return String(params?.id ?? "");
}

export function userKey(adminId: string, userId: string) {
  return `${adminId}:users:detail:${userId}`;
}

/** Shared (deduped) detail resource for the layout header and every tab. */
export function useUserDetail() {
  const me = useAdminSession();
  const userId = useUserId();
  const resource = useCachedResource(
    me && userId ? userKey(me.userId, userId) : null,
    () => api.get<{ user: UserDetailV2 }>(`/v1/users/${userId}`).then((response) => response.user),
  );
  return { ...resource, userId, me };
}

/** After a mutation: refresh this user, the list and the user's audit tab. */
export function invalidateUser(adminId: string, userId: string) {
  invalidateResource(userKey(adminId, userId));
  invalidateResource(`${adminId}:users:list:`);
  invalidateResource(`${adminId}:users:audit:${userId}`);
}

export function displayName(user: Pick<UserDetailV2, "name">) {
  return user.name || t("userHeader.unnamed");
}

export function isPassportHolder(user: Pick<UserDetailV2, "identity">) {
  return user.identity?.idType === "PASSPORT";
}

export function fieldLabel(field: VerificationField, user?: Pick<UserDetailV2, "identity">) {
  const passport = user ? isPassportHolder(user) : false;
  return {
    idCard: passport ? t("userHeader.passport") : t("userHeader.idCard"),
    bankBook: t("userHeader.bankBook"),
    address: t("userHeader.deliveryAddress"),
    taxInfo: passport ? t("userHeader.passportTaxInfo") : t("userHeader.taxInfo"),
    workPermit: t("userHeader.workPermit"),
  }[field];
}

/** Fields shown for this tutor (work permit only when required or already submitted). */
export function visibleFields(user: UserDetailV2): VerificationField[] {
  return VERIFICATION_FIELDS.filter(
    (field) =>
      field !== "workPermit" ||
      user.identity?.workPermitRequired ||
      Boolean(user.settings.verification?.workPermit?.status),
  );
}

export const BANK_LABELS: Record<string, string> = {
  kbank: "กสิกรไทย (KBank)",
  scb: "ไทยพาณิชย์ (SCB)",
  bbl: "กรุงเทพ (BBL)",
  bay: "กรุงศรีอยุธยา (BAY)",
  ktb: "กรุงไทย (KTB)",
  tmb: "ทีทีบี (TTB)",
  ttb: "ทีทีบี (TTB)",
  kiatnakin: "เกียรตินาคินภัทร (KKP)",
  cimb: "ซีไอเอ็มบี (CIMB)",
  gsb: "ออมสิน (GSB)",
  baac: "ธ.ก.ส. (BAAC)",
  mhcb: "มิซูโฮ (Mizuho)",
  uob: "ยูโอบี (UOB)",
  lhb: "แลนด์แอนด์เฮ้าส์ (LH Bank)",
};

export function pendingFields(user: UserDetailV2): VerificationField[] {
  return VERIFICATION_FIELDS.filter((field) => user.settings.verification?.[field]?.status === "PENDING");
}
