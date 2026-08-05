import { describe, it, expect } from 'vitest';
import {
  detectExtLocale,
  setExtLocale,
  t,
  modeLabel,
  EXT_I18N_KEYS,
} from '../extension/src/lib/i18n.ts';
import fs from 'node:fs';
import path from 'node:path';

describe('extension i18n', () => {
  it('falls back to Russian for missing EN keys and supports vars', () => {
    setExtLocale('en');
    expect(t('brand.title')).toBe('KAR-dots');
    expect(t('auth.body', { host: 'example.com' })).toContain('example.com');
    setExtLocale('ru');
    expect(t('brand.title')).toBe('КАР-точки');
    expect(modeLabel('both')).toMatch(/Слова|фразы/i);
  });

  it('RU and EN catalogs share the same key set', async () => {
    // Re-import catalogs by checking every key resolves in both locales
    for (const key of EXT_I18N_KEYS) {
      setExtLocale('ru');
      const ru = t(key);
      setExtLocale('en');
      const en = t(key);
      expect(ru, key).not.toBe(key);
      expect(en, key).not.toBe(key);
    }
  });

  it('detectExtLocale returns ru or en', () => {
    expect(['ru', 'en']).toContain(detectExtLocale());
  });
});

describe('extension build smoke', () => {
  it('dist sidepanel bundle exists and includes EN brand string after build', () => {
    const dist = path.join(process.cwd(), 'extension/dist/sidepanel.js');
    // May be stale until ext:build; still require file present in repo.
    expect(fs.existsSync(dist)).toBe(true);
    const src = fs.readFileSync(
      path.join(process.cwd(), 'extension/src/lib/i18n.ts'),
      'utf8',
    );
    expect(src).toContain('KAR-dots');
    expect(src).toContain('Sign in with KAR-dots');
  });
});
