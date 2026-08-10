import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "coverage/**", "convex/_generated/**"]),
  {
    rules: {
      // A leading underscore marks a binding that exists only to be discarded —
      // the destructuring-to-omit idiom used when a validated field must not be
      // persisted. Without this, the alternative is either an eslint-disable
      // comment at each site or listing every surviving field by hand.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
]);
