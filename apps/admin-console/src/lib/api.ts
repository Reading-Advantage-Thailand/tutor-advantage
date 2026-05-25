import { t } from "./i18n";

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

  return t("api.genericError");
}

async function handleUnauthorized() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch (e) {
    console.error("Failed to clear cookie:", e);
  }
  window.location.href = "/login";
}

// Routes all finance API calls through the Next.js proxy so the httpOnly
// admin_token cookie is read server-side — never exposed to client JavaScript.
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const proxyUrl = url.startsWith("/") ? `/api/proxy${url}` : url;

  const headers = new Headers(options.headers);
  if (
    !headers.has("Content-Type") &&
    !(options.body && options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(proxyUrl, { ...options, headers });

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      await handleUnauthorized();
    }
    throw new Error(t("api.sessionExpiredThai"));
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
  options: RequestInit = {}
) {
  const proxyUrl = url.startsWith("/") ? `/api/proxy${url}` : url;

  const response = await fetch(proxyUrl, options);

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      await handleUnauthorized();
    }
    throw new Error(t("api.sessionExpiredEnglish"));
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

export function getAdminRole(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )admin_role=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function getAdminEmail(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )admin_email=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}
