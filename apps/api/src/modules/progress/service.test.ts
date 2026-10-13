import { describe, expect, it } from 'vitest';
import type { DataSnapshot, ProgressEntry, Task } from '@task-list/shared';
import { createSeedSnapshot } from '../../store/seed';
import { DEFAULT_PROGRESS_LIMIT, listRecentProgress } from './service';

function makeTask(id: string, title: string): Task {
  return {
    id,
    title,
    company: null,
    statusId: 'status-todo',
    tags: [],
    stages: [],
    currentStageId: null,
    notes: '',
    jobApplication: null,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  };
}

function makeEntry(id: string, taskId: string, at: string, summary: string): ProgressEntry {
  return { id, taskId, at, summary, stageId: null };
}

function snapshotWith(entries: ProgressEntry[], tasks: Task[]): DataSnapshot {
  return { ...createSeedSnapshot(), tasks, progressEntries: entries };
}

describe('listRecentProgress（GET /api/progress 聚合纯函数）', () => {
  it('跨任务按 at 倒序聚合并联出 taskTitle', () => {
    const snapshot = snapshotWith(
      [
        makeEntry('p1', 't1', '2026-09-01T00:00:00Z', '早'),
        makeEntry('p2', 't2', '2026-09-03T00:00:00Z', '中'),
        makeEntry('p3', 't1', '2026-09-05T00:00:00Z', '晚'),
      ],
      [makeTask('t1', '甲'), makeTask('t2', '乙')],
    );

    const list = listRecentProgress(snapshot);
    expect(list.map((e) => e.summary)).toEqual(['晚', '中', '早']);
    expect(list.map((e) => e.taskTitle)).toEqual(['甲', '乙', '甲']);
    expect(list[0]).toMatchObject({ id: 'p3', taskId: 't1', stageId: null });
  });

  it('按 limit 切片', () => {
    const snapshot = snapshotWith(
      [
        makeEntry('p1', 't1', '2026-09-01T00:00:00Z', 'a'),
        makeEntry('p2', 't1', '2026-09-02T00:00:00Z', 'b'),
        makeEntry('p3', 't1', '2026-09-03T00:00:00Z', 'c'),
      ],
      [makeTask('t1', '甲')],
    );

    expect(listRecentProgress(snapshot, 2).map((e) => e.summary)).toEqual(['c', 'b']);
  });

  it('孤儿条目（task 已删）被过滤', () => {
    const snapshot = snapshotWith(
      [
        makeEntry('p1', 't1', '2026-09-01T00:00:00Z', '有主'),
        makeEntry('p2', 't-gone', '2026-09-02T00:00:00Z', '孤儿'),
      ],
      [makeTask('t1', '甲')],
    );

    expect(listRecentProgress(snapshot).map((e) => e.summary)).toEqual(['有主']);
  });

  it('缺省 limit 返回前 DEFAULT_PROGRESS_LIMIT 条', () => {
    const entries = Array.from({ length: DEFAULT_PROGRESS_LIMIT + 3 }, (_, i) =>
      makeEntry(`p${i}`, 't1', `2026-09-${String(i + 1).padStart(2, '0')}T00:00:00Z`, `s${i}`),
    );
    const snapshot = snapshotWith(entries, [makeTask('t1', '甲')]);

    expect(listRecentProgress(snapshot)).toHaveLength(DEFAULT_PROGRESS_LIMIT);
    // 最新一条（at 最大）在最前。
    expect(listRecentProgress(snapshot)[0].summary).toBe(`s${entries.length - 1}`);
  });
});