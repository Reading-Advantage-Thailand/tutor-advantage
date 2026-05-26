export type Tawi50RequiredSettings = {
  taxName?: unknown;
  nationalId?: unknown;
  address?: unknown;
  verification?: {
    taxInfo?: {
      status?: unknown;
    };
  };
};

export type MissingTawi50Field = {
  key: keyof Tawi50RequiredSettings | "taxInfoVerification";
  label: string;
};

const REQUIRED_FIELD_LABELS: Record<keyof Tawi50RequiredSettings, string> = {
  taxName: "ชื่อผู้มีเงินได้ (ตามบัตรประชาชน)",
  nationalId: "เลขประจำตัวผู้เสียภาษี 13 หลัก",
  address: "ที่อยู่",
  verification: "ข้อมูลภาษีต้องผ่านการตรวจสอบจากแอดมิน",
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getMissingTawi50Fields(settings: Tawi50RequiredSettings | null | undefined): MissingTawi50Field[] {
  const missing: MissingTawi50Field[] = [];
  const taxName = asText(settings?.taxName);
  const nationalId = asText(settings?.nationalId).replace(/\D/g, "");
  const address = asText(settings?.address);

  if (!taxName) {
    missing.push({ key: "taxName", label: REQUIRED_FIELD_LABELS.taxName });
  }

  if (nationalId.length !== 13) {
    missing.push({ key: "nationalId", label: REQUIRED_FIELD_LABELS.nationalId });
  }

  if (!address) {
    missing.push({ key: "address", label: REQUIRED_FIELD_LABELS.address });
  }

  if (taxName && nationalId.length === 13 && settings?.verification?.taxInfo?.status !== "VERIFIED") {
    missing.push({ key: "taxInfoVerification", label: REQUIRED_FIELD_LABELS.verification });
  }

  return missing;
}
