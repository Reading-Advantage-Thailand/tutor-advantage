import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Vitest config for integration tests that hit a real PostgreSQL database.
 *
 * Required env:
 *   DATABASE_URL — Prisma connection string for a DEDICATED TEST database.
 *                  Never point this at production. Use a cloud-sql-proxy tunnel
 *                  or a local Postgres container.
 *
 * Run with:
 *   npm run test:integration
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/globalSetup.ts"],
    // Long timeout because each test makes real DB round-trips
    testTimeout: 60_000,
    hookTimeout: 30_000,
    // Integration tests must not share mock state with unit tests
    restoreMocks: false,
    clearMocks: false,
    env: {
      NODE_ENV: "test",
    },
    // Run test files sequentially to avoid settlement idempotency conflicts
    // (two concurrent runs for the same PERIOD_MONTH would trigger DRAFT_EXISTS)
    fileParallelism: false,
  },
  resolve: {
    alias: {
      // Point workspace package to source so tests don't need a dist build
      "@tutor-advantage/database": path.resolve(
        __dirname,
        "packages/database/src/index.ts",
      ),
      "@tutor-advantage/shared-config": path.resolve(
        __dirname,
        "packages/shared-config/src/index.ts",
      ),
    },
  },
});
