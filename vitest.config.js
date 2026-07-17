import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/_backup_alt_youtube_impl/**',
      '**/e2e/**',
    ],
  },
});
