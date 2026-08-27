/**
 * Flat-config ESLint для КАР-точек.
 *
 * Проект — TypeScript, компилируемый «на место» в js/ (рядом с .ts появляется .js).
 * Поэтому линтим ИСХОДНИКИ (.ts), а сборочный вывод js/**\/*.js игнорируем целиком.
 *
 * Блоки конфига:
 *   js/**\/*.ts          — приложение (браузерные глобалы, TS-парсер, prettier)
 *   extension/**         — Chrome MV3 (глобал chrome)
 *   functions/**         — Cloudflare Workers/Pages Functions (fetch, crypto, Response…)
 *   tests/** scripts/**  — Node
 *
 * Строгость намеренно умеренная: ошибки — только за реальными багами, стиль — warn.
 * Форматирование правит `npm run format` (prettier), здесь оно лишь подсвечивается.
 */
const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettierConfig = require('eslint-config-prettier');
const prettierPlugin = require('eslint-plugin-prettier');

/** Браузерные глобалы приложения (DOM + Web API, которые реально используются). */
const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  history: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  indexedDB: 'readonly',
  caches: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  queueMicrotask: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  requestIdleCallback: 'readonly',
  performance: 'readonly',
  structuredClone: 'readonly',
  matchMedia: 'readonly',
  fetch: 'readonly',
  Headers: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  Blob: 'readonly',
  File: 'readonly',
  FileReader: 'readonly',
  FormData: 'readonly',
  Image: 'readonly',
  Audio: 'readonly',
  AudioContext: 'readonly',
  MediaRecorder: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  DOMParser: 'readonly',
  XMLSerializer: 'readonly',
  Node: 'readonly',
  Element: 'readonly',
  HTMLElement: 'readonly',
  Event: 'readonly',
  CustomEvent: 'readonly',
  EventTarget: 'readonly',
  KeyboardEvent: 'readonly',
  MouseEvent: 'readonly',
  FocusEvent: 'readonly',
  InputEvent: 'readonly',
  UIEvent: 'readonly',
  ErrorEvent: 'readonly',
  PromiseRejectionEvent: 'readonly',
  HTMLCanvasElement: 'readonly',
  MutationObserver: 'readonly',
  IntersectionObserver: 'readonly',
  ResizeObserver: 'readonly',
  crypto: 'readonly',
  atob: 'readonly',
  btoa: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  SpeechSynthesisUtterance: 'readonly',
  speechSynthesis: 'readonly',
  SpeechRecognition: 'readonly',
  webkitSpeechRecognition: 'readonly',
  WebSocket: 'readonly',
  XMLHttpRequest: 'readonly',
  getComputedStyle: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  prompt: 'readonly',
};

/** Глобалы Node (скрипты сборки и тесты). */
const nodeGlobals = {
  process: 'readonly',
  Buffer: 'readonly',
  console: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  global: 'readonly',
  globalThis: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  setImmediate: 'readonly',
  queueMicrotask: 'readonly',
  structuredClone: 'readonly',
  fetch: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
  Headers: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  crypto: 'readonly',
  performance: 'readonly',
};

/** Глобалы Cloudflare Workers / Pages Functions. */
const workerGlobals = {
  fetch: 'readonly',
  crypto: 'readonly',
  console: 'readonly',
  Response: 'readonly',
  Request: 'readonly',
  Headers: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  ReadableStream: 'readonly',
  WritableStream: 'readonly',
  TransformStream: 'readonly',
  Blob: 'readonly',
  FormData: 'readonly',
  atob: 'readonly',
  btoa: 'readonly',
  caches: 'readonly',
  globalThis: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  queueMicrotask: 'readonly',
  structuredClone: 'readonly',
  performance: 'readonly',
};

/**
 * Общие правила поверх eslint:recommended.
 * Пере-объявлены как warn те правила, которые в этой кодовой базе шумят,
 * но не указывают на баг (пустые catch, экранирование в регулярках и т. п.).
 */
const commonRules = {
  ...js.configs.recommended.rules,
  'no-empty': ['warn', { allowEmptyCatch: true }],
  'no-useless-escape': 'warn',
  'no-case-declarations': 'warn',
  'no-prototype-builtins': 'warn',
  'no-control-regex': 'warn',
  'no-irregular-whitespace': 'warn',
  'no-sparse-arrays': 'warn',
  'no-unused-private-class-members': 'warn',
  'no-constant-condition': ['warn', { checkLoops: false }],
  'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
  // Списки globals ниже — best-effort для рантаймов, которые tsc не проверяет
  // (Workers, MV3, vitest). Пропущенный глобал не должен ронять CI.
  'no-undef': 'warn',
  // Реальные баги — оставляем ошибками (из recommended они и так error).
  eqeqeq: ['warn', 'smart'],
  'no-var': 'error',
  'prefer-const': ['warn', { destructuring: 'all' }],
  'no-implicit-coercion': 'off',
  // Идиома «объявить с безопасным значением, присвоить в try» по всему проекту:
  // правило считает начальное значение лишним, хотя оно и есть защита.
  'no-useless-assignment': 'off',
  // Отключаем стилистические правила, конфликтующие с prettier.
  ...prettierConfig.rules,
};

