import { describe, it, expect } from 'vitest';
import { folderSaveErrorMessage, isMissingFolderIconColumnError, isMissingBoxesTableError } from '../js/lib/folder-errors.ts';

describe('folder-errors', () => {
  it('detects missing icon column', () => {
    const err = new Error("Could not find the 'icon' column of 'folders' in the schema cache");
    expect(isMissingFolderIconColumnError(err)).toBe(true);
  });

  it('detects missing boxes table', () => {
    const err = new Error("Could not find the table 'public.boxes' in the schema cache");
    expect(isMissingBoxesTableError(err)).toBe(true);
  });

  it('returns SQL hint for icon column error', () => {
    const err = new Error("Could not find the 'icon' column of 'folders' in the schema cache");
    expect(folderSaveErrorMessage(err)).toContain('alter table public.folders');
  });

  it('returns SQL hint for boxes table error', () => {
    const err = new Error("Could not find the table 'public.boxes' in the schema cache");
    expect(folderSaveErrorMessage(err)).toContain('supabase-boxes.sql');
  });

  it('returns SQL hint for box icon column error', () => {
    const err = new Error("Could not find the 'icon' column of 'boxes' in the schema cache");
    expect(folderSaveErrorMessage(err)).toContain('public.boxes');
  });

  it('passes through other errors', () => {
    expect(folderSaveErrorMessage(new Error('Сеть недоступна'))).toBe('Сеть недоступна');
  });
});
