import { describe, it, expect } from 'vitest';
import {
  isJobUuid,
  isSubject,
  makeJobKey,
  parseJobKey,
  stripJobSecrets,
} from '../functions/api/_kv.js';

const SUBJ = 'u:11111111-1111-4111-8111-111111111111';
const ANON = 'anon:' + 'a'.repeat(64);
const JID = '22222222-2222-4222-8222-222222222222';

describe('yt job KV keys', () => {
  it('принимает только субъекты из middleware', () => {
    expect(isSubject(SUBJ)).toBe(true);
    expect(isSubject(ANON)).toBe(true);
    expect(isJobUuid(JID)).toBe(true);
    // голый userId с клиента больше не субъект
    expect(isSubject('11111111-1111-4111-8111-111111111111')).toBe(false);
    expect(isSubject('anon:short')).toBe(false);
    expect(isSubject('u:has spaces')).toBe(false);
    expect(isSubject('')).toBe(false);
  });

  it('makeJobKey собирает job:subject:job', () => {
    expect(makeJobKey(SUBJ, JID)).toBe(`job:${SUBJ}:${JID}`);
    expect(makeJobKey(ANON, JID)).toBe(`job:${ANON}:${JID}`);
  });

  it('parseJobKey разбирает ключ и отвергает чужой формат', () => {
    expect(parseJobKey(`job:${SUBJ}:${JID}`)).toEqual({ subject: SUBJ, jobId: JID });
    expect(parseJobKey(`job:${ANON}:${JID}`)).toEqual({ subject: ANON, jobId: JID });
    expect(parseJobKey(JID)).toBe(null);
    expect(parseJobKey(`job:${SUBJ}`)).toBe(null);
    expect(parseJobKey(`job:evil/${SUBJ}:${JID}`)).toBe(null);
    expect(parseJobKey(`job:11111111-1111-4111-8111-111111111111:${JID}`)).toBe(null);
  });

  it('makeJobKey не принимает мусор', () => {
    expect(() => makeJobKey('x', JID)).toThrow();
    expect(() => makeJobKey(SUBJ, '../etc')).toThrow();
    // без префикса u:/anon: ключ собрать нельзя
    expect(() => makeJobKey('11111111-1111-4111-8111-111111111111', JID)).toThrow();
  });

  it('stripJobSecrets убирает ключ Supadata из записи', () => {
    const job = { status: 'pending', subject: SUBJ, apiKey: 'sd_secret', video: { videoId: 'x' } };
    const clean = stripJobSecrets(job);
    expect(clean.apiKey).toBeUndefined();
    expect(clean.status).toBe('pending');
    expect(clean.video).toEqual({ videoId: 'x' });
    // исходную запись не мутируем
    expect(job.apiKey).toBe('sd_secret');
  });
});
