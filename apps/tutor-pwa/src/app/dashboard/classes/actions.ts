"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function createClass(data: { name: string; book: string; schedule: string; meetingUrl?: string }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) {
    throw new Error("Unauthorized");
  }

  const res = await fetch("http://localhost:3002/v1/classes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to create class");
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

  const res = await fetch(`http://localhost:3002/v1/classes/${classId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status })
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to update class status");
  }

  revalidatePath("/dashboard/classes");
  revalidatePath(`/dashboard/classes/${classId}`);
  return res.json();
}
