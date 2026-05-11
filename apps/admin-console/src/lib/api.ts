export const FINANCE_API_URL =
  process.env.NEXT_PUBLIC_FINANCE_API_URL || "http://localhost:3003";

function getErrorMessage(data: unknown) {
  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (data && typeof data === "object" && "error" in data) {
    const error = (data as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) {
      return error;
    }
    if (error && typeof error === "object" && "message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
  }

  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "Something went wrong";
}

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

  const fullUrl = url.startsWith("http") ? url : `${FINANCE_API_URL}${url}`;

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
    throw new Error(getErrorMessage(data));
  }

  return data;
}

export async function fetchBlobWithAuth(
  url: string,
  options: RequestInit = {},
) {
  let token = null;
  if (typeof window !== "undefined") {
    token = localStorage.getItem("admin_token");
  }

  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const fullUrl = url.startsWith("http") ? url : `${FINANCE_API_URL}${url}`;
  const response = await fetch(fullUrl, { ...options, headers });

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.clear();
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please sign in again.");
  }

  if (!response.ok) {
    const isJson = response.headers
      .get("content-type")
      ?.includes("application/json");
    const data = isJson ? await response.json() : await response.text();
    throw new Error(getErrorMessage(data));
  }

  return response.blob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
