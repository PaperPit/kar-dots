// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { shouldStartVoiceFromSpace } from '../js/lib/voice-keyboard.js';

function spaceEvent(target, { repeat = false } = {}) {
  return { key: ' ', code: 'Space', repeat, target };
}

describe('shouldStartVoiceFromSpace', () => {
  it('allows space on voice card body', () => {
    const box = document.createElement('div');
    box.className = 'study-voice-card';
    document.body.append(box);
    expect(shouldStartVoiceFromSpace(spaceEvent(box), box)).toBe(true);
    box.remove();
  });

  it('blocks key repeat', () => {
    const box = document.createElement('div');
    document.body.append(box);
    expect(shouldStartVoiceFromSpace(spaceEvent(box, { repeat: true }), box)).toBe(false);
    box.remove();
  });

  it('blocks space on header icon buttons', () => {
    const box = document.createElement('div');
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    document.body.append(box, btn);
    expect(shouldStartVoiceFromSpace(spaceEvent(btn), box)).toBe(false);
    box.remove();
    btn.remove();
  });

  it('blocks space on «Не знаю» inside voice card', () => {
    const box = document.createElement('div');
    const skip = document.createElement('button');
    skip.className = 'btn ghost';
    box.append(skip);
    document.body.append(box);
    expect(shouldStartVoiceFromSpace(spaceEvent(skip), box)).toBe(false);
    box.remove();
  });

  it('allows space on mic button inside voice card', () => {
    const box = document.createElement('div');
    const mic = document.createElement('button');
    mic.className = 'btn accent study-mic-btn';
    box.append(mic);
    document.body.append(box);
    expect(shouldStartVoiceFromSpace(spaceEvent(mic), box)).toBe(true);
    box.remove();
  });
});
