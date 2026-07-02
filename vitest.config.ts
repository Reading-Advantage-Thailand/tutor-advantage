import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
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
  test: {
    globals: true,
    environment: "node",
    include: [
      "apps/**/*.{test,spec}.{ts,tsx}",
      "packages/**/*.{test,spec}.{ts,tsx}",
      "services/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
    ],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      exclude: [
        "**/dist/**",
        "**/.next/**",
        "**/node_modules/**",
        "**/*.{test,spec}.{ts,tsx}",
      ],
      thresholds: {
        statements: 44,
        branches: 40,
        functions: 49,
        lines: 45,
        "services/finance-mlm-service/src/services/settlementService.ts": {
          statements: 70,
          branches: 60,
        },
      },
    },
  },
});
