"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getClassActionErrorMessage } from "@/lib/tutorClassFlow";

export async function claimClass(transferId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) {
    throw new Error("Unauthorized");
  }

  const res = await fetch(`http://localhost:3002/v1/classes/auction/${transferId}/claim`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(getClassActionErrorMessage(err, "Failed to claim class"));
  }

  revalidatePath("/dashboard/classes/auction");
  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard");
  return res.json();
}
