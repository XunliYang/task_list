import { describe, expect, it } from 'vitest';
import { resolveDrop } from './column-drop';

describe('resolveDrop', () => {
  it('fromStatusId === toStatusId → shouldMutate=false（同列不请求）', () => {
    const result = resolveDrop({
      taskId: 't1',
      fromStatusId: 'status-a',
      toStatusId: 'status-a',
    });
    expect(result).toEqual({ shouldMutate: false, nextStatusId: null });
  });

  it('不同列 → shouldMutate=true 且 nextStatusId 为目标列 id', () => {
    const result = resolveDrop({
      taskId: 't1',
      fromStatusId: 'status-a',
      toStatusId: 'status-b',
    });
    expect(result.shouldMutate).toBe(true);
    expect(result.nextStatusId).toBe('status-b');
  });

  it('缺少 taskId → 无效 drop 忽略', () => {
    const result = resolveDrop({ taskId: '', fromStatusId: 'status-a', toStatusId: 'status-b' });
    expect(result).toEqual({ shouldMutate: false, nextStatusId: null });
  });

  it('缺少 toStatusId → 无效 drop 忽略', () => {
    const result = resolveDrop({ taskId: 't1', fromStatusId: 'status-a', toStatusId: '' });
    expect(result).toEqual({ shouldMutate: false, nextStatusId: null });
  });

  it('缺少 fromStatusId → 无效 drop 忽略', () => {
    const result = resolveDrop({ taskId: 't1', fromStatusId: '', toStatusId: 'status-b' });
    expect(result).toEqual({ shouldMutate: false, nextStatusId: null });
  });
});