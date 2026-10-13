/**
 * TanStack Query key 工厂：每个资源的 query key 唯一出处，
 * 失效（invalidate）时按「父级前缀可一次命中整组」的方式组织。
 */

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: unknown = {}) => [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
  progress: (id: string) => [...taskKeys.all, 'progress', id] as const,
};

export const statusKeys = {
  all: ['statuses'] as const,
  lists: () => [...statusKeys.all, 'list'] as const,
};

export const examKeys = {
  all: ['exams'] as const,
  lists: () => [...examKeys.all, 'list'] as const,
  list: (filters: unknown = {}) => [...examKeys.lists(), filters] as const,
  details: () => [...examKeys.all, 'detail'] as const,
  detail: (id: string) => [...examKeys.details(), id] as const,
};

/** 全局进展聚合（GET /api/progress）的 query key；与 taskKeys.progress（按任务）区分。 */
export const progressKeys = {
  all: ['progress'] as const,
  lists: () => [...progressKeys.all, 'list'] as const,
  list: (limit: number) => [...progressKeys.lists(), limit] as const,
};