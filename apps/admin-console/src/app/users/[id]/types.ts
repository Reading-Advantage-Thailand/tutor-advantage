import { CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";
import React from "react";

export interface ConsentLog {
  id: string;
  version: string;
  type: string;
  status: string;
  timestamp: string;
}

export interface UserClass {
  id: string;
  name: string;
  students: number;
  status: string;
  bookTitle?: string;
  startsAt?: string | null;
}

export type VerificationField = "idCard" | "bankBook" | "address" | "taxInfo";

export interface VerificationItem {
  status?: string;
  comment?: string;
  updatedAt?: string;
}

export interface UserDetail {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  status: string;
  joinedAt: string;
  profilePictureUrl?: string | null;
  guardianSetup: boolean;
  idCardImageUrl?: string | null;
  bankBookImageUrl?: string | null;
  verificationStatus: string;
  verificationComment?: string | null;
  settings?: {
    address?: string;
    bankAccountNumber?: string;
    bankBrand?: string;
    taxName?: string;
    nationalId?: string;
    omiseRecipientId?: string;
    verification?: Partial<Record<VerificationField, VerificationItem>>;
  };
  consentLogs: ConsentLog[];
  classes: UserClass[];
}

export const verificationFieldLabels: Record<VerificationField, string> = {
  idCard: "สำเนาบัตรประชาชน",
  bankBook: "หน้าสมุดบัญชี",
  address: "ที่อยู่สำหรับส่งเอกสาร",
  taxInfo: "ข้อมูลภาษีสำหรับใบ 50 ทวิ",
};

export const BANK_BRAND_LABELS: Record<string, string> = {
  kbank: "กสิกรไทย (KBank)",
  scb: "ไทยพาณิชย์ (SCB)",
  bbl: "กรุงเทพ (BBL)",
  bay: "กรุงศรีอยุธยา (BAY)",
  ttb: "ทีทีบี (TTB)",
  kiatnakin: "เกียรตินาคินภัทร (KKP)",
  cimb: "ซีไอเอ็มบี (CIMB)",
  gsb: "ออมสิน (GSB)",
  baac: "ธ.ก.ส. (BAAC)",
  uob: "ยูโอบี (UOB)",
  lhb: "แลนด์แอนด์เฮ้าส์ (LH Bank)",
};

export const VERIFICATION_STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: React.ElementType }
> = {
  VERIFIED: {
    label: "ยืนยันตัวตนแล้ว",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    icon: CheckCircle2,
  },
  PENDING: {
    label: "รอตรวจสอบ",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    icon: Clock,
  },
  REJECTED: {
    label: "เอกสารถูกปฏิเสธ",
    className: "bg-red-500/10 text-red-600 border-red-500/30",
    icon: XCircle,
  },
  UNVERIFIED: {
    label: "ยังไม่ยืนยันตัวตน",
    className: "bg-muted text-muted-foreground border-transparent",
    icon: AlertCircle,
  },
};

export const CLASS_STATUS_CONFIG: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  OPEN: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  PUBLISHED: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  IN_PROGRESS: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  FULL: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  COMPLETED: "bg-muted text-muted-foreground border-transparent",
  CANCELLED: "bg-red-500/10 text-red-600 border-red-500/30",
};
