import { describe, expect, it } from 'vitest';
import { buildReorderPlan, moveItem } from './status-order';

const STATUSES = [
  { id: 's1', name: '进行中', color: '#1976d2', order: 0 },
  { id: 's2', name: '已完成', color: '#388e3c', order: 1 },
  { id: 's3', name: '已挂', color: '#f57c00', order: 2 },
];

describe('moveItem', () => {
  it('首行上移为 no-op（返回原引用）', () => {
    expect(moveItem(STATUSES, 0, -1)).toBe(STATUSES);
  });

  it('末行下移为 no-op（返回原引用）', () => {
    expect(moveItem(STATUSES, STATUSES.length - 1, 1)).toBe(STATUSES);
  });

  it('中间行上移后顺序正确', () => {
    const next = moveItem(STATUSES, 1, -1);
    expect(next.map((s) => s.id)).toEqual(['s2', 's1', 's3']);
    expect(next).not.toBe(STATUSES);
  });

  it('中间行下移后顺序正确', () => {
    const next = moveItem(STATUSES, 1, 1);
    expect(next.map((s) => s.id)).toEqual(['s1', 's3', 's2']);
  });
});

describe('buildReorderPlan', () => {
  it('只有位置发生变化的项被产出，order 为目标下标', () => {
    const next = moveItem(STATUSES, 1, -1);
    const plan = buildReorderPlan(STATUSES, next);
    expect(plan).toEqual([
      { id: 's2', order: 0 },
      { id: 's1', order: 1 },
    ]);
  });

  it('无变化时产出空数组', () => {
    expect(buildReorderPlan(STATUSES, STATUSES)).toEqual([]);
  });

  it('未变化的第三个项不被产出', () => {
    const next = moveItem(STATUSES, 1, -1);
    const plan = buildReorderPlan(STATUSES, next);
    expect(plan.some((p) => p.id === 's3')).toBe(false);
  });
});