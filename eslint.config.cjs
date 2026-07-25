/**
 * ESLint flat config. Каждый объект с rules/plugins должен иметь `files`,
 * иначе flat-config ничего не матчит (audit 3.1).
 */
const js = require("@eslint/js")
const tsPlugin = require("@typescript-eslint/eslint-plugin")
const tsParser = require("@typescript-eslint/parser")
const prettierConfig = require("eslint-config-prettier")
const prettierPlugin = require("eslint-plugin-prettier")

const browserGlobals = {
  window: "readonly",
  document: "readonly",
  localStorage: "readonly",
  sessionStorage: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  requestAnimationFrame: "readonly",
  cancelAnimationFrame: "readonly",
  performance: "readonly",
  fetch: "readonly",
  indexedDB: "readonly",
  File: "readonly",
  Blob: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  DOMParser: "readonly",
  Node: "readonly",
  Element: "readonly",
  HTMLElement: "readonly",
  SpeechSynthesisUtterance: "readonly",
  speechSynthesis: "readonly",
  navigator: "readonly",
  location: "readonly",
  history: "readonly",
  crypto: "readonly",
  btoa: "readonly",
  atob: "readonly",
  Image: "readonly",
  FileReader: "readonly",
  AbortController: "readonly",
  Response: "readonly",
  Headers: "readonly",
  FormData: "readonly",
  CustomEvent: "readonly",
  Event: "readonly",
  confirm: "readonly",
  alert: "readonly",
  getComputedStyle: "readonly",
  matchMedia: "readonly",
  MutationObserver: "readonly",
  IntersectionObserver: "readonly",
  ResizeObserver: "readonly",
  queueMicrotask: "readonly",
  structuredClone: "readonly",
  self: "readonly",
  caches: "readonly"
}

module.exports = [
  {
    ignores: [
      "**/node_modules/**",
      "js/vendor/**",
      "www/**",
      "dist/**",
      "extension/dist/**",
      "**/*.min.js",
      "**/*.bundle.js",
      // Рядом с .ts лежат emit'ы tsc — линтим только исходники.
      "js/**/*.js",
      "cli/**/*.js"
    ]
  },
  {
    files: ["js/**/*.ts", "cli/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: browserGlobals,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      prettier: prettierPlugin
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...prettierConfig.rules,
      // Форматирование — warn (накопленный долг не валит prepush); ошибки правил — error.
      "prettier/prettier": "warn",
      "no-console": "off",
      "no-undef": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          // Пустые catch (e) {/* offline */} — обычный паттерн проекта.
          caughtErrors: "none"
        }
      ]
    }
  },
  {
    files: ["functions/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...browserGlobals,
        Response: "readonly",
        Request: "readonly",
        crypto: "readonly",
        caches: "readonly",
        process: "readonly"
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-console": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }
      ]
    }
  }
]