/** Правила для TypeScript: часть базовых заменяется TS-аналогами, часть отдаётся tsc. */
const tsRules = {
  ...commonRules,
  // Неизвестные идентификаторы и неиспользуемые переменные ловит tsc
  // (strict + noUnusedLocals/noUnusedParameters), дублировать не нужно.
  'no-undef': 'off',
  'no-unused-vars': 'off',
  'no-redeclare': 'off',
  'no-dupe-class-members': 'off',
  'no-dupe-args': 'off',
  '@typescript-eslint/no-unused-vars': [
    'warn',
    { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' },
  ],
  // В коде осталось ~9 осознанных any — предупреждение, не ошибка.
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-non-null-assertion': 'off',
  '@typescript-eslint/no-empty-object-type': 'warn',
  '@typescript-eslint/no-unsafe-declaration-merging': 'warn',
  '@typescript-eslint/no-wrapper-object-types': 'warn',
  '@typescript-eslint/no-unnecessary-type-constraint': 'warn',
  '@typescript-eslint/no-duplicate-enum-values': 'error',
  '@typescript-eslint/no-misused-new': 'error',
  '@typescript-eslint/no-this-alias': 'off',
  '@typescript-eslint/ban-ts-comment': [
    'warn',
    { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true },
  ],
  '@typescript-eslint/triple-slash-reference': 'warn',
  '@typescript-eslint/prefer-as-const': 'warn',
};

module.exports = [
  // --- Глобальные игноры (объект только с ignores = применяется ко всему прогону). ---
  {
    ignores: [
      'js/vendor/',
      'www/',
      '*.min.js',
      '*.bundle.js',
      // Вывод tsc лежит рядом с исходниками — линтим только .ts.
      'js/**/*.js',
      'js/**/*.mjs',
      // Файлы деклараций — только типы, линтить нечего.
      '**/*.d.ts',
      // Сборочные артефакты.
      'dist/',
      'extension/dist/',
      'node_modules/',
      'ios/',
      'graphify-out/',
      '_backup_alt_youtube_impl/',
    ],
  },

  // --- Приложение: TypeScript-исходники ---
  {
    files: ['js/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: false } },
      globals: browserGlobals,
    },
    plugins: { '@typescript-eslint': tsPlugin, prettier: prettierPlugin },
    rules: {
      ...tsRules,
      // Форматирование НЕ проверяем здесь: текущий код писался без prettier, и
      // правило давало ~5800 предупреждений, за которыми не видно настоящих
      // проблем. Формат живёт отдельно: `npm run check:format` / `npm run format`.
      'prettier/prettier': 'off',
    },
  },

  // --- js/core/state.ts: интерфейс AppStore сознательно использует any ---
  // Каждому any сопоставлен комментарий с причиной (два несовместимых типа
  // Settings, возвраты CloudStore через _cloudOrQueue и т. д.). Сузить их
  // можно только рефакторингом data/, что вне рамок этого файла.
  {
    files: ['js/core/state.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },

  // --- Chrome-расширение (MV3): исходники на TS + глобал chrome ---
  {
    files: ['extension/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...browserGlobals, chrome: 'readonly' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: tsRules,
  },
  {
    files: ['extension/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...nodeGlobals, chrome: 'readonly' },
    },
    rules: commonRules,
  },

  // --- Cloudflare Pages Functions (Workers runtime) ---
  {
    files: ['functions/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: workerGlobals,
    },
    rules: commonRules,
  },

  // --- Тесты (vitest, окружение happy-dom) и скрипты сборки — Node ---
  {
    files: ['tests/**/*.{js,mjs}', 'e2e/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...browserGlobals, ...nodeGlobals },
    },
    rules: commonRules,
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...browserGlobals, ...nodeGlobals },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: tsRules,
  },
  {
    files: ['scripts/**/*.{js,mjs}', '*.config.{js,mjs}', 'playwright.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: nodeGlobals,
    },
    rules: commonRules,
  },

  // --- CommonJS-конфиги в корне (eslint.config.cjs, .prettierrc.cjs) ---
  {
    files: ['*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...nodeGlobals, module: 'writable', require: 'readonly', exports: 'writable' },
    },
    rules: commonRules,
  },
];
