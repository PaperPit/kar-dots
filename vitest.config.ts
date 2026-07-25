import { defineConfig } from 'vitest/config';

// Проект на TypeScript: исходники (.ts) импортируют друг друга с расширением
// .js (требование нативного ESM в браузере). Тесты же импортируют те же модули
// с расширением .ts. Без маппинга Vitest резолвит foo.ts и foo.js как ДВА
// разных модуля, из-за чего vi.spyOn/vi.mock на модуле не перехватывают
// реальные вызовы из кода. Маппим .ts -> .js, чтобы резолвился один модуль.
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      // Считаем исполняемые файлы: emit tsc (js/**/*.js), functions, extension src.
      // Тесты резолвят .ts→.js через alias — покрытие на .ts-исходниках было бы ~0%.
      include: [
        'js/**/*.js',
        'functions/**/*.js',
        'extension/src/**/*.ts',
      ],
      exclude: [
        'js/vendor/**',
        '**/node_modules/**',
        '**/*.d.ts',
        'js/**/*.test.js',
      ],
      // Честный пол чуть ниже текущей базы (~29% lines) — падаем при регрессии.
      thresholds: {
        lines: 28,
        functions: 50,
        statements: 28,
        branches: 60,
      },
    },
  },
  resolve: {
    alias: [
      { find: /^(.*)\.ts$/, replacement: '$1.js' },
    ],
  },
});
