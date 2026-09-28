import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  buildMonthGrid,
  buildWeekGrid,
  formatWeekRange,
  fromDateKey,
  isSameDay,
  startOfWeek,
  toDateKey,
  toYearMonth,
} from './calendar-date';

describe('toDateKey / fromDateKey', () => {
  it('Date 与 YYYY-MM-DD 互转，保持本地时区', () => {
    const d = new Date(2026, 8, 5); // 2026-09-05 本地零点
    expect(toDateKey(d)).toBe('2026-09-05');
    const back = fromDateKey('2026-09-05');
    expect(isSameDay(back, d)).toBe(true);
  });
});

describe('buildMonthGrid', () => {
  it('2026-09 网格第一格是 8/31（周一），最后一格是 10/11，共 42 格', () => {
    const cells = buildMonthGrid(2026, 8);
    expect(cells).toHaveLength(42);
    expect(toDateKey(cells[0])).toBe('2026-08-31');
    expect(cells[41]).toBeDefined();
    expect(toDateKey(cells[41])).toBe('2026-10-11');
  });

  it('周一起始：8/31 是周一', () => {
    const cells = buildMonthGrid(2026, 8);
    expect(cells[0].getDay()).toBe(1); // 周一
  });
});

describe('startOfWeek', () => {
  it('周日归属到上一个周一', () => {
    const sunday = new Date(2026, 8, 6); // 2026-09-06 周日
    expect(toDateKey(startOfWeek(sunday))).toBe('2026-08-31');
  });

  it('周一自身就是周起点', () => {
    const monday = new Date(2026, 8, 7); // 2026-09-07 周一
    expect(toDateKey(startOfWeek(monday))).toBe('2026-09-07');
  });
});

describe('buildWeekGrid', () => {
  it('返回 7 天，周一至周日', () => {
    const days = buildWeekGrid(new Date(2026, 8, 10)); // 周四
    expect(days).toHaveLength(7);
    expect(toDateKey(days[0])).toBe('2026-09-07');
    expect(toDateKey(days[6])).toBe('2026-09-13');
  });
});

describe('addDays / addMonths / toYearMonth / formatWeekRange', () => {
  it('addDays 跨月进位', () => {
    expect(toDateKey(addDays(new Date(2026, 7, 31), 1))).toBe('2026-09-01');
  });

  it('addMonths 固定到 1 号', () => {
    expect(toYearMonth(addMonths(new Date(2026, 8, 15), -1))).toBe('2026-08');
  });

  it('formatWeekRange 同月省略月，跨月分别标注', () => {
    expect(formatWeekRange(new Date(2026, 8, 28))).toBe('9月28日 – 10月4日');
  });

  it('formatWeekRange 跨年周带上年份', () => {
    // 2026-12-28（周一）所在周跨到 2027-01-03。
    expect(formatWeekRange(new Date(2026, 11, 28))).toBe('2026年12月28日 – 2027年1月3日');
  });
});