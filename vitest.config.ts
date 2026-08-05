import { defineConfig } from 'vitest/config';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Резолв .js → .ts когда рядом есть исходник. Так тесты и прод-импорты
 * (с расширением .js) попадают в один модуль — моки и coverage работают
 * на TypeScript-источниках. Vendor/config остаются как есть.
 */
function resolveJsToTs() {
  return {
    name: 'kar-js-to-ts',
    enforce: 'pre' as const,
    async resolveId(source: string, importer: string | undefined) {
      if (!importer || !source.endsWith('.js') || source.endsWith('.mjs')) return null;
      if (source.includes('/vendor/') || /(?:^|\/)config(?:\.example)?\.js$/.test(source)) {
        return null;
      }
      const abs = path.resolve(path.dirname(importer), source);
      const asTs = abs.replace(/\.js$/, '.ts');
      if (fs.existsSync(asTs)) return asTs;
      return null;
    },
  };
}

export default defineConfig({
  plugins: [resolveJsToTs()],
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'js/data/store-cloud.ts',
        'js/screens/review/session.ts',
        'js/screens/review/grading.ts',
      ],
      thresholds: {
        // session.ts heavily UI-bound; gate on grading + cloud store instead.
        'js/data/store-cloud.ts': {
          lines: 40,
          functions: 40,
          statements: 40,
        },
        'js/screens/review/grading.ts': {
          lines: 35,
          functions: 40,
          statements: 35,
        },
      },
    },
  },
});
