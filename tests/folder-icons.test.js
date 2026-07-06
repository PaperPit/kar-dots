import { describe, it, expect } from 'vitest';
import {
  FOLDER_ICONS,
  ICON_PICKER_BOTTOM,
  ALL_PICKER_ICONS,
  folderHasCustomIcon,
  normalizeFolderIcon,
  normalizeFolderRecord,
  folderIconSrc,
} from '../js/lib/folder-icons.js';

describe('folder-icons', () => {
  it('has 12 stock icons and 4 bottom-row icons', () => {
    expect(FOLDER_ICONS).toHaveLength(12);
    expect(ICON_PICKER_BOTTOM).toHaveLength(4);
    expect(ALL_PICKER_ICONS).toHaveLength(16);
  });

  it('null/unknown means letter swatch', () => {
    expect(normalizeFolderIcon(null)).toBe(null);
    expect(normalizeFolderIcon('feather')).toBe(null);
    expect(normalizeFolderIcon('globe')).toBe('globe');
    expect(folderHasCustomIcon('bulb')).toBe(true);
  });

  it('keeps missing icon as null on folder record', () => {
    const f = normalizeFolderRecord({ name: 'Test', color: '#000' });
    expect(f.icon).toBe(null);
  });

  it('returns png path for each icon', () => {
    for (const item of FOLDER_ICONS) {
      expect(folderIconSrc(item.id)).toBe('icons/folders/' + item.id + '.png');
    }
    expect(folderIconSrc(null)).toBe('');
  });
});
