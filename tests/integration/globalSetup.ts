import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

export default function setup() {
  const envPath = path.resolve(process.cwd(), ".env.integration");
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }

  if (process.env.SKIP_INTEGRATION_TESTS === "1") {
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "Integration tests require DATABASE_URL. Copy .env.integration.example " +
        "to .env.integration and point it at a dedicated test database.",
    );
  }

  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\//, "").toLowerCase();
  const explicitlyAllowed =
    process.env.INTEGRATION_ALLOW_NON_TEST_DATABASE === "1";

  if (!databaseName.includes("test") && !explicitlyAllowed) {
    throw new Error(
      `Refusing to run destructive integration tests against database "${databaseName}". ` +
        "Use a database whose name contains 'test', or explicitly set " +
        "INTEGRATION_ALLOW_NON_TEST_DATABASE=1.",
    );
  }
}
