import type { DataSnapshot } from '@task-list/shared';

/**
 * 默认状态分类种子数据。
 *
 * 首次启动（`data/store.json` 不存在）时写入这三个分类。
 * id 保持稳定，便于验收脚本直接引用（如 `<seed id>`）。
 */
export function createSeedSnapshot(): DataSnapshot {
  return {
    version: 1,
    tasks: [],
    statusCategories: [
      { id: 'status-todo', name: '待开始', color: '#9e9e9e', order: 0 },
      { id: 'status-in-progress', name: '进行中', color: '#1976d2', order: 1 },
      { id: 'status-done', name: '已完成', color: '#388e3c', order: 2 },
    ],
    progressEntries: [],
    examInfos: [],
  };
}