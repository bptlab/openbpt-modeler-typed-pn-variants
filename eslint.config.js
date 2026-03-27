import eslintConfigPrettier from "eslint-config-prettier";
import pluginPrettier from "eslint-plugin-prettier";
import typescriptParser from "@typescript-eslint/parser";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";

export default [
  // disable rules that conflict with Prettier
  eslintConfigPrettier,

  // basic project-level settings
  {
    ignores: ["node_modules/**", "dist/**"],
  },

  // language options and rules for JS (existing)
  {
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: {
      prettier: pluginPrettier,
    },
    rules: {
      "no-console": "off",
      "prettier/prettier": ["warn", { trailingComma: "all" }],
    },
  },

  // TypeScript-specific support (applies to .ts/.tsx)
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        // If you want type-aware linting, set `project` to your tsconfig:
        // project: ["./tsconfig.json"],
      },
    },
    plugins: {
      "@typescript-eslint": typescriptPlugin,
      prettier: pluginPrettier,
    },
    rules: {
      // recommended typescript rules (you can tune)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "prettier/prettier": ["warn", { trailingComma: "all" }],
    },
  },
];
