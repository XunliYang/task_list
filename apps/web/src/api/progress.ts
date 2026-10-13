import { useQuery } from '@tanstack/react-query';
import type { RecentProgressEntry } from '@task-list/shared';
import { http } from './client';
import { progressKeys } from './query-keys';

/**
 * 跨任务最近进展（侧栏「动态」数据源）。
 *
 * 消费只读聚合端点 `GET /api/progress?limit=N`（REST 与 LocalStore 双实现），
 * 返回按 `at` 倒序的最近进展，含联出的 `taskTitle` 供展示与跳转详情。
 */
export function useRecentProgress(limit = 10) {
  return useQuery({
    queryKey: progressKeys.list(limit),
    queryFn: () => http.get<RecentProgressEntry[]>(`/progress?limit=${limit}`),
  });
}
