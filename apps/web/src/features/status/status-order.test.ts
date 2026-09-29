import { describe, expect, it } from 'vitest';
import { buildReorderPlan, moveItem, moveItemTo } from './status-order';

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

describe('moveItemTo', () => {
  it('把第 3 行插到第 1 行之前（from 2 → slot 0），顺序正确', () => {
    const next = moveItemTo(STATUSES, 2, 0);
    expect(next.map((s) => s.id)).toEqual(['s3', 's1', 's2']);
    expect(next).not.toBe(STATUSES);
  });

  it('把首行插到末行之后（from 0 → slot length），落到末尾', () => {
    const next = moveItemTo(STATUSES, 0, STATUSES.length);
    expect(next.map((s) => s.id)).toEqual(['s2', 's3', 's1']);
  });

  it('跨行下移：把第 1 行插到第 3 行之前（from 0 → slot 2）', () => {
    const next = moveItemTo(STATUSES, 0, 2);
    expect(next.map((s) => s.id)).toEqual(['s2', 's1', 's3']);
  });

  it('相邻原位移动为 no-op（返回原引用）', () => {
    // from 1 → slot 2 等价于「把 s2 移到 s3 之前」，正是原位，no-op。
    expect(moveItemTo(STATUSES, 1, 2)).toBe(STATUSES);
    // from 0 → slot 0（插到自身之前）
    expect(moveItemTo(STATUSES, 0, 0)).toBe(STATUSES);
  });

  it('越界下标为 no-op（返回原引用）', () => {
    expect(moveItemTo(STATUSES, -1, 0)).toBe(STATUSES);
    expect(moveItemTo(STATUSES, STATUSES.length, 0)).toBe(STATUSES);
    expect(moveItemTo(STATUSES, 0, STATUSES.length + 1)).toBe(STATUSES);
    expect(moveItemTo(STATUSES, 0, -1)).toBe(STATUSES);
  });

  it('把第 3 行拖到第 1 行位置后，buildReorderPlan 只产出位置变化的项', () => {
    const next = moveItemTo(STATUSES, 2, 0);
    const plan = buildReorderPlan(STATUSES, next);
    expect(plan).toEqual([
      { id: 's3', order: 0 },
      { id: 's1', order: 1 },
      { id: 's2', order: 2 },
    ]);
    expect(plan).toHaveLength(3);
  });
});