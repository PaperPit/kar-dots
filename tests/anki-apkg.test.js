// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from '../js/vendor/fflate.mjs';
import initSqlJs from '../js/vendor/sql-asm.mjs';
import { parseApkg } from '../js/lib/anki-apkg.ts';

const FIELD_SEP = '\x1f';

async function buildMinimalApkg({
  notes = [
    { id: 1, mid: 1, fields: ['Hello', 'Привет'] },
    { id: 2, mid: 1, fields: ['World', 'Мир'] },
  ],
  deckName = 'English Basics',
  fieldNames = ['Front', 'Back'],
} = {}) {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE col (
      id integer primary key, crt integer not null, mod integer not null,
      scm integer not null, ver integer not null, dty integer not null,
      usn integer not null, ls integer not null, conf text not null,
      models text not null, decks text not null, dconf text not null, tags text not null
    );
    CREATE TABLE notes (
      id integer primary key, guid text not null, mid integer not null,
      mod integer not null, usn integer not null, tags text not null,
      flds text not null, sfld text not null, csum integer not null,
      flags integer not null, data text not null
    );
    CREATE TABLE cards (
      id integer primary key, nid integer not null, did integer not null,
      ord integer not null, mod integer not null, usn integer not null,
      type integer not null, queue integer not null, due integer not null,
      ivl integer not null, factor integer not null, reps integer not null,
      lapses integer not null, left integer not null, odue integer not null,
      odid integer not null, flags integer not null, data text not null
    );
  `);

  const models = {
    1: {
      id: 1,
      name: 'Basic',
      flds: fieldNames.map((name, ord) => ({ name, ord })),
    },
  };
  const decks = {
    1: { id: 1, name: deckName },
  };

  db.run(
    `INSERT INTO col VALUES (1,0,0,0,11,0,0,0,'{}',?,?, '{}','{}')`,
    [JSON.stringify(models), JSON.stringify(decks)],
  );

  let cardId = 1;
  for (const n of notes) {
    const flds = n.fields.join(FIELD_SEP);
    db.run(
      `INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [n.id, `g${n.id}`, n.mid, 0, 0, '', flds, n.fields[0] || '', 0, 0, ''],
    );
    db.run(
      `INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [cardId++, n.id, 1, 0, 0, 0, 0, 0, 0, 0, 2500, 0, 0, 0, 0, 0, 0, ''],
    );
  }

  const exported = db.export();
  db.close();
  return zipSync({ 'collection.anki2': exported });
}

describe('parseApkg', () => {
  it('maps Front/Back notes into a named deck', async () => {
    const apkg = await buildMinimalApkg();
    const result = await parseApkg(apkg);
    expect(result.skippedNotes).toBe(0);
    expect(result.decks).toHaveLength(1);
    expect(result.decks[0].name).toBe('English Basics');
    expect(result.decks[0].cards).toEqual([
      { front: 'Hello', back: 'Привет' },
      { front: 'World', back: 'Мир' },
    ]);
  });

  it('falls back to first two fields when names are not Front/Back', async () => {
    const apkg = await buildMinimalApkg({
      fieldNames: ['Term', 'Definition'],
      notes: [{ id: 1, mid: 1, fields: ['cat', 'кот'] }],
      deckName: 'Animals',
    });
    const result = await parseApkg(apkg);
    expect(result.decks[0].cards).toEqual([{ front: 'cat', back: 'кот' }]);
  });

  it('rejects non-zip input', async () => {
    await expect(parseApkg(strToU8('not-a-zip'))).rejects.toThrow(/valid \.apkg/i);
  });
});
