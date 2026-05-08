"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function createClass(data: { name: string; book: string; schedule: string; meetingUrl?: string }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) {
    throw new Error("Unauthorized");
  }

  const requestBody = {
    title: data.name,
    bookId: data.book,
    capacity: 30, // Default for now
    scheduleDescription: data.schedule,
    meetingUrl: data.meetingUrl,
  };

  const res = await fetch("http://localhost:3002/v1/classes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(requestBody)
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
export async function getBooks() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) {
    throw new Error("Unauthorized");
  }
 
  const res = await fetch("http://localhost:3002/v1/books", {
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

  const res = await fetch(`http://localhost:3002/v1/classes/${classId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error?.message || "Failed to delete class");
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

  const res = await fetch(`http://localhost:3002/v1/classes/${classId}/meeting-url`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ meetingUrl })
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error?.message || "Failed to update meeting URL");
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

  const res = await fetch(`http://localhost:3002/v1/classes/${classId}/articles`, {
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
