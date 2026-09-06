// @ts-check
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([".wxt/**", ".output/**", "web-ext.config.ts"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,

  // No languageOptions.globals here: tseslint.configs.recommended turns off
  // no-undef for ts/tsx, and the WXT globals (browser, storage, defineBackground)
  // are declared as const in .wxt/types/imports.d.ts, so tsc already blocks
  // reassignment. Same reason .wxt/eslint-auto-imports.mjs isn't imported.
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
]);
