import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isVocabPackFolder } from '../js/lib/vocab-packs.js';

const packsDir = resolve(import.meta.dirname, '../packs');

describe('vocab packs', () => {
  it('manifest lists CEFR packs and phrases', () => {
    const manifest = JSON.parse(readFileSync(resolve(packsDir, 'manifest.json'), 'utf8'));
    expect(manifest.packs).toHaveLength(4);
    const ids = manifest.packs.map(p => p.id);
    expect(ids).toContain('en-a0-starters');
    expect(ids).toContain('en-a1-oxford');
    expect(ids).toContain('en-a2-oxford');
    expect(ids).toContain('en-phrases-a0-a2');
  });

  it('each pack file has cards with front and back', () => {
    const manifest = JSON.parse(readFileSync(resolve(packsDir, 'manifest.json'), 'utf8'));
    for (const meta of manifest.packs) {
      const pack = JSON.parse(readFileSync(resolve(packsDir, meta.file), 'utf8'));
      expect(pack.cards.length).toBe(meta.cardCount);
      expect(pack.cards[0].front).toBeTruthy();
      expect(pack.cards[0].back).toBeTruthy();
    }
  });

  it('key translations use sensible variants', () => {
    const pack = JSON.parse(readFileSync(resolve(packsDir, 'en-a1-oxford.json'), 'utf8'));
    const byFront = Object.fromEntries(pack.cards.map(c => [`${c.front}|${c.description}`, c.back]));
    expect(byFront['fire|A1 · noun']).toMatch(/огонь/);
    expect(byFront['fire|A1 · noun']).not.toMatch(/воспламеняться/i);
    expect(byFront['fifth|A1 · ordinal number']).toBe('пятый');
    expect(byFront['be|A1 · verb, auxiliary verb']).toBe('быть');
    expect(byFront['and|A1 · conjunction']).toMatch(/и/);
    expect(byFront['egg|A1 · noun']).toBe('яйцо');
    expect(byFront['action|A1 · noun']).toMatch(/действие/);
    expect(byFront['egg|A1 · noun']).not.toMatch(/граната/i);
    expect(byFront['be|A1 · verb, auxiliary verb']).not.toMatch(/бuti/i);
    expect(byFront['will|A1 · modal verb']).toMatch(/модальный|буду|будет/);
    expect(byFront['will|A1 · modal verb']).not.toMatch(/завещание|волеизъявление/i);
    expect(pack.cards.some(c => c.front === 'a')).toBe(false);
    expect(pack.cards.some(c => c.front === 'the')).toBe(false);
  });

  it('A0 pack has one card per word (no POS duplicates)', () => {
    const pack = JSON.parse(readFileSync(resolve(packsDir, 'en-a0-starters.json'), 'utf8'));
    const fronts = pack.cards.map(c => c.front);
    expect(new Set(fronts).size).toBe(fronts.length);
    expect(pack.cardCount).toBe(450);
    for (const card of pack.cards) {
      const n = card.back.split(' / ').length;
      expect(n, `${card.front} has ${n} variants`).toBeLessThanOrEqual(3);
    }
    const near = pack.cards.find(c => c.front === 'near');
    expect(near).toBeTruthy();
    expect(near.back).toMatch(/близк|около|рядом/);
    expect(pack.cards.filter(c => c.front === 'near')).toHaveLength(1);
    const much = pack.cards.find(c => c.front === 'much');
    expect(much.back).toMatch(/много/);
    expect(much.back).not.toMatch(/шибко/i);
    expect(pack.cards.filter(c => c.front === 'much')).toHaveLength(1);
    expect(pack.cards.some(c => c.front === 'a')).toBe(false);
    expect(pack.cards.some(c => c.front === 'the')).toBe(false);
  });

  it('no card has more than 3 translation variants', () => {
    const manifest = JSON.parse(readFileSync(resolve(packsDir, 'manifest.json'), 'utf8'));
    for (const meta of manifest.packs) {
      const pack = JSON.parse(readFileSync(resolve(packsDir, meta.file), 'utf8'));
      for (const card of pack.cards) {
        expect(card.back.split(' / ').length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('isVocabPackFolder', () => {
    expect(isVocabPackFolder({ pack_id: 'en-a1-oxford' })).toBe(true);
    expect(isVocabPackFolder({ name: 'Test' })).toBe(false);
  });
});
