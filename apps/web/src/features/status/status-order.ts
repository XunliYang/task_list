/**
 * 状态分类调序的纯函数，便于单测。
 *
 * 契约：列表按 `order` 升序排好后再传入。`moveItem` 只做「位置上移/下移」，
 * `buildReorderPlan` 则把「位置变化」翻译成后端可接受的 `{ id, order }` 列表，
 * 且 `order` 一律取目标下标（列表从 0 开始），只产出真正发生位置变化的项。
 */

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