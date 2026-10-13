import { describe, expect, it } from 'vitest';
import {
  buildCreateTaskInput,
  emptyJobApplicationDraft,
  isHttpUrl,
  jobApplicationDraftFrom,
  jobApplicationUrlErrors,
  normalizeJobApplication,
} from './task-create';
import type { TaskCreateFormState } from './task-create';
import type { JobApplication } from '@task-list/shared';

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
    jobApplication: emptyJobApplicationDraft(),
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

describe('求职信息规整（jobApplication）', () => {
  it('全空 ⇒ jobApplication 为 null（非求职任务）', () => {
    const input = buildCreateTaskInput(formState({ jobApplication: emptyJobApplicationDraft() }));
    expect(input!.jobApplication).toBeNull();
  });

  it('任一字段非空 ⇒ 组成对象，空串归一为 null，文本做 trim', () => {
    const input = buildCreateTaskInput(
      formState({
        jobApplication: {
          position: '  后端工程师  ',
          announcementUrl: '',
          resumeUrl: '  ',
          applyUrl: 'https://app.acme.com/apply',
          requirements: '要求：熟悉 Go\n加分：实习经历',
        },
      }),
    );
    expect(input!.jobApplication).toEqual({
      position: '后端工程师',
      announcementUrl: null,
      resumeUrl: null,
      applyUrl: 'https://app.acme.com/apply',
      requirements: '要求：熟悉 Go\n加分：实习经历',
    });
  });

  it('normalizeJobApplication：仅空白字段 ⇒ null', () => {
    expect(
      normalizeJobApplication({
        position: '  ',
        announcementUrl: '',
        resumeUrl: ' ',
        applyUrl: '',
        requirements: '\t',
      }),
    ).toBeNull();
  });

  it('jobApplicationDraftFrom：null ⇒ 空草稿', () => {
    expect(jobApplicationDraftFrom(null)).toEqual(emptyJobApplicationDraft());
  });

  it('jobApplicationDraftFrom：对象 ⇒ 回填（null 字段补空串）', () => {
    expect(
      jobApplicationDraftFrom({
        position: '后端',
        announcementUrl: 'https://a.com',
        resumeUrl: null,
        applyUrl: null,
        requirements: null,
      }),
    ).toEqual({
      position: '后端',
      announcementUrl: 'https://a.com',
      resumeUrl: '',
      applyUrl: '',
      requirements: '',
    });
  });
});

describe('求职信息链接校验（jobApplicationUrlErrors）', () => {
  it('全空 ⇒ 无错误', () => {
    expect(jobApplicationUrlErrors(emptyJobApplicationDraft())).toEqual([]);
  });

  it('非法 URL 的字段返回对应错误提示', () => {
    const errors = jobApplicationUrlErrors({
      position: '',
      announcementUrl: 'not-a-url',
      resumeUrl: 'javascript:alert(1)',
      applyUrl: 'https://ok.example.com',
      requirements: '',
    });
    expect(errors.map((e) => e.field)).toEqual(['announcementUrl', 'resumeUrl']);
    expect(errors[0].message).toContain('公告链接');
    expect(errors[1].message).toContain('简历链接');
  });

  it('合法 URL（含 http/https）⇒ 无错误', () => {
    expect(
      jobApplicationUrlErrors({
        position: '',
        announcementUrl: 'https://a.example.com/announce',
        resumeUrl: 'http://r.example.com/resume.pdf',
        applyUrl: 'https://app.example.com/apply',
        requirements: '',
      }),
    ).toEqual([]);
  });

  it('isHttpUrl：仅 http/https 为真，阻断 javascript/mailto/ftp', () => {
    expect(isHttpUrl('https://a.example.com')).toBe(true);
    expect(isHttpUrl('http://a.example.com')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('mailto:a@b.com')).toBe(false);
    expect(isHttpUrl('ftp://a.example.com/x')).toBe(false);
    expect(isHttpUrl('not-a-url')).toBe(false);
  });

  it('编辑态：未改动的历史非 http 值放行，改动/新增的非法值仍阻断', () => {
    const legacy: JobApplication = {
      position: '后端工程师',
      announcementUrl: 'mailto:hr@acme.com',
      resumeUrl: null,
      applyUrl: null,
      requirements: '熟悉 Go',
    };
    // 与持久化值一致的非 http 值不报错。
    expect(
      jobApplicationUrlErrors(
        {
          position: '后端工程师',
          announcementUrl: 'mailto:hr@acme.com',
          resumeUrl: '',
          applyUrl: '',
          requirements: '熟悉 Go',
        },
        legacy,
      ),
    ).toEqual([]);

    // 改动为非法值（ftp:）或新增非法值仍报错。
    const changed = jobApplicationUrlErrors(
      {
        position: '后端工程师',
        announcementUrl: 'ftp://acme.com/announce',
        resumeUrl: '',
        applyUrl: 'javascript:alert(1)',
        requirements: '熟悉 Go',
      },
      legacy,
    );
    expect(changed.map((e) => e.field)).toEqual(['announcementUrl', 'applyUrl']);
  });

  it('创建态（无 original）：非 http 值一律阻断', () => {
    const errors = jobApplicationUrlErrors({
      position: '',
      announcementUrl: 'mailto:hr@acme.com',
      resumeUrl: '',
      applyUrl: '',
      requirements: '',
    });
    expect(errors.map((e) => e.field)).toEqual(['announcementUrl']);
  });
});