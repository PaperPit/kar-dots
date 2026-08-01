import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('prod bundle includes audio assets', () => {
  it('bundle.mjs copies audio/ into dist/', () => {
    const src = fs.readFileSync(
      path.resolve('scripts/bundle.mjs'),
      'utf8'
    );
    expect(src).toMatch(/cpDir\(\s*path\.join\(ROOT,\s*'audio'\)/);
    expect(src).toMatch(/path\.join\(DIST,\s*'audio'\)/);
  });

  it('source audio/ui click files exist', () => {
    for (const name of ['system-click.mp3', 'click-soft.mp3', 'click-crisp.mp3']) {
      expect(fs.existsSync(path.resolve('audio/ui', name))).toBe(true);
    }
  });
});
