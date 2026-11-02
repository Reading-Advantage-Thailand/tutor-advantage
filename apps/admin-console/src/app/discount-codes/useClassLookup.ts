"use client";

import { useAdminSession } from "@/components/app";
import { api } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import type { AdminClass, AdminClassPage } from "../classes/classForm";

/** Cache prefix for GET /v1/admin/classes (shared with /classes so a create refreshes both). */
export function adminClassesKey(userId: string): string {
  return `${userId}:admin-classes:`;
}

/**
 * One class by id (GET /v1/admin/classes?q=<uuid>, demo classes included) for
 * the `?classId=` filter chip and the preselected class in the create sheet.
 * Resolves to null when the class does not exist.
 */
export function useClassLookup(classId: string | null) {
  const me = useAdminSession();
  return useCachedResource<AdminClass | null>(
    me && classId ? `${adminClassesKey(me.userId)}lookup:${classId}` : null,
    async () => {
      const data = await api.get<AdminClassPage>("/v1/admin/classes", {
        query: { q: classId, pageSize: 10, includeDemo: "true" },
      });
      return data.items.find((item) => item.classId === classId) ?? null;
    },
    { staleTime: 60_000 },
  );
}
