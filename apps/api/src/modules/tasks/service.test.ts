import { describe, expect, it } from 'vitest';
import type { CreateTaskInput, DataSnapshot } from '@task-list/shared';
import { createSeedSnapshot } from '../../store/seed';
import { advanceStage, createTask, listTasks } from './service';

function snapshot(): DataSnapshot {
  return createSeedSnapshot();
}

function input(overrides: Partial<CreateTaskInput> = {}): CreateTaskInput {
  return {
    title: '投递 ACME',
    statusId: 'status-in-progress',
    tags: [],
    notes: '',
    stages: [{ name: '笔试' }, { name: '一面' }],
    ...overrides,
  };
}

describe('createTask', () => {
  it('阶段 order 递增、首阶段 in_progress、currentStageId 指向首阶段', () => {
    const { task } = createTask(snapshot(), input());
    expect(task.stages.map((s) => s.order)).toEqual([0, 1]);
    expect(task.stages[0].status).toBe('in_progress');
    expect(task.stages[1].status).toBe('pending');
    expect(task.currentStageId).toBe(task.stages[0].id);
  });

  it('无阶段时 currentStageId 为 null', () => {
    const { task } = createTask(snapshot(), input({ stages: [] }));
    expect(task.stages).toHaveLength(0);
    expect(task.currentStageId).toBeNull();
  });
});

describe('advanceStage', () => {
  it('推进两次 + 幂等一次：进展不重复追加', () => {
    let snap = snapshot();
    const created = createTask(snap, input());
    snap = created.snapshot;
    const id = created.task.id;

    const first = advanceStage(snap, id);
    snap = first.snapshot;
    expect(first.result.nextStage).not.toBeNull();
    expect(first.result.task.stages[0].status).toBe('done');
    expect(first.result.task.stages[1].status).toBe('in_progress');
    expect(first.result.task.currentStageId).toBe(first.result.task.stages[1].id);

    const second = advanceStage(snap, id);
    snap = second.snapshot;
    expect(second.result.nextStage).toBeNull();
    expect(second.result.task.stages.every((s) => s.status === 'done')).toBe(true);
    expect(second.result.task.currentStageId).toBe(second.result.task.stages[1].id);

    // 第三次：末阶段已完成，幂等。
    const third = advanceStage(snap, id);
    expect(third.snapshot).toBe(snap);
    expect(third.snapshot.progressEntries).toHaveLength(2);
  });
});

describe('listTasks', () => {
  it('按 updatedAt 倒序', () => {
    let snap = snapshot();
    const a = createTask(snap, input({ title: 'A' }));
    const b = createTask(a.snapshot, input({ title: 'B' }));
    snap = b.snapshot;

    const reordered = {
      ...snap,
      tasks: snap.tasks.map((t) =>
        t.id === a.task.id
          ? { ...t, updatedAt: '2026-01-01T00:00:00.000Z' }
          : { ...t, updatedAt: '2026-02-01T00:00:00.000Z' },
      ),
    };

    const list = listTasks(reordered);
    expect(list[0].title).toBe('B');
    expect(list[1].title).toBe('A');
  });

  it('statusId / q / stageStatus 组合筛选', () => {
    let snap = snapshot();
    const a = createTask(snap, input({ title: 'Alpha Backend', tags: ['go'], statusId: 'status-in-progress' }));
    const b = createTask(a.snapshot, input({ title: 'Beta Frontend', tags: ['js'], statusId: 'status-done' }));
    snap = b.snapshot;

    const names = (tasks: { title: string }[]) => tasks.map((t) => t.title).sort();
    const nameSet = (tasks: { title: string }[]) => [...new Set(names(tasks))];

    expect(nameSet(listTasks(snap, { statusIds: ['status-in-progress'] }))).toEqual(['Alpha Backend']);
    expect(nameSet(listTasks(snap, { q: 'alpha' }))).toEqual(['Alpha Backend']);
    expect(nameSet(listTasks(snap, { q: 'go' }))).toEqual(['Alpha Backend']);
    expect(listTasks(snap, { stageStatus: 'pending' }).length).toBeGreaterThanOrEqual(1);
  });
});