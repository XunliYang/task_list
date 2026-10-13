import { describe, it, expect } from 'vitest';
import {
  createTaskInputSchema,
  dataSnapshotSchema,
  jobApplicationSchema,
  stageSchema,
  taskSchema,
} from './index';

describe('createTaskInputSchema', () => {
  it('接受合法输入', () => {
    const input = {
      title: '投递简历',
      company: 'ACME',
      statusId: 'status-in-progress',
      tags: ['后端'],
      notes: '',
      stages: [
        { name: '笔试', dueDate: '2026-10-01' },
        { name: '一面', dueDate: null },
      ],
    };
    const parsed = createTaskInputSchema.parse(input);
    expect(parsed.title).toBe('投递简历');
    expect(parsed.stages).toHaveLength(2);
    expect(parsed.stages[0].name).toBe('笔试');
  });

  it('拒绝缺少 title 的输入', () => {
    const input = {
      company: 'ACME',
      statusId: 'status-in-progress',
      stages: [{ name: '笔试' }],
    };
    expect(() => createTaskInputSchema.parse(input)).toThrow();
  });

  it('tags / notes 缺省时提供默认值', () => {
    const parsed = createTaskInputSchema.parse({
      title: '投递简历',
      statusId: 'status-in-progress',
      stages: [{ name: '准备' }],
    });
    expect(parsed.tags).toEqual([]);
    expect(parsed.notes).toBe('');
  });
});

describe('jobApplicationSchema', () => {
  it('接受合法 JobApplication（URL 字段为合法 URL）', () => {
    const parsed = jobApplicationSchema.parse({
      announcementUrl: 'https://example.com/gonggao',
      resumeUrl: 'https://example.com/resume.pdf',
      applyUrl: 'https://example.com/apply',
      position: '后端工程师',
      requirements: '3 年以上经验',
    });
    expect(parsed.announcementUrl).toBe('https://example.com/gonggao');
    expect(parsed.applyUrl).toBe('https://example.com/apply');
    expect(parsed.position).toBe('后端工程师');
  });

  it('拒绝非法 URL（announcementUrl=notaurl）', () => {
    expect(() =>
      jobApplicationSchema.parse({
        announcementUrl: 'notaurl',
        resumeUrl: null,
        applyUrl: null,
        position: null,
        requirements: null,
      }),
    ).toThrow();
  });

  it('空串 / 纯空白在规整层归一为 null', () => {
    const parsed = jobApplicationSchema.parse({
      announcementUrl: '',
      resumeUrl: '   ',
      applyUrl: null,
      position: '  ',
      requirements: '',
    });
    expect(parsed.announcementUrl).toBeNull();
    expect(parsed.resumeUrl).toBeNull();
    expect(parsed.position).toBeNull();
    expect(parsed.requirements).toBeNull();
  });
});

describe('taskSchema.jobApplication 向后兼容', () => {
  it('缺 jobApplication 键的 Task 反序列化后 jobApplication === null', () => {
    const task = {
      id: 'task-1',
      title: '投递 ACME',
      company: null,
      statusId: 'status-1',
      tags: [],
      stages: [
        {
          id: 'stage-1',
          name: '笔试',
          order: 0,
          status: 'pending',
          dueDate: null,
          completedAt: null,
        },
      ],
      currentStageId: 'stage-1',
      notes: '',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    const parsed = taskSchema.parse(task);
    expect(parsed.jobApplication).toBeNull();
  });

  it('含 jobApplication 的 DataSnapshot round-trip 后字段保留', () => {
    const snapshot = {
      version: 1,
      tasks: [
        {
          id: 'task-1',
          title: '投递 ACME',
          company: 'ACME',
          statusId: 'status-1',
          tags: [],
          stages: [
            {
              id: 'stage-1',
              name: '笔试',
              order: 0,
              status: 'pending',
              dueDate: null,
              completedAt: null,
            },
          ],
          currentStageId: 'stage-1',
          notes: '',
          jobApplication: {
            announcementUrl: 'https://example.com/gonggao',
            resumeUrl: 'https://example.com/resume.pdf',
            applyUrl: 'https://example.com/apply',
            position: '后端工程师',
            requirements: '熟悉 Node.js',
          },
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
      ],
      statusCategories: [{ id: 'status-1', name: '进行中', color: '#00aa00', order: 0 }],
      progressEntries: [],
      examInfos: [],
    };

    const parsed = dataSnapshotSchema.parse(snapshot);
    const reparsed = dataSnapshotSchema.parse(JSON.parse(JSON.stringify(parsed)));

    expect(reparsed.tasks[0].jobApplication).toEqual({
      announcementUrl: 'https://example.com/gonggao',
      resumeUrl: 'https://example.com/resume.pdf',
      applyUrl: 'https://example.com/apply',
      position: '后端工程师',
      requirements: '熟悉 Node.js',
    });
  });
});

describe('dataSnapshotSchema', () => {
  it('round-trip（parse → stringify → parse）一份含 1 task + 2 stage 的样例', () => {
    const snapshot = {
      version: 1,
      tasks: [
        {
          id: 'task-1',
          title: '投递 ACME',
          company: 'ACME',
          statusId: 'status-1',
          tags: ['后端'],
          stages: [
            {
              id: 'stage-1',
              name: '笔试',
              order: 0,
              status: 'done',
              dueDate: '2026-09-20',
              completedAt: '2026-09-20T10:00:00.000Z',
            },
            {
              id: 'stage-2',
              name: '一面',
              order: 1,
              status: 'pending',
              dueDate: null,
              completedAt: null,
            },
          ],
          currentStageId: 'stage-2',
          notes: '',
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
      ],
      statusCategories: [
        { id: 'status-1', name: '进行中', color: '#00aa00', order: 0 },
      ],
      progressEntries: [],
      examInfos: [],
    };

    const parsed = dataSnapshotSchema.parse(snapshot);
    const reparsed = dataSnapshotSchema.parse(JSON.parse(JSON.stringify(parsed)));

    expect(reparsed).toEqual(parsed);
    expect(reparsed.tasks[0].stages).toHaveLength(2);
    expect(reparsed.version).toBe(1);
  });
});

describe('Stage.order 约束', () => {
  it('拒绝负值 order', () => {
    const stage = {
      id: 'stage-1',
      name: '笔试',
      order: -1,
      status: 'pending',
      dueDate: null,
      completedAt: null,
    };
    expect(() => stageSchema.parse(stage)).toThrow();
  });

  it('拒绝任务内重复的 order', () => {
    const task = {
      id: 'task-1',
      title: '投递 ACME',
      company: null,
      statusId: 'status-1',
      tags: [],
      stages: [
        {
          id: 'stage-1',
          name: '笔试',
          order: 0,
          status: 'pending',
          dueDate: null,
          completedAt: null,
        },
        {
          id: 'stage-2',
          name: '一面',
          order: 0,
          status: 'pending',
          dueDate: null,
          completedAt: null,
        },
      ],
      currentStageId: null,
      notes: '',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    expect(() => taskSchema.parse(task)).toThrow();
  });
});