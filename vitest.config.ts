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
  },
  resolve: {
    alias: [
      { find: /^(.*)\.ts$/, replacement: '$1.js' },
    ],
  },
});
