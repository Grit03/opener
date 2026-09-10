// @ts-check
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";

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
      "no-restricted-imports": ["error", {
        paths: [{ name: "#imports", message: "실제 경로로 import 하세요. 목록은 .wxt/types/imports-module.d.ts" }],
      }],
    },
  },
  // Playwright fixture 파일. `({}, use)`는 Playwright가 요구하는 형식이고,
  // `use`는 React 훅이 아니라 Playwright 콜백이다.
  {
    files: ["e2e/**/*.ts"],
    rules: {
      "no-empty-pattern": "off",
      "react-hooks/rules-of-hooks": "off",
    },
  },
  eslintConfigPrettier
]);
