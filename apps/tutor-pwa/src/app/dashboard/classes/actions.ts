"use server";

import { cookies } from "next/headers";
import { LEARNING_URL } from "@/lib/service-urls";
import { revalidatePath } from "next/cache";
import {
  buildCreateClassRequest,
  getClassActionErrorMessage,
  type CreateClassForm,
  type SetupClassRequest,
} from "@/lib/tutorClassFlow";
import { t } from "@/lib/i18n";

export async function createClass(data: CreateClassForm) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) {
    throw new Error("Unauthorized");
  }

  const requestBody = buildCreateClassRequest(data);

  const res = await fetch(`${LEARNING_URL}/v1/classes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(getClassActionErrorMessage(err, t("tutorClass.errors.createClass")));
  }

  revalidatePath("/dashboard/classes");
  return res.json();
}

/** Result instead of a throw so the form can show the server's reason (thrown messages are hidden in production). */
export type SetupClassResult = { ok: true } | { ok: false; code: string };

/** Completes a class an admin created for this tutor (name, schedule, meeting link). */
export async function setupClass(classId: string, data: SetupClassRequest): Promise<SetupClassResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  if (!token) return { ok: false, code: "UNAUTHORIZED" };

  try {
    const res = await fetch(`${LEARNING_URL}/v1/classes/${encodeURIComponent(classId)}/setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      return { ok: false, code: err?.error?.code || "SETUP_FAILED" };
    }
  } catch (error) {
    console.error("[setupClass] request failed:", error);
    return { ok: false, code: "SETUP_FAILED" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/classes");
  revalidatePath(`/dashboard/classes/${classId}`);
  return { ok: true };
}

export async function updateClassStatus(classId: string, status: "open" | "full" | "closed") {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) {
    throw new Error("Unauthorized");
  }

  const res = await fetch(`${LEARNING_URL}/v1/classes/${classId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status })
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(getClassActionErrorMessage(err, t("tutorClass.errors.updateClassStatus")));
  }

  revalidatePath("/dashboard/classes");
  revalidatePath(`/dashboard/classes/${classId}`);
  return res.json();
}
export async function rescheduleClass(
  classId: string,
  payload: { scheduleDescription: string; scheduleData?: any[]; startsAt?: string; endsAt?: string; totalHours?: number },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;

  if (!token) {
    throw new Error("Unauthorized");
  }

  const res = await fetch(`${LEARNING_URL}/v1/classes/${classId}/schedule`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(getClassActionErrorMessage(err, t("tutorClass.errors.reschedule")));
  }

  revalidatePath("/dashboard/classes");
  revalidatePath(`/dashboard/classes/${classId}`);
  return res.json();
}

export async function validateCoupon(code: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;

  if (!token) {
    throw new Error("Unauthorized");
  }

  const res = await fetch(`${LEARNING_URL}/v1/coupons/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(getClassActionErrorMessage(data, t("tutorClass.errors.coupon")));
  }
  return data as { valid: boolean; code: string; hours: number; expiresAt: string | null };
}

export async function applyCoupon(classId: string, code: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;

  if (!token) {
    throw new Error("Unauthorized");
  }

  const res = await fetch(`${LEARNING_URL}/v1/classes/${classId}/apply-coupon`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(getClassActionErrorMessage(data, t("tutorClass.errors.coupon")));
  }

  revalidatePath("/dashboard/classes");
  revalidatePath(`/dashboard/classes/${classId}`);
  return data as { classId: string; freeHours: number };
}

export async function getBooks() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) {
    throw new Error("Unauthorized");
  }
 
  const res = await fetch(`${LEARNING_URL}/v1/books`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  
  if (!res.ok) {
    throw new Error("Failed to fetch books");
  }
 
  return res.json();
}

export async function deleteClass(classId: string) {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Dev only");
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) {
    throw new Error("Unauthorized");
  }

  const res = await fetch(`${LEARNING_URL}/v1/classes/${classId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(getClassActionErrorMessage(err, t("tutorClass.errors.deleteClass")));
  }

  revalidatePath("/dashboard/classes");
  return res.json();
}
export async function updateMeetingUrl(classId: string, meetingUrl: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) {
    throw new Error("Unauthorized");
  }

  const res = await fetch(`${LEARNING_URL}/v1/classes/${classId}/meeting-url`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ meetingUrl })
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(getClassActionErrorMessage(err, t("tutorClass.errors.updateMeetingUrl")));
  }

  revalidatePath("/dashboard/classes");
  revalidatePath(`/dashboard/classes/${classId}`);
  return res.json();
}

export async function getClassArticles(classId: string, cycleId?: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) {
    throw new Error("Unauthorized");
  }

  const query = cycleId ? `?cycleId=${encodeURIComponent(cycleId)}` : "";
  const res = await fetch(`${LEARNING_URL}/v1/classes/${classId}/articles${query}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[getClassArticles Error] status: ${res.status}, body: ${errText}`);
    throw new Error(`Failed to fetch class articles: ${errText || res.statusText}`);
  }
 
  return res.json();
}

export async function createClassBookCycle(classId: string, payload: { bookId: string; packagePriceSatang: number }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) {
    throw new Error("Unauthorized");
  }

  const res = await fetch(`${LEARNING_URL}/v1/classes/${classId}/book-cycles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(getClassActionErrorMessage(err, "Could not open the selected book"));
  }

  revalidatePath("/dashboard/classes");
  revalidatePath(`/dashboard/classes/${classId}`);
  return res.json();
}


export async function devSeedClassAllProgress(classId: string) {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Dev only");
  }
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  if (!token) throw new Error("Unauthorized");

  const res = await fetch(`${LEARNING_URL}/v1/dev/seed/class-all-progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ classId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to seed class progress");
  }
  revalidatePath(`/dashboard/classes/${classId}`);
  return res.json() as Promise<{
    classId: string;
    className: string;
    bookTitle: string;
    studentsProcessed: number;
    articlesTotal: number;
    sessionsCreated: number;
    skipped: number;
  }>;
}
