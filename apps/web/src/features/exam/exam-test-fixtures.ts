import type { ExamInfo, StatusCategory, Task } from '@task-list/shared';

/** 构造完整 ExamInfo，测试仅覆盖所需字段。 */
export function makeExam(overrides: Partial<ExamInfo> = {}): ExamInfo {
  return {
    id: 'exam-1',
    title: 'ACME 笔试',
    type: 'exam',
    company: 'ACME',
    source: 'manual',
    deadline: null,
    appliedAt: null,
    url: null,
    location: null,
    status: '待报名',
    notes: '',
    taskId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** 构造完整 Task（转任务结果用）。 */
export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'ACME 笔试',
    company: 'ACME',
    statusId: 'status-in-progress',
    tags: [],
    stages: [
      {
        id: 'stage-1',
        name: '准备',
        order: 0,
        status: 'in_progress',
        dueDate: null,
        completedAt: null,
      },
    ],
    currentStageId: 'stage-1',
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** 构造状态分类。 */
export function makeStatus(overrides: Partial<StatusCategory> = {}): StatusCategory {
  return {
    id: 'status-in-progress',
    name: '进行中',
    color: '#1976d2',
    order: 1,
    ...overrides,
  };
}