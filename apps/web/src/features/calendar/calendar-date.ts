/**
 * 日历相关的纯日期工具。全部基于本地时区，日期键统一为 'YYYY-MM-DD'。
 * 自研实现，不引入重型日期库（满足「月视图网格自研」与依赖体积约束）。
 */

export type DateKey = string; // 'YYYY-MM-DD'

/** Date → 'YYYY-MM-DD'（本地时区）。 */
export function toDateKey(date: Date): DateKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' → 当日零点（本地时区）。 */
export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 年-月 → 'YYYY-MM'，用于 ?ym 查询参数。 */
export function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month;
}

/** 严格早于（按天粒度）。'YYYY-MM-DD' 的字典序即时间序，可直接比较。 */
export function isBeforeDay(a: Date, b: Date): boolean {
  return toDateKey(a) < toDateKey(b);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

/** 周一为一周起点的「本周起始日」。 */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=周日 .. 6=周六
  const sinceMonday = (day + 6) % 7;
  d.setDate(d.getDate() - sinceMonday);
  return d;
}

/** 月视图的 42 个单元格（6 行 × 7 列，周一起始），覆盖首尾两端的跨月日期。 */
export function buildMonthGrid(year: number, month: number): Date[] {
  const start = startOfWeek(new Date(year, month, 1));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** 某日所在周（周一至周日）的 7 天。 */
export function buildWeekGrid(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 'M月D日'，用于周视图标题等短日期展示。 */
export function formatShortDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/** 周范围标题，如「9月28日 – 10月4日」。 */
export function formatWeekRange(anchor: Date): string {
  const days = buildWeekGrid(anchor);
  const from = days[0];
  const to = days[6];
  if (from.getMonth() === to.getMonth()) {
    return `${from.getMonth() + 1}月${from.getDate()}日 – ${to.getDate()}日`;
  }
  return `${formatShortDate(from)} – ${formatShortDate(to)}`;
}
