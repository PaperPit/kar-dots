import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  REQUIRED_SCHEMA_VERSION, fetchSchemaVersion, schemaOutdatedMessage,
} from '../js/data/schema-version.ts';

afterEach(() => { vi.unstubAllGlobals(); });

describe('fetchSchemaVersion', () => {
  it('reads version from schema_meta row', async () => {
    const sb = { select: vi.fn(async () => [{ version: 3 }]) };
    expect(await fetchSchemaVersion(sb)).toBe(3);
    expect(sb.select).toHaveBeenCalledWith('schema_meta', 'select=version&id=eq.1');
  });

  it('returns 0 when table/row is missing', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const sb = {
      select: vi.fn(async () => {
        throw new Error("Could not find the table 'public.schema_meta' in the schema cache");
      }),
    };
    expect(await fetchSchemaVersion(sb)).toBe(0);
  });

  it('returns 0 for empty result', async () => {
    const sb = { select: vi.fn(async () => []) };
    expect(await fetchSchemaVersion(sb)).toBe(0);
  });

  it('rethrows network errors', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const sb = { select: vi.fn(async () => { throw new Error('Failed to fetch'); }) };
    await expect(fetchSchemaVersion(sb)).rejects.toThrow(/fetch/i);
  });
});

describe('schemaOutdatedMessage', () => {
  it('returns null when current is up to date', () => {
    expect(schemaOutdatedMessage(REQUIRED_SCHEMA_VERSION)).toBeNull();
    expect(schemaOutdatedMessage(REQUIRED_SCHEMA_VERSION + 1)).toBeNull();
  });

  it('names a range for multiple missing migrations', () => {
    const msg = schemaOutdatedMessage(1, 4);
    expect(msg).toContain('миграции 2–4');
    expect(msg).toContain('supabase/migrations');
  });

  it('names a single missing migration', () => {
    const msg = schemaOutdatedMessage(3, 4);
    expect(msg).toContain('миграцию 4');
  });

  it('handles version 0 (no migrations yet)', () => {
    const msg = schemaOutdatedMessage(0, 4);
    expect(msg).toContain('миграции 1–4');
  });
});
