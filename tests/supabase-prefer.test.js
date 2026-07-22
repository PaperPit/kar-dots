// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MiniSupabase } from '../js/data/supabase.ts';

describe('MiniSupabase Prefer: return=minimal', () => {
  let sb;
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    sb = new MiniSupabase('https://example.supabase.co', 'anon');
    sb.session = {
      access_token: 'tok',
      expires_at_ms: Date.now() + 3_600_000,
      user: { id: 'u1' },
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function preferHeader() {
    const opts = fetchMock.mock.calls[0][1];
    return opts.headers.Prefer || opts.headers.prefer;
  }

  it('insert uses return=minimal', async () => {
    await sb.insert('cards', { id: 'c1' });
    expect(preferHeader()).toBe('return=minimal');
  });

  it('update uses return=minimal', async () => {
    await sb.update('cards', 'id=eq.c1', { front: 'x' });
    expect(preferHeader()).toBe('return=minimal');
  });

  it('upsert uses return=minimal with merge-duplicates', async () => {
    await sb.upsert('settings', { user_id: 'u1', data: {} }, { onConflict: 'user_id' });
    expect(preferHeader()).toBe('return=minimal,resolution=merge-duplicates');
    expect(String(fetchMock.mock.calls[0][0])).toContain('on_conflict=user_id');
  });
});
