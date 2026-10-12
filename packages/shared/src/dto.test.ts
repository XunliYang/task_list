import { describe, it, expect } from 'vitest';
import {
  createExamInfoInputSchema,
  createProgressInputSchema,
  createStageInputSchema,
  createStatusInputSchema,
  createTaskInputSchema,
  updateStageInputSchema,
  updateTaskInputSchema,
} from './index';

describe('DTO 必填文本字段拒绝纯空白（trim + min(1)）', () => {
  it('createProgressInputSchema 拒绝纯空白 summary，并对合法值做 trim', () => {
    expect(() => createProgressInputSchema.parse({ summary: '  ' })).toThrow();
    expect(() => createProgressInputSchema.parse({ summary: '\t\n' })).toThrow();
    expect(createProgressInputSchema.parse({ summary: '  进展  ' }).summary).toBe('进展');
  });

  it('createTaskInputSchema 拒绝纯空白 title', () => {
    const base = { statusId: 'status-in-progress', stages: [{ name: '准备' }] };
    expect(() => createTaskInputSchema.parse({ ...base, title: '   ' })).toThrow();
    expect(createTaskInputSchema.parse({ ...base, title: '  投递 ACME  ' }).title).toBe(
      '投递 ACME',
    );
  });

  it('createTaskInputSchema 拒绝空 stages 数组', () => {
    expect(() =>
      createTaskInputSchema.parse({
        statusId: 'status-in-progress',
        title: '投递 ACME',
        stages: [],
      }),
    ).toThrow();
  });

  it('createStageInputSchema 与 updateStageInputSchema 拒绝纯空白 name', () => {
    expect(() => createStageInputSchema.parse({ name: '  ' })).toThrow();
    expect(() => updateStageInputSchema.parse({ name: '   ' })).toThrow();
    expect(createStageInputSchema.parse({ name: '  笔试  ' }).name).toBe('笔试');
  });

  it('createStatusInputSchema 拒绝纯空白 name', () => {
    expect(() => createStatusInputSchema.parse({ name: '  ', color: '#f00' })).toThrow();
    expect(createStatusInputSchema.parse({ name: '  已挂 ', color: '#f00' }).name).toBe('已挂');
  });

  it('createExamInfoInputSchema 拒绝纯空白 title', () => {
    expect(() =>
      createExamInfoInputSchema.parse({ title: '  ', type: 'exam' }),
    ).toThrow();
    expect(
      createExamInfoInputSchema.parse({ title: '  ACME 笔试 ', type: 'exam' }).title,
    ).toBe('ACME 笔试');
  });
});

describe('createTaskInputSchema / updateTaskInputSchema 的 jobApplication', () => {
  const base = { statusId: 'status-in-progress', stages: [{ name: '准备' }] };

  it('createTaskInputSchema 接受完整 jobApplication 并保留字段', () => {
    const parsed = createTaskInputSchema.parse({
      ...base,
      title: '投递 ACME',
      jobApplication: {
        announcementUrl: 'https://example.com/gonggao',
        resumeUrl: 'https://example.com/resume.pdf',
        applyUrl: 'https://example.com/apply',
        position: '后端工程师',
        requirements: '熟悉 Node.js',
      },
    });
    expect(parsed.jobApplication).toEqual({
      announcementUrl: 'https://example.com/gonggao',
      resumeUrl: 'https://example.com/resume.pdf',
      applyUrl: 'https://example.com/apply',
      position: '后端工程师',
      requirements: '熟悉 Node.js',
    });
  });

  it('createTaskInputSchema 接受 jobApplication: null 与缺省', () => {
    expect(createTaskInputSchema.parse({ ...base, title: 'A', jobApplication: null }).jobApplication).toBeNull();
    expect(createTaskInputSchema.parse({ ...base, title: 'A' }).jobApplication).toBeUndefined();
  });

  it('createTaskInputSchema 拒绝非法 URL，并把空串归一为 null', () => {
    const withJob = (jobApplication: Record<string, unknown>) => ({
      ...base,
      title: 'A',
      jobApplication: {
        announcementUrl: null,
        resumeUrl: null,
        applyUrl: null,
        position: null,
        requirements: null,
        ...jobApplication,
      },
    });

    expect(() =>
      createTaskInputSchema.parse(withJob({ announcementUrl: 'notaurl' })),
    ).toThrow();

    const parsed = createTaskInputSchema.parse(
      withJob({ announcementUrl: '', position: '  ' }),
    );
    expect(parsed.jobApplication?.announcementUrl).toBeNull();
    expect(parsed.jobApplication?.position).toBeNull();
  });

  it('updateTaskInputSchema 接受 jobApplication: null（清除）', () => {
    const parsed = updateTaskInputSchema.parse({ jobApplication: null });
    expect(parsed.jobApplication).toBeNull();
  });
});