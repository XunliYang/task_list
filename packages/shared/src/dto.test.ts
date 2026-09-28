import { describe, it, expect } from 'vitest';
import {
  createExamInfoInputSchema,
  createProgressInputSchema,
  createStageInputSchema,
  createStatusInputSchema,
  createTaskInputSchema,
  updateStageInputSchema,
} from './index';

describe('DTO 必填文本字段拒绝纯空白（trim + min(1)）', () => {
  it('createProgressInputSchema 拒绝纯空白 summary，并对合法值做 trim', () => {
    expect(() => createProgressInputSchema.parse({ summary: '  ' })).toThrow();
    expect(() => createProgressInputSchema.parse({ summary: '\t\n' })).toThrow();
    expect(createProgressInputSchema.parse({ summary: '  进展  ' }).summary).toBe('进展');
  });

  it('createTaskInputSchema 拒绝纯空白 title', () => {
    const base = { statusId: 'status-in-progress', stages: [] };
    expect(() => createTaskInputSchema.parse({ ...base, title: '   ' })).toThrow();
    expect(createTaskInputSchema.parse({ ...base, title: '  投递 ACME  ' }).title).toBe(
      '投递 ACME',
    );
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