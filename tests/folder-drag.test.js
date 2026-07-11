import { describe, it, expect, vi, afterEach } from 'vitest';
import { folderDragEnabled } from '../js/ui/folder-drag.js';

describe('folderDragEnabled', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is true for fine pointer with hover', () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: true })),
    });
    expect(folderDragEnabled()).toBe(true);
  });

  it('is false for touch-only devices', () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: false })),
    });
    expect(folderDragEnabled()).toBe(false);
  });
});
