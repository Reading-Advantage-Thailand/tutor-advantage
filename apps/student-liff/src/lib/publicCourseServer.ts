import "server-only";
import { LEARNING_URL } from "./service-urls";
import type { PublicCourse } from "./publicCourses";

async function request(path: string) {
  return fetch(LEARNING_URL + "/v1/public/classes" + path, {
    cache: "no-store", signal: AbortSignal.timeout(8000),
  });
}

export async function getPublicCourses(): Promise<PublicCourse[]> {
  const response = await request("");
  if (!response.ok) throw new Error("CATALOG_UNAVAILABLE");
  return ((await response.json()) as { classes: PublicCourse[] }).classes;
}

export async function getPublicCourse(id: string): Promise<PublicCourse | null> {
  const response = await request("/" + encodeURIComponent(id));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("CATALOG_UNAVAILABLE");
  return ((await response.json()) as { class: PublicCourse }).class;
}
