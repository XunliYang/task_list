import type { DataSnapshot, RecentProgressEntry } from '@task-list/shared';

/** GET /api/progress 的缺省返回条数。 */
export const DEFAULT_PROGRESS_LIMIT = 10;

/**
 * 跨任务聚合最近进展：按 `at` 倒序取前 `limit` 条，联出 `taskTitle`。
 *
 * - 与 LocalStore 的同一实现对齐（见 apps/web/src/api/local-store.ts 的 `listRecentProgress`）。
 * - 孤儿条目（task 已被删除）不会被返回——任务删除会级联清掉其 progressEntries，
 *   此处仍按 taskId 联表作为兜底防御。
 */
export function listRecentProgress(
  snapshot: DataSnapshot,
  limit: number = DEFAULT_PROGRESS_LIMIT,
): RecentProgressEntry[] {
  const titleById = new Map(snapshot.tasks.map((task) => [task.id, task.title]));

  return snapshot.progressEntries
    .filter((entry) => titleById.has(entry.taskId))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
    .map((entry) => ({
      id: entry.id,
      taskId: entry.taskId,
      taskTitle: titleById.get(entry.taskId) as string,
      at: entry.at,
      summary: entry.summary,
      stageId: entry.stageId,
    }));
}