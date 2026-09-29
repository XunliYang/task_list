/**
 * 状态分类调序的纯函数，便于单测。
 *
 * 契约：列表按 `order` 升序排好后再传入。`moveItem` 只做「位置上移/下移」，
 * `buildReorderPlan` 则把「位置变化」翻译成后端可接受的 `{ id, order }` 列表，
 * 且 `order` 一律取目标下标（列表从 0 开始），只产出真正发生位置变化的项。
 */

/** 私有 MIME：区分「内部状态行拖拽」与外部文件/文本拖入（与看板 TASK_DRAG_TYPE 同思路）。 */
export const STATUS_DRAG_TYPE = 'application/x-status-id';

/** 只依赖 id 的最小形状：StatusCategory 满足它即可被复用。 */
export interface Orderable {
  id: string;
  order: number;
}

export interface ReorderItem {
  id: string;
  order: number;
}

/**
 * 把 `list` 中下标 `index` 的项移动 `offset` 格（+1 下移 / -1 上移）。
 * 首行上移、末行下移、越界下标均为 no-op，返回**原数组引用**（调用方可用 `===` 判断无变化）。
 */
export function moveItem<T>(list: T[], index: number, offset: number): T[] {
  const target = index + offset;
  if (!Number.isInteger(offset) || offset === 0) return list;
  if (index < 0 || index >= list.length) return list;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

/**
 * 把 `list` 中下标 `fromIndex` 的项移动到插入槽 `toIndex`（插入位置，∈ [0, list.length]，
 * `toIndex === list.length` 表示追加到末尾）。与 `moveItem` 不同，这里支持「跨多行直达」，
 * 用于拖拽调序：把 from 移到 to 之前。
 * 越界下标、以及「移除后插回同一槽位」（即 from 与 to 相邻的原位移动）均为 no-op，
 * 返回**原数组引用**（调用方可用 `===` 判断无变化）。
 */
export function moveItemTo<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex < 0 || fromIndex >= list.length) return list;
  if (toIndex < 0 || toIndex > list.length) return list;
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  // 移除后，若插入槽位在移除项之后，需左移一位。
  const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
  if (insertAt === fromIndex) return list;
  next.splice(insertAt, 0, moved);
  return next;
}

/**
 * 比较 `current`（原顺序）与 `next`（移动后顺序），产出所有位置发生变化的
 * `{ id, order: 目标下标 }`。未变化项不产出；空数组表示无需写入。
 */
export function buildReorderPlan(current: Orderable[], next: Orderable[]): ReorderItem[] {
  const indexById = new Map(current.map((item, index) => [item.id, index]));
  const plan: ReorderItem[] = [];
  next.forEach((item, index) => {
    if (indexById.get(item.id) !== index) {
      plan.push({ id: item.id, order: index });
    }
  });
  return plan;
}