import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${path.resolve(import.meta.dirname, "src")}/` },
      { find: "server-only", replacement: path.resolve(import.meta.dirname, "tests/support/server-only.ts") },
    ],
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
  },
});
