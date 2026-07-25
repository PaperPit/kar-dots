import { describe, it, expect } from 'vitest';
import {
  isCuratedMessage,
  isTimeoutError,
  safeUpstreamMessage,
} from '../functions/api/lib/_errors.js';

// Форматтеры из js/lib либо распознают случай и дают свой русский текст,
// либо просто обрезают сырой ответ апстрима — второе наружу отдавать нельзя.
// Здесь оба поведения воспроизведены строками, без импорта js/lib.
function curatedFormatter(raw) {
  return /api key not valid/i.test(raw)
    ? 'Неверный Gemini API ключ — создай новый в Google AI Studio'
    : raw.length > 140
      ? raw.slice(0, 137) + '…'
      : raw;
}

describe('isTimeoutError', () => {
  it('узнаёт AbortSignal.timeout и ручной abort', () => {
    expect(isTimeoutError({ name: 'TimeoutError' })).toBe(true);
    expect(isTimeoutError({ name: 'AbortError' })).toBe(true);
    expect(isTimeoutError(new TypeError('network'))).toBe(false);
    expect(isTimeoutError(null)).toBe(false);
  });
});

describe('safeUpstreamMessage', () => {
  it('оставляет наш распознанный текст', () => {
    const raw = 'API key not valid. Please pass a valid API key.';
    const formatted = curatedFormatter(raw);
    expect(isCuratedMessage(formatted, raw)).toBe(true);
    expect(safeUpstreamMessage(formatted, raw, 'общий текст')).toBe(formatted);
  });

  it('не отдаёт наружу сырой ответ апстрима', () => {
    const raw = 'Internal error at 10.0.0.7: project 12345 quota_user leaked';
    const formatted = curatedFormatter(raw);
    // форматтер такой случай не распознал и вернул сам текст апстрима
    expect(isCuratedMessage(formatted, raw)).toBe(false);
    expect(safeUpstreamMessage(formatted, raw, 'Gemini недоступен')).toBe('Gemini недоступен');
  });

  it('обрезанное эхо апстрима тоже считается небезопасным', () => {
    const raw = 'x'.repeat(400);
    const formatted = raw.slice(0, 137) + '…';
    expect(isCuratedMessage(formatted, raw)).toBe(false);
    expect(safeUpstreamMessage(formatted, raw, 'общий текст')).toBe('общий текст');
  });

  it('пустой ответ апстрима — берём текст форматтера', () => {
    expect(safeUpstreamMessage('Квота Gemini исчерпана', '', 'общий текст')).toBe('Квота Gemini исчерпана');
    expect(safeUpstreamMessage('', 'что-то', 'общий текст')).toBe('общий текст');
  });
});
