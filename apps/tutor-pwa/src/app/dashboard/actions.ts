"use server";

import { cookies } from "next/headers";
import { IDENTITY_URL, LEARNING_URL } from "@/lib/service-urls";

export async function getNotificationsSummary() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) return { unreadChat: 0, availableAuctions: 0 };

  try {
    const res = await fetch(`${LEARNING_URL}/v1/notifications/summary`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      next: { revalidate: 0 } // Do not cache summary endpoint heavily
    });
    
    if (!res.ok) return { unreadChat: 0, availableAuctions: 0 };
    
    const data = await res.json();
    return data.notifications || { unreadChat: 0, availableAuctions: 0 };
  } catch (error) {
    console.error("Failed to fetch notification summary", error);
    return { unreadChat: 0, availableAuctions: 0 };
  }
}

export async function updateSettingsAction(settings: Record<string, unknown>) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  if (!token) throw new Error("Unauthorized");

  const res = await fetch(`${IDENTITY_URL}/v1/users/me/settings`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(settings),
  });

  if (!res.ok) throw new Error("Failed to update settings");
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/dashboard", "layout");
  
  const data = await res.json();
  return data.settings;
}

export async function submitVerificationAction(
  idCardImageUrl?: string,
  bankBookImageUrl?: string,
  address?: string,
  bankAccountNumber?: string,
  bankBrand?: string,
  taxName?: string,
  nationalId?: string,
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  if (!token) throw new Error("Unauthorized");

  const res = await fetch(`${IDENTITY_URL}/v1/users/me/verification`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ idCardImageUrl, bankBookImageUrl, address, bankAccountNumber, bankBrand, taxName, nationalId }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || "Failed to submit verification");
  }

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/dashboard/settings");
  
  return res.json();
}

export async function uploadFileAction(formData: FormData) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  if (!token) return { success: false, error: "Unauthorized" };

  try {
    const res = await fetch(`${IDENTITY_URL}/v1/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      let errorMessage = "Failed to upload file";
      try {
        const error = await res.json();
        if (error.error?.message) {
          errorMessage = error.error.message;
        }
      } catch {
        // Fallback to generic message if json parse fails
      }
      return { success: false, error: errorMessage };
    }

    const data = await res.json();
    return { success: true, objectKey: data.objectKey as string };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error occurred" };
  }
}

export type TaxInfoPayload = {
  idType: "THAI_ID" | "PASSPORT";
  taxName: string;
  nationalId?: string;
  passportNumber?: string;
  passportNationality?: string;
  passportExpiresOn?: string;
  teachingLocation?: "THAILAND" | "ABROAD";
  privacyNoticeAccepted?: boolean;
  rightToWorkConfirmed?: boolean;
};

/** Result instead of a throw so the form can show the server's reason (thrown messages are hidden in production). */
export type VerificationActionResult = { ok: true } | { ok: false; code: string };

async function postVerification(body: Record<string, unknown>): Promise<VerificationActionResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  if (!token) return { ok: false, code: "UNAUTHORIZED" };

  const res = await fetch(`${IDENTITY_URL}/v1/users/me/verification`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => null);
    return { ok: false, code: error?.error?.code || "SUBMIT_FAILED" };
  }
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

/** Identity/tax step: Thai ID or passport (with teaching location and consents). */
export async function saveTaxInfoAction(payload: TaxInfoPayload) {
  if (payload.idType === "PASSPORT") {
    return postVerification({
      idType: "PASSPORT",
      taxName: payload.taxName.trim(),
      passportNumber: (payload.passportNumber ?? "").replace(/[\s-]/g, "").toUpperCase(),
      passportNationality: (payload.passportNationality ?? "").trim().toUpperCase(),
      passportExpiresOn: payload.passportExpiresOn,
      teachingLocation: payload.teachingLocation,
      privacyNoticeAccepted: payload.privacyNoticeAccepted === true,
      rightToWorkConfirmed: payload.rightToWorkConfirmed === true,
    });
  }
  return postVerification({
    idType: "THAI_ID",
    taxName: payload.taxName.trim(),
    nationalId: (payload.nationalId ?? "").replace(/\D/g, ""),
  });
}

/** Work permit (passport holders teaching from Thailand). */
export async function submitWorkPermitAction(workPermitImageUrl: string, workPermitExpiresOn: string) {
  return postVerification({ workPermitImageUrl, workPermitExpiresOn });
}

export async function getCurrentUserAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${IDENTITY_URL}/v1/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      next: { revalidate: 30 } // Cache briefly
    });
    
    if (!res.ok) return null;
    const data = await res.json();
    return data.user;
  } catch (error) {
    console.error("Failed to fetch user", error);
    return null;
  }
}

export async function getTutorSessionToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  if (!token) return null;

  try {
    const response = await fetch(`${IDENTITY_URL}/v1/auth/socket-token`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = await response.json() as { socketToken?: string };
    return data.socketToken || null;
  } catch {
    return null;
  }
}
