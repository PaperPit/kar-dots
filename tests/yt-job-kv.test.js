import { describe, it, expect } from 'vitest';
import {
  isJobUserId,
  isJobUuid,
  makeJobKey,
  parseJobKey,
} from '../functions/api/_kv.js';

const UID = '11111111-1111-4111-8111-111111111111';
const JID = '22222222-2222-4222-8222-222222222222';

describe('yt job KV keys', () => {
  it('принимает UUID v4-подобные id', () => {
    expect(isJobUserId(UID)).toBe(true);
    expect(isJobUuid(JID)).toBe(true);
    expect(isJobUserId('not-a-uuid')).toBe(false);
    expect(isJobUserId('')).toBe(false);
  });

  it('makeJobKey собирает job:user:job', () => {
    expect(makeJobKey(UID, JID)).toBe(`job:${UID}:${JID}`);
  });

  it('parseJobKey разбирает ключ и отвергает чужой формат', () => {
    expect(parseJobKey(`job:${UID}:${JID}`)).toEqual({ userId: UID, jobId: JID });
    expect(parseJobKey(JID)).toBe(null);
    expect(parseJobKey(`job:${UID}`)).toBe(null);
    expect(parseJobKey(`job:evil/${UID}:${JID}`)).toBe(null);
  });

  it('makeJobKey не принимает мусор', () => {
    expect(() => makeJobKey('x', JID)).toThrow();
    expect(() => makeJobKey(UID, '../etc')).toThrow();
  });
});
