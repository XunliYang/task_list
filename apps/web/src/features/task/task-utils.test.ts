import { describe, expect, it } from 'vitest';
import type { Stage } from '@task-list/shared';
import { getFlowAction, isStageOverdue } from './task-utils';

function stage(overrides: Partial<Stage> = {}): Stage {
  return { id: 's', name: '阶段', order: 0, status: 'pending', dueDate: null, completedAt: null, ...overrides };
}

describe('isStageOverdue', () => {
  it('截止时间早于今天且未完成 → 逾期', () => {
    const today = new Date('2026-09-28T12:00:00');
    expect(isStageOverdue(stage({ dueDate: '2026-09-20', status: 'pending' }), today)).toBe(true);
  });

  it('已完成阶段不视为逾期', () => {
    const today = new Date('2026-09-28T12:00:00');
    expect(isStageOverdue(stage({ dueDate: '2026-09-20', status: 'done' }), today)).toBe(false);
  });

  it('无截止时间不视为逾期', () => {
    expect(isStageOverdue(stage({ dueDate: null }))).toBe(false);
  });
});

describe('getFlowAction', () => {
  it('无阶段时禁用', () => {
    const action = getFlowAction({
      id: 't1', title: 'a', company: null, statusId: 's', tags: [], stages: [], currentStageId: null, notes: '', createdAt: '', updatedAt: '',
    });
    expect(action.disabled).toBe(true);
  });
});