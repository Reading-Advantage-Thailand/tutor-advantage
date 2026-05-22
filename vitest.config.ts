import { defineConfig } from "vitest/config";

export default defineConfig({
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
  },
});
