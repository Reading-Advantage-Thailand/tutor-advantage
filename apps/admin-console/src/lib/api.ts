const BASE_URL = "http://localhost:3003";

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  let token = null;
  if (typeof window !== "undefined") {
    token = localStorage.getItem("admin_token");
  }

  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (
    !headers.has("Content-Type") &&
    !(options.body && options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  // Token หมดอายุหรือไม่มีสิทธิ์ → redirect กลับ login
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.clear();
      window.location.href = "/login";
    }
    throw new Error("Session หมดอายุ กรุณา login ใหม่");
  }

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorData = data as { error?: { message?: string } };
    throw new Error(
      errorData?.error?.message ||
        (typeof data === "string" ? data : "Something went wrong"),
    );
  }

  return data;
}
