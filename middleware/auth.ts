import { auth } from "@/lib/auth";
import { Role } from "@prisma/client";
import type { Session } from "@auth/core/types"
import { HttpError } from "./http-error";

export async function requireAuth(requiredRoles: Role[] = []): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    throw new HttpError("Unauthorized", 401);
  }

  if (requiredRoles.length > 0 && !requiredRoles.includes(session.user.role as Role)) {
    throw new HttpError("Forbidden: Insufficient Role", 403);
  }
  return session;
}