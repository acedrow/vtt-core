import js from "@eslint/js";
import vue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.tsbuildinfo",
      "**/.wrangler/**",
      "**/coverage/**",
      "**/scripts/**",
      "packages/client/public/**",
      "packages/e2e/playwright-report/**",
      "packages/e2e/test-results/**",
      "packages/e2e/.playwright-browsers/**",
      "test-results/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Essential = Vue's error-prevention rules only (includes require-v-for-key,
  // valid-v-for, no-use-v-for-key). The formatting-oriented "recommended" tier
  // is left out; this repo has no formatter and does not follow those rules.
  ...vue.configs["flat/essential"],

  // TypeScript already covers these more accurately than the non-type-aware
  // core rules: no-undef/no-redeclare false-positive on types and ambient
  // globals, and noFallthroughCasesInSwitch (tsconfig.base.json) understands
  // exhaustive string-union switches that ESLint's no-fallthrough flags.
  {
    files: ["**/*.ts", "**/*.vue"],
    rules: {
      "no-undef": "off",
      "no-redeclare": "off",
      "no-fallthrough": "off",
    },
  },

  // Vue SFCs: parse <script lang="ts"> with the TS parser.
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
      globals: { ...globals.browser },
    },
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },

  {
    files: ["packages/client/**/*.{ts,vue}"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ["packages/server/**/*.ts", "packages/shared/**/*.ts"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["packages/cf-worker/**/*.ts"],
    languageOptions: { globals: { ...globals.serviceworker, ...globals.browser } },
  },

  // Type-aware rules on the backends. This is where fire-and-forget promises
  // bite: an un-awaited KV/console write can be lost when a Durable Object
  // hibernates, and misused promises silently no-op.
  {
    files: ["packages/server/src/**/*.ts", "packages/cf-worker/src/**/*.ts", "packages/shared/src/**/*.ts"],
    ignores: ["**/*.test.ts", "**/test/**"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },

  // High-volume stylistic findings stay as warnings so `lint` fails only on
  // real defects, not pre-existing cleanup opportunities.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
