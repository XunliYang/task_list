import { describe, expect, it } from 'vitest';
import { CSV_HEADER } from './exam-copy';
import { csvTemplate, parseCsvToDrafts, parseJsonToDrafts } from './exam-import';

describe('CSV 导入解析（纯函数）', () => {
  it('3 行合法 + 1 行缺 title → 解析出 3 条、跳过 1 条', () => {
    const content = [
      'title,type,company,deadline,url,location,status,notes',
      'ACME 笔试,exam,ACME,2026-10-01,https://acme.com,北京,待报名,备注1',
      'Beta 一面,interview,Beta,2026-10-05,,上海,待面试,',
      'ACME 二面,interview,ACME,2026-10-10,,远程,,',
      ',exam,ACME,2026-10-20,,,,',
    ].join('\n');

    const result = parseCsvToDrafts(content);
    expect(result.error).toBeUndefined();
    expect(result.drafts).toHaveLength(3);
    expect(result.skipped).toBe(1);
    expect(result.drafts[0]).toMatchObject({ title: 'ACME 笔试', type: 'exam', company: 'ACME' });
  });

  it('表头缺少 title/type → 返回 error', () => {
    const result = parseCsvToDrafts('company,deadline\nACME,2026-10-01');
    expect(result.error).toContain('title');
    expect(result.drafts).toHaveLength(0);
  });

  it('空 type 视为 exam；非法 type 跳过', () => {
    const content = [
      'title,type',
      '默认类型,',
      '非法类型,quiz',
      '正常面试,interview',
    ].join('\n');
    const result = parseCsvToDrafts(content);
    expect(result.drafts.map((d) => d.type)).toEqual(['exam', 'interview']);
    expect(result.skipped).toBe(1);
  });

  it('空输入返回 0 条且不报错', () => {
    expect(parseCsvToDrafts('')).toEqual({ drafts: [], skipped: 0 });
  });

  it('csvTemplate 生成固定表头', () => {
    expect(csvTemplate()).toBe(CSV_HEADER.join(','));
  });
});

describe('JSON 导入解析（纯函数）', () => {
  it('解析合法数组并跳过缺 title / 非法项', () => {
    const content = JSON.stringify([
      { title: 'ACME 笔试', type: 'exam', company: 'ACME' },
      { type: 'interview' },
      { title: '缺类型', type: 'other' },
      { title: 'Beta 面试', type: 'interview' },
    ]);
    const result = parseJsonToDrafts(content);
    expect(result.error).toBeUndefined();
    expect(result.drafts).toHaveLength(2);
    expect(result.skipped).toBe(2);
  });

  it('非数组 JSON → error', () => {
    const result = parseJsonToDrafts('{"title":"x"}');
    expect(result.error).toContain('数组');
  });

  it('非法 JSON → error', () => {
    const result = parseJsonToDrafts('not json');
    expect(result.error).toContain('解析失败');
  });
});