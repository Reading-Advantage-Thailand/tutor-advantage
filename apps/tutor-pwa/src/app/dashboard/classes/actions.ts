"use server";

import { cookies } from "next/headers";
import { LEARNING_URL } from "@/lib/service-urls";
import { revalidatePath } from "next/cache";
import {
  buildCreateClassRequest,
  getClassActionErrorMessage,
  type CreateClassForm,
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
export async function getBooks() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) {
    throw new Error("Unauthorized");
  }
 
  const res = await fetch(`${LEARNING_URL}/v1/books`, {
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

export async function getClassArticles(classId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) {
    throw new Error("Unauthorized");
  }

  const res = await fetch(`${LEARNING_URL}/v1/classes/${classId}/articles`, {
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
