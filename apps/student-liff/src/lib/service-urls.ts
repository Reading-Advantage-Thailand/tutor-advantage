/**
 * Backend service base URLs — server-side only (no NEXT_PUBLIC_ prefix).
 */
export const IDENTITY_URL =
  process.env.IDENTITY_SERVICE_URL || "http://localhost:3001";

export const LEARNING_URL =
  process.env.LEARNING_API_BASE_URL || "http://localhost:3002";

export const FINANCE_URL =
  process.env.FINANCE_API_BASE_URL || "http://localhost:3003";
