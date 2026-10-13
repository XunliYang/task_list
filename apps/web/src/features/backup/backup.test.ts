import { describe, expect, it } from 'vitest';
import { buildBackupFilename } from './backup';

describe('buildBackupFilename', () => {
  it('用本地日期拼出 task-list-backup-YYYY-MM-DD.json', () => {
    expect(buildBackupFilename(new Date(2026, 0, 5))).toBe('task-list-backup-2026-01-05.json');
    expect(buildBackupFilename(new Date(2026, 9, 8))).toBe('task-list-backup-2026-10-08.json');
  });

  it('月份/日期补零', () => {
    expect(buildBackupFilename(new Date(2026, 10, 3))).toBe('task-list-backup-2026-11-03.json');
  });
});
