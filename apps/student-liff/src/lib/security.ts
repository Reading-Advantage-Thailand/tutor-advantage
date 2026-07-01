const DEV_SECRET = "secret-for-dev-only-change-me";

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (
    process.env.NODE_ENV === "production" &&
    (!secret || secret === DEV_SECRET || secret.length < 32)
  ) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  }
  return secret || DEV_SECRET;
}

export function devRoutesEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_DEV_ROUTES === "true"
  );
}
