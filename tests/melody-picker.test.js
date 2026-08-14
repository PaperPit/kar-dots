import { describe, expect, it, vi } from 'vitest';
import { melodyPickerField } from '../js/ui/melody-picker.js';

const melodies = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
];

function makePicker(label) {
  return melodyPickerField({
    label,
    value: 'a',
    melodies,
    onChange: vi.fn(),
    play: vi.fn(),
  });
}

describe('melodyPickerField', () => {
  it('closes the first menu when a second picker opens', () => {
    const first = makePicker('First');
    const second = makePicker('Second');
    document.body.append(first, second);

    first.querySelector('.melody-picker-trigger').click();
    expect(first.classList.contains('is-open')).toBe(true);
    expect(first.querySelector('.melody-picker-menu').hidden).toBe(false);

    second.querySelector('.melody-picker-trigger').click();
    expect(second.classList.contains('is-open')).toBe(true);
    expect(first.classList.contains('is-open')).toBe(false);
    expect(first.querySelector('.melody-picker-menu').hidden).toBe(true);

    first.destroy();
    second.destroy();
    first.remove();
    second.remove();
  });
});
