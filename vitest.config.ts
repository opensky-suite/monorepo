import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.spec.ts",
        "**/*.test.ts",
        "**/types.ts",
        "**/*.d.ts",
        "tools/",
        "vitest.config.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist"],
  },
  resolve: {
    alias: {
      "@opensky/skymeet": resolve(__dirname, "./packages/skymeet/src"),
    },
  },
});
