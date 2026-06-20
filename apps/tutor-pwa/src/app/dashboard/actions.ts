"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

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

export async function updateSettingsAction(settings: any) {
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
      } catch (e) {
        // Fallback to generic message if json parse fails
      }
      return { success: false, error: errorMessage };
    }

    const data = await res.json();
    return { success: true, url: data.url };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error occurred" };
  }
}

export async function saveTaxInfoAction(taxName: string, nationalId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  if (!token) throw new Error("Unauthorized");

  const normalizedId = nationalId.replace(/\D/g, "");
  const res = await fetch(`${IDENTITY_URL}/v1/users/me/verification`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      taxName: taxName.trim(),
      nationalId: normalizedId,
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || "Failed to submit tax info verification");
  }
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/dashboard/settings");
  return res.json();
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
  return cookieStore.get("tutor_session")?.value || null;
}
