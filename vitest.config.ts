import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  plugins: [react()],
  test: {
    // Node is the default: most suites cover server-side pure functions and
    // route handlers. Component suites opt into a DOM with a
    // `@vitest-environment jsdom` docblock at the top of the file.
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      include: ["lib/**/*.ts", "app/api/**/*.ts", "components/**/*.tsx"],
      exclude: ["**/_generated/**"],
    },
  },
});
