// @vitest-environment node

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertPrecacheInDist,
  buildPrecacheFromDist,
  buildPrecacheFromSources,
  isBundleLazyJs,
  parseCoreFiles,
  PRECACHE_FONTS,
  renderBundleSw,
} from '../scripts/lib/sw-precache.mjs';

describe('sw-precache: orphan trap', () => {
  it('assertPrecacheInDist fails when CORE_FILES path is missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-precache-'));
    try {
      fs.writeFileSync(path.join(dir, 'index.html'), '<html></html>');
      const sw = renderBundleSw({
        version: 'test',
        coreFiles: ['index.html', 'js/orphan-deleted.js'],
      });
      const result = assertPrecacheInDist(sw, dir);
      expect(result.ok).toBe(false);
      expect(result.missing).toContain('js/orphan-deleted.js');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('buildPrecacheFromDist only lists files that exist under dist/', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-dist-'));
    try {
      fs.mkdirSync(path.join(dir, 'js'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), '');
      fs.writeFileSync(path.join(dir, 'manifest.webmanifest'), '{}');
      fs.mkdirSync(path.join(dir, 'packs'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'packs', 'manifest.json'), '{}');
      fs.writeFileSync(path.join(dir, 'js', 'app.js'), '');
      const list = buildPrecacheFromDist(dir);
      expect(list).toContain('js/app.js');
      expect(list).not.toContain('js/ghost.js');
      const sw = renderBundleSw({ version: 't', coreFiles: list });
      expect(assertPrecacheInDist(sw, dir).ok).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('buildPrecacheFromDist excludes screen-entry chunks and non-whitelisted fonts', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-dist-lazy-'));
    try {
      fs.mkdirSync(path.join(dir, 'js'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'css', 'fonts'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), '');
      fs.writeFileSync(path.join(dir, 'manifest.webmanifest'), '{}');
      fs.mkdirSync(path.join(dir, 'packs'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'packs', 'manifest.json'), '{}');
      fs.writeFileSync(path.join(dir, 'js', 'app.js'), '');
      fs.writeFileSync(path.join(dir, 'js', 'chunk-ABCDEF12.js'), '');
      fs.writeFileSync(path.join(dir, 'js', 'review-LYAMFKAN.js'), '');
      fs.writeFileSync(path.join(dir, 'js', 'fsrs-engine-GCVKCI4T.js'), '');
      fs.writeFileSync(path.join(dir, 'css', 'fonts', 'nunito-cyr.woff2'), '');
      fs.writeFileSync(path.join(dir, 'css', 'fonts', 'baloo2-deva.woff2'), '');
      const list = buildPrecacheFromDist(dir);
      expect(list).toContain('js/app.js');
      expect(list).toContain('js/chunk-ABCDEF12.js');
      expect(list).toContain('css/fonts/nunito-cyr.woff2');
      expect(list).not.toContain('js/review-LYAMFKAN.js');
      expect(list).not.toContain('js/fsrs-engine-GCVKCI4T.js');
      expect(list).not.toContain('css/fonts/baloo2-deva.woff2');
      expect(isBundleLazyJs('js/review-LYAMFKAN.js')).toBe(true);
      expect(PRECACHE_FONTS.has('css/fonts/baloo2-deva.woff2')).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('buildPrecacheFromSources maps .ts → .js and ignores orphan .js without .ts', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-src-'));
    try {
      fs.mkdirSync(path.join(dir, 'js', 'lib'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'css'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'icons'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'js', 'lib', 'alive.ts'), 'export {}');
      // Orphan compiled file without source — must NOT appear
      fs.writeFileSync(path.join(dir, 'js', 'lib', 'dead-orphan.js'), 'export {}');
      fs.writeFileSync(path.join(dir, 'css', 'style.css'), '');
      const list = buildPrecacheFromSources(dir);
      expect(list).toContain('js/lib/alive.js');
      expect(list).not.toContain('js/lib/dead-orphan.js');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('parseCoreFiles extracts quoted paths', () => {
    expect(parseCoreFiles("const CORE_FILES = [\n  'a.js',\n  'b.css',\n];")).toEqual([
      'a.js',
      'b.css',
    ]);
  });
});
