import { describe, expect, it } from 'vitest';
import type { Stage, StatusCategory, Task } from '@task-list/shared';
import {
  buildCalendarEvents,
  groupEventsByDate,
  sortCalendarEvents,
} from './useCalendarEvents';

function stage(
  id: string,
  name: string,
  order: number,
  dueDate: string | null,
  status: Stage['status'] = 'pending',
): Stage {
  return { id, name, order, status, dueDate, completedAt: status === 'done' ? '2026-09-01T00:00:00Z' : null };
}

function task(partial: {
  id: string;
  title: string;
  statusId: string;
  stages: Stage[];
  currentStageId?: string | null;
  updatedAt?: string;
}): Task {
  return {
    id: partial.id,
    title: partial.title,
    company: null,
    statusId: partial.statusId,
    tags: [],
    stages: partial.stages,
    currentStageId: partial.currentStageId ?? partial.stages[0]?.id ?? null,
    notes: '',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: partial.updatedAt ?? '2026-09-01T00:00:00Z',
  };
}

const STATUSES: StatusCategory[] = [
  { id: 'status-in-progress', name: '进行中', color: '#1976d2', order: 1 },
  { id: 'status-done', name: '已完成', color: '#388e3c', order: 2 },
];

// 固定「今天」，逾期判定不依赖真实日期。
const NOW = new Date('2026-09-08T12:00:00');

function buildFixture() {
  const tasks: Task[] = [
    task({
      id: 't1',
      title: '投递简历',
      statusId: 'status-in-progress',
      stages: [
        stage('s1', '笔试', 0, '2026-09-01'), // 逾期（今天之前且未完成）
        stage('s2', '一面', 1, null), // 空 dueDate：不产生事件
      ],
      currentStageId: 's1',
    }),
    task({
      id: 't2',
      title: '整理题库',
      statusId: 'status-done',
      stages: [stage('s3', '整理', 0, '2026-09-05', 'done')], // 已完成：灰态、不逾期
      currentStageId: 's3',
    }),
    task({
      id: 't3',
      title: '联系内推',
      statusId: 'status-in-progress',
      stages: [stage('s4', '跟进', 0, '2026-09-10')], // 未来：未逾期
      currentStageId: 's4',
    }),
  ];
  return { tasks, statuses: STATUSES };
}

describe('buildCalendarEvents（纯函数）', () => {
  it('构造 3 任务输入，事件条数正确、空 dueDate 不产生事件', () => {
    const { tasks, statuses } = buildFixture();
    const events = buildCalendarEvents(tasks, statuses, { now: NOW });

    // 3 个任务共 4 个阶段，其中 s2 dueDate 为空 → 3 条 stage-due。
    expect(events).toHaveLength(3);
    expect(events.every((e) => e.kind === 'stage-due')).toBe(true);

    const stageIds = events.map((e) => e.stageId);
    expect(stageIds).toContain('s1');
    expect(stageIds).toContain('s3');
    expect(stageIds).toContain('s4');
    expect(stageIds).not.toContain('s2');
  });

  it('已完成阶段事件被标记为 done，且不判定逾期', () => {
    const { tasks, statuses } = buildFixture();
    const events = buildCalendarEvents(tasks, statuses, { now: NOW });

    const doneEvent = events.find((e) => e.stageId === 's3');
    expect(doneEvent?.done).toBe(true);
    expect(doneEvent?.overdue).toBe(false);
  });

  it('今天之前未完成的 stage-due 判定为逾期，之后/当天不逾期', () => {
    const { tasks, statuses } = buildFixture();
    const events = buildCalendarEvents(tasks, statuses, { now: NOW });

    const overdueEvent = events.find((e) => e.stageId === 's1');
    const futureEvent = events.find((e) => e.stageId === 's4');
    expect(overdueEvent?.overdue).toBe(true);
    expect(futureEvent?.overdue).toBe(false);
  });

  it('事件携带任务状态分类色与当前阶段信息', () => {
    const { tasks, statuses } = buildFixture();
    const events = buildCalendarEvents(tasks, statuses, { now: NOW });

    const t1 = events.find((e) => e.taskId === 't1');
    expect(t1?.color).toBe('#1976d2');
    expect(t1?.currentStageName).toBe('笔试');
    expect(t1?.currentStageDueDate).toBe('2026-09-01');
  });

  it('includeTaskUpdated 开启时，从 updatedAt 派生 task-updated 事件', () => {
    const { tasks, statuses } = buildFixture();
    const without = buildCalendarEvents(tasks, statuses, { now: NOW });
    const withUpdated = buildCalendarEvents(tasks, statuses, {
      now: NOW,
      includeTaskUpdated: true,
    });

    expect(without.every((e) => e.kind === 'stage-due')).toBe(true);
    const updated = withUpdated.filter((e) => e.kind === 'task-updated');
    expect(updated).toHaveLength(tasks.length);
    expect(updated.every((e) => e.date === '2026-09-01')).toBe(true);
  });
});

describe('同日排序', () => {
  it('未完成优先，再按任务标题', () => {
    const { tasks, statuses } = buildFixture();
    // 把三个阶段压到同一天，验证排序。
    const sameDay: Task[] = [
      task({
        id: 'a',
        title: '任务乙',
        statusId: 'status-in-progress',
        stages: [stage('a1', '阶段', 0, '2026-09-10')],
        currentStageId: 'a1',
      }),
      task({
        id: 'b',
        title: '任务甲',
        statusId: 'status-in-progress',
        stages: [stage('b1', '阶段', 0, '2026-09-10')],
        currentStageId: 'b1',
      }),
      task({
        id: 'c',
        title: '任务丙',
        statusId: 'status-done',
        stages: [stage('c1', '阶段', 0, '2026-09-10', 'done')],
        currentStageId: 'c1',
      }),
    ];
    const events = buildCalendarEvents(sameDay, statuses, { now: NOW });
    const sorted = sortCalendarEvents(events);

    // 未完成（乙、甲）在前，按标题序：甲 < 乙；已完成（丙）最后。
    expect(sorted.map((e) => e.taskTitle)).toEqual(['任务甲', '任务乙', '任务丙']);
  });

  it('groupEventsByDate 按日期分组且组内有序', () => {
    const { tasks, statuses } = buildFixture();
    const grouped = groupEventsByDate(buildCalendarEvents(tasks, statuses, { now: NOW }));
    expect(grouped.has('2026-09-01')).toBe(true);
    expect(grouped.has('2026-09-05')).toBe(true);
    expect(grouped.has('2026-09-10')).toBe(true);
  });
});
