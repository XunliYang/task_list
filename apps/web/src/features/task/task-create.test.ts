import { describe, expect, it } from 'vitest';
import { buildCreateTaskInput } from './task-create';
import type { TaskCreateFormState } from './task-create';

function formState(overrides: Partial<TaskCreateFormState> = {}): TaskCreateFormState {
  return {
    title: '投递 ACME',
    company: 'ACME',
    tags: ['go', 'backend'],
    statusId: 'status-a',
    stages: [
      { name: '准备', dueDate: null },
      { name: '笔试', dueDate: '2026-10-01' },
    ],
    notes: '备注',
    ...overrides,
  };
}

describe('buildCreateTaskInput', () => {
  it('空标题（含纯空白）⇒ 拒绝提交并返回 null', () => {
    expect(buildCreateTaskInput(formState({ title: '' }))).toBeNull();
    expect(buildCreateTaskInput(formState({ title: '   ' }))).toBeNull();
  });

  it('标题 / 公司做 trim，公司为空时归一为 null', () => {
    const input = buildCreateTaskInput(formState({ title: '  投递 ACME  ', company: '  ' }));
    expect(input).not.toBeNull();
    expect(input!.title).toBe('投递 ACME');
    expect(input!.company).toBeNull();
  });

  it('含 2 个阶段、1 个空名阶段 ⇒ 空名阶段被过滤', () => {
    const input = buildCreateTaskInput(
      formState({
        stages: [
          { name: '准备', dueDate: null },
          { name: '   ', dueDate: null },
          { name: '笔试', dueDate: '2026-10-01' },
        ],
      }),
    );
    expect(input!.stages).toHaveLength(2);
    expect(input!.stages.map((s) => s.name)).toEqual(['准备', '笔试']);
  });

  it('阶段名做 trim，空 dueDate 归一为 null', () => {
    const input = buildCreateTaskInput(
      formState({ stages: [{ name: '  准备  ', dueDate: '' }] }),
    );
    expect(input!.stages).toEqual([{ name: '准备', dueDate: null }]);
  });

  it('透传 tags / statusId / notes', () => {
    const input = buildCreateTaskInput(formState());
    expect(input!.tags).toEqual(['go', 'backend']);
    expect(input!.statusId).toBe('status-a');
    expect(input!.notes).toBe('备注');
  });
});
