import { describe, it, expect } from 'vitest';
import {
  parseCueTime, parseSrt, parseVtt, parseCaptionFile,
} from '../js/lib/yt-caption-parsers.js';

describe('parseCueTime', () => {
  it('понимает SRT и VTT форматы', () => {
    expect(parseCueTime('00:01:23,456')).toBe(83);
    expect(parseCueTime('01:23.456')).toBe(83);
    expect(parseCueTime('1:02:03.000')).toBe(3723);
    expect(parseCueTime('00:04,000')).toBe(4);
  });
});

describe('parseSrt', () => {
  it('достаёт сегменты с таймкодами', () => {
    const srt = `1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,000 --> 00:00:07,000
Second line
part two`;
    const { segments } = parseSrt(srt);
    expect(segments).toEqual([
      { t: 1, text: 'Hello world' },
      { t: 5, text: 'Second line part two' },
    ]);
  });
});

describe('parseVtt', () => {
  it('пропускает заголовок WEBVTT', () => {
    const vtt = `WEBVTT
Language: en

00:01.000 --> 00:04.000
Hello <c>world</c>

NOTE
ignored`;
    const { lang, segments } = parseVtt(vtt);
    expect(lang).toBe('en');
    expect(segments).toEqual([{ t: 1, text: 'Hello world' }]);
  });
});

describe('parseCaptionFile', () => {
  it('определяет формат по расширению и lang из имени', () => {
    const srt = `1
00:00:10,000 --> 00:00:12,000
Test`;
    const out = parseCaptionFile(srt, 'video.en.srt');
    expect(out.lang).toBe('en');
    expect(out.segments[0].text).toBe('Test');
  });

  it('распознаёт VTT без расширения по заголовку', () => {
    const vtt = `WEBVTT\n\n00:02.000 --> 00:03.000\nHi`;
    const out = parseCaptionFile(vtt, 'subs.txt');
    expect(out.segments).toEqual([{ t: 2, text: 'Hi' }]);
  });
});
