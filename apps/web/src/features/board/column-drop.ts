/**
 * 跨列拖拽的判定与共享常量（LEOY-103）。
 *
 * `resolveDrop` 是与组件解耦的纯函数：把「同列不请求 / 无效 drop 忽略」的
 * 判定集中在此，便于单测，也让 BoardPage 的 mutation 触发逻辑保持简单。
 */

/** 私有 MIME：区分「内部任务卡拖拽」与外部文件/文本拖入。 */
export const TASK_DRAG_TYPE = 'application/x-task-id';

export interface ResolveDropInput {
  taskId: string;
  /** 任务当前所在的状态分类 id */
  fromStatusId: string;
  /** 放置目标列的状态分类 id */
  toStatusId: string;
}

export interface ResolveDropResult {
  /** 是否需要发 PATCH 请求（cross-column 且字段齐全） */
  shouldMutate: boolean;
  /** 目标状态分类 id；不需要请求时为 null */
  nextStatusId: string | null;
}

/**
 * 解析一次放置：
 * - 缺少 taskId / fromStatusId / toStatusId → 无效 drop，忽略；
 * - 目标列与来源列相同 → 不请求（拖回自己所在列）；
 * - 跨列 → 请求，nextStatusId 为目标列 id。
 */
export function resolveDrop({
  taskId,
  fromStatusId,
  toStatusId,
}: ResolveDropInput): ResolveDropResult {
  if (!taskId || !fromStatusId || !toStatusId) {
    return { shouldMutate: false, nextStatusId: null };
  }
  if (fromStatusId === toStatusId) {
    return { shouldMutate: false, nextStatusId: null };
  }
  return { shouldMutate: true, nextStatusId: toStatusId };
}