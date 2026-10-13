import { describe, expect, it, vi } from 'vitest';
import type { ExamInfo, RecentProgressEntry, StatusCategory, Task } from '@task-list/shared';
import { ApiError } from './errors';
import { LocalStore, createSeedSnapshot, STORAGE_KEY, parseBackupJson } from './local-store';

/** 内存版 Storage，隔离于全局 localStorage。 */
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    dump: () => Object.fromEntries(map.entries()),
  };
}

type MemoryStorage = ReturnType<typeof memoryStorage>;

function newStore(storage?: MemoryStorage) {
  return new LocalStore(storage ?? memoryStorage());
}

function createTaskBody(overrides: Record<string, unknown> = {}) {
  return {
    title: 'ACME 后端',
    company: 'ACME',
    statusId: 'status-todo',
    tags: ['backend'],
    notes: '',
    stages: [{ name: '笔试' }, { name: '一面' }],
    ...overrides,
  };
}

describe('LocalStore：seed 与状态分类', () => {
  it('空存储首次读取写入三条 seed 状态分类并按 order 排序', () => {
    const store = newStore();
    const statuses = store.request<StatusCategory[]>('GET', '/statuses');
    expect(statuses.map((s) => s.id)).toEqual([
      'status-todo',
      'status-in-progress',
      'status-done',
    ]);
    expect(statuses.map((s) => s.name)).toEqual(['待开始', '进行中', '已完成']);
  });

  it('seed 快照结构符合 DataSnapshot 契约', () => {
    expect(createSeedSnapshot()).toEqual({
      version: 1,
      tasks: [],
      statusCategories: expect.any(Array),
      progressEntries: [],
      examInfos: [],
    });
  });

  it('新增 / 更新 / 删除状态分类', () => {
    const store = newStore();
    const created = store.request<StatusCategory>('POST', '/statuses', {
      name: '已挂',
      color: '#f57c00',
    });
    expect(created.order).toBe(3);

    const updated = store.request<StatusCategory>('PATCH', `/statuses/${created.id}`, {
      name: '已挂起',
    });
    expect(updated.name).toBe('已挂起');

    store.request('DELETE', `/statuses/${created.id}`);
    const statuses = store.request<StatusCategory[]>('GET', '/statuses');
    expect(statuses.find((s) => s.id === created.id)).toBeUndefined();
  });

  it('删除被任务引用的状态分类 → 409 status_in_use', () => {
    const store = newStore();
    store.request<Task>('POST', '/tasks', createTaskBody({ statusId: 'status-todo' }));

    let caught: ApiError | null = null;
    try {
      store.request('DELETE', '/statuses/status-todo');
    } catch (err) {
      caught = err as ApiError;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught?.status).toBe(409);
    expect(caught?.code).toBe('status_in_use');
    expect((caught?.details as { taskIds: string[] }).taskIds).toHaveLength(1);
  });

  it('乐观更新：批量 PATCH order 后列表按新顺序返回', () => {
    const store = newStore();
    const statuses = store.request<StatusCategory[]>('GET', '/statuses');
    const [a, b, c] = statuses;
    // 模拟 StatusManagerPage.performReorder 的三段 PATCH。
    store.request('PATCH', `/statuses/${a.id}`, { order: 2 });
    store.request('PATCH', `/statuses/${b.id}`, { order: 0 });
    store.request('PATCH', `/statuses/${c.id}`, { order: 1 });
    const next = store.request<StatusCategory[]>('GET', '/statuses');
    expect(next.map((s) => s.id)).toEqual([b.id, c.id, a.id]);
  });
});

describe('LocalStore：任务 CRUD 与查询', () => {
  it('创建任务：阶段 order 递增、首个阶段 in_progress、currentStageId 指向首阶段', () => {
    const store = newStore();
    const task = store.request<Task>('POST', '/tasks', createTaskBody());
    expect(task.stages).toHaveLength(2);
    expect(task.stages.map((s) => s.order)).toEqual([0, 1]);
    expect(task.stages[0].status).toBe('in_progress');
    expect(task.stages[1].status).toBe('pending');
    expect(task.currentStageId).toBe(task.stages[0].id);
  });

  it('创建任务引用不存在的状态分类 → 400 validation_error', () => {
    const store = newStore();
    let caught: ApiError | null = null;
    try {
      store.request('POST', '/tasks', createTaskBody({ statusId: 'nope' }));
    } catch (err) {
      caught = err as ApiError;
    }
    expect(caught?.status).toBe(400);
    expect(caught?.code).toBe('validation_error');
  });

  it('创建任务缺阶段（stages 为空）→ 400 校验失败', () => {
    const store = newStore();
    expect(() => store.request('POST', '/tasks', createTaskBody({ stages: [] }))).toThrow(
      ApiError,
    );
  });

  it('查询单个任务、缺失返回 404 not_found', () => {
    const store = newStore();
    const task = store.request<Task>('POST', '/tasks', createTaskBody());
    expect(store.request<Task>('GET', `/tasks/${task.id}`).title).toBe('ACME 后端');

    let caught: ApiError | null = null;
    try {
      store.request('GET', '/tasks/missing');
    } catch (err) {
      caught = err as ApiError;
    }
    expect(caught?.status).toBe(404);
    expect(caught?.code).toBe('not_found');
  });

  it('更新任务字段并更新时间戳', () => {
    const store = newStore();
    const task = store.request<Task>('POST', '/tasks', createTaskBody());
    const updated = store.request<Task>('PATCH', `/tasks/${task.id}`, {
      title: '改标题',
      statusId: 'status-in-progress',
    });
    expect(updated.title).toBe('改标题');
    expect(updated.statusId).toBe('status-in-progress');
  });

  it('删除任务级联删除进度记录', () => {
    const store = newStore();
    const task = store.request<Task>('POST', '/tasks', createTaskBody());
    store.request('POST', `/tasks/${task.id}/progress`, { summary: '做了一件事' });
    store.request('DELETE', `/tasks/${task.id}`);
    expect(store.request<Task[]>('GET', '/tasks')).toEqual([]);
    let caught: ApiError | null = null;
    try {
      store.request('GET', `/tasks/${task.id}/progress`);
    } catch (err) {
      caught = err as ApiError;
    }
    expect(caught?.status).toBe(404);
  });

  it('列表按 updatedAt 倒序，并按 statusId / q 过滤', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const store = newStore();
    const a = store.request<Task>('POST', '/tasks', createTaskBody({ title: '任务 A' }));
    vi.setSystemTime(new Date('2026-01-01T00:00:02.000Z'));
    const b = store.request<Task>('POST', '/tasks', createTaskBody({ title: '任务 B', company: 'Beta' }));
    vi.useRealTimers();

    const list = store.request<Task[]>('GET', '/tasks');
    expect(list.map((t) => t.id)).toEqual([b.id, a.id]);

    const filtered = store.request<Task[]>('GET', '/tasks?q=beta');
    expect(filtered.map((t) => t.id)).toEqual([b.id]);

    const byStatus = store.request<Task[]>('GET', '/tasks?statusId=status-todo');
    expect(byStatus).toHaveLength(2);
  });
});

describe('LocalStore：JobApplication 持久化与向后兼容', () => {
  const fullJob = {
    announcementUrl: 'https://example.com/gonggao',
    resumeUrl: 'https://example.com/resume.pdf',
    applyUrl: 'https://example.com/apply',
    position: '后端工程师',
    requirements: '熟悉 Node.js',
  };

  it('创建含 jobApplication 的任务 → 刷新（resetCache）后字段仍在，且落盘 JSON 含该字段', () => {
    const storage = memoryStorage();
    const store = newStore(storage);
    const created = store.request<Task>('POST', '/tasks', createTaskBody({ jobApplication: fullJob }));
    expect(created.jobApplication).toEqual(fullJob);

    // 模拟「刷新页面」：清内存缓存，强制从存储重新读盘。
    store.resetCache();
    const reloaded = store.request<Task[]>('GET', '/tasks');
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].jobApplication).toEqual(fullJob);

    // localStorage 持久化证据：解析落盘 JSON 中的该任务片段。
    const onDisk = JSON.parse(storage.dump()[STORAGE_KEY] as string) as {
      tasks: Array<{ jobApplication: unknown }>;
    };
    expect(onDisk.tasks[0].jobApplication).toEqual(fullJob);
  });

  it('缺省创建 → jobApplication 为 null；显式传 null 同样为 null', () => {
    const store = newStore();
    const withNull = store.request<Task>('POST', '/tasks', createTaskBody({ jobApplication: null }));
    expect(withNull.jobApplication).toBeNull();

    const withDefault = store.request<Task>('POST', '/tasks', createTaskBody());
    expect(withDefault.jobApplication).toBeNull();
  });

  it('PATCH 更新 jobApplication 并可用 null 清除', () => {
    const storage = memoryStorage();
    const store = newStore(storage);
    const created = store.request<Task>('POST', '/tasks', createTaskBody({ jobApplication: fullJob }));

    const updated = store.request<Task>('PATCH', `/tasks/${created.id}`, {
      jobApplication: { ...fullJob, position: '前端工程师' },
    });
    expect(updated.jobApplication?.position).toBe('前端工程师');

    // 传 null 清除 → 非求职任务。
    const cleared = store.request<Task>('PATCH', `/tasks/${created.id}`, { jobApplication: null });
    expect(cleared.jobApplication).toBeNull();
  });

  it('向后兼容：旧数据（无 jobApplication 键的任务）加载不报错且读为 null', () => {
    // 模拟旧版本 localStorage：任务对象缺少 jobApplication 键。
    const legacy = {
      version: 1,
      tasks: [
        {
          id: 'legacy-1',
          title: '旧任务',
          company: null,
          statusId: 'status-todo',
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
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      statusCategories: [
        { id: 'status-todo', name: '待开始', color: '#9e9e9e', order: 0 },
      ],
      progressEntries: [],
      examInfos: [],
    };

    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    const store = newStore(storage);

    const tasks = store.request<Task[]>('GET', '/tasks');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].jobApplication).toBeNull();
  });
});

describe('LocalStore：阶段流转与进展记录', () => {
  it('推进阶段：记录进展并进入下一阶段，末阶段 nextStage=null', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const store = newStore();
    const task = store.request<Task>('POST', '/tasks', createTaskBody());

    const first = store.request<{ task: Task; nextStage: { id: string } | null }>(
      'POST',
      `/tasks/${task.id}/advance`,
    );
    expect(first.task.stages[0].status).toBe('done');
    expect(first.task.stages[1].status).toBe('in_progress');
    expect(first.nextStage?.id).toBe(task.stages[1].id);

    vi.setSystemTime(new Date('2026-01-01T00:00:02.000Z'));
    const second = store.request<{ task: Task; nextStage: { id: string } | null }>(
      'POST',
      `/tasks/${task.id}/advance`,
    );
    vi.useRealTimers();
    expect(second.nextStage).toBeNull();
    expect(second.task.currentStageId).toBe(second.task.stages[1].id);

    const progress = store.request<{ summary: string; stageId: string | null }[]>(
      'GET',
      `/tasks/${task.id}/progress`,
    );
    expect(progress).toHaveLength(2);
    expect(progress[0].summary).toBe('完成阶段「一面」');
  });

  it('新增进展：带 stageId 校验、摘要非空', () => {
    const store = newStore();
    const task = store.request<Task>('POST', '/tasks', createTaskBody());
    const entry = store.request<{ summary: string; stageId: string | null }>(
      'POST',
      `/tasks/${task.id}/progress`,
      { summary: '投了简历', stageId: task.stages[0].id },
    );
    expect(entry.summary).toBe('投了简历');
    expect(entry.stageId).toBe(task.stages[0].id);

    expect(() =>
      store.request('POST', `/tasks/${task.id}/progress`, { summary: '   ' }),
    ).toThrow(ApiError);
  });

  it('新增 / 重排 / 更新 / 删除阶段', () => {
    const store = newStore();
    const task = store.request<Task>('POST', '/tasks', createTaskBody());

    const withThird = store.request<Task>('POST', `/tasks/${task.id}/stages`, {
      name: '二面',
    });
    expect(withThird.stages).toHaveLength(3);

    const reordered = store.request<Task>('PATCH', `/tasks/${task.id}/stages/order`, {
      stageIds: [
        withThird.stages[2].id,
        withThird.stages[0].id,
        withThird.stages[1].id,
      ],
    });
    expect(reordered.stages.map((s) => s.order)).toEqual([0, 1, 2]);
    expect(reordered.stages[0].name).toBe('二面');

    const updated = store.request<Task>(
      'PATCH',
      `/tasks/${task.id}/stages/${withThird.stages[2].id}`,
      { name: '二面（改）', status: 'done' },
    );
    expect(updated.stages.find((s) => s.id === withThird.stages[2].id)?.name).toBe(
      '二面（改）',
    );

    const removed = store.request<Task>(
      'DELETE',
      `/tasks/${task.id}/stages/${withThird.stages[2].id}`,
    );
    expect(removed.stages).toHaveLength(2);
  });

  it('重排缺失/多余阶段 → 400 invalid_stage_order', () => {
    const store = newStore();
    const task = store.request<Task>('POST', '/tasks', createTaskBody());
    let caught: ApiError | null = null;
    try {
      store.request('PATCH', `/tasks/${task.id}/stages/order`, {
        stageIds: [task.stages[0].id],
      });
    } catch (err) {
      caught = err as ApiError;
    }
    expect(caught?.status).toBe(400);
    expect(caught?.code).toBe('invalid_stage_order');
  });

  it('手动切换当前阶段（回退）', () => {
    const store = newStore();
    const task = store.request<Task>('POST', '/tasks', createTaskBody());
    store.request('POST', `/tasks/${task.id}/advance`);
    const reverted = store.request<Task>('PATCH', `/tasks/${task.id}/current-stage`, {
      stageId: task.stages[0].id,
    });
    expect(reverted.currentStageId).toBe(task.stages[0].id);
    expect(reverted.stages[0].status).toBe('in_progress');
  });
});

describe('LocalStore：考试信息 CRUD / 导入 / 转任务', () => {
  it('新增 / 更新 / 删除考试信息', () => {
    const store = newStore();
    const exam = store.request<ExamInfo>('POST', '/exams', {
      title: 'ACME 笔试',
      type: 'exam',
      company: 'ACME',
    });
    expect(exam.source).toBe('manual');
    expect(exam.status).toBe('');

    const updated = store.request<ExamInfo>('PATCH', `/exams/${exam.id}`, {
      status: '已报名',
    });
    expect(updated.status).toBe('已报名');

    store.request('DELETE', `/exams/${exam.id}`);
    expect(store.request<ExamInfo[]>('GET', '/exams')).toEqual([]);
  });

  it('CSV 导入：合法行导入、缺 title 行跳过', () => {
    const store = newStore();
    const content = [
      'title,type,company,deadline,url,location,status,notes',
      'ACME 笔试,exam,ACME,2026-10-01,https://a.com,北京,待报名,',
      ',exam,ACME,,,,,',
    ].join('\n');
    const result = store.request<{ imported: number; skipped: number }>('POST', '/exams/import', {
      format: 'csv',
      content,
    });
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(store.request<ExamInfo[]>('GET', '/exams')).toHaveLength(1);
  });

  it('JSON 导入：逐条校验，非法项跳过', () => {
    const store = newStore();
    const content = JSON.stringify([
      { title: 'ACME 笔试', type: 'exam' },
      { type: 'interview' },
      { title: 'ACME', type: 'quiz' },
    ]);
    const result = store.request<{ imported: number; skipped: number }>('POST', '/exams/import', {
      format: 'json',
      content,
    });
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(2);
  });

  it('转任务：生成任务并回链 exam.taskId，重复转换 409', () => {
    const store = newStore();
    const exam = store.request<ExamInfo>('POST', '/exams', {
      title: 'ACME 笔试',
      type: 'exam',
      notes: '备注',
      url: 'https://a.com',
    });
    const converted = store.request<{ task: Task; exam: ExamInfo }>(
      'POST',
      `/exams/${exam.id}/to-task`,
      { stages: [{ name: '笔试' }] },
    );
    expect(converted.task.stages).toHaveLength(1);
    expect(converted.exam.taskId).toBe(converted.task.id);

    let caught: ApiError | null = null;
    try {
      store.request('POST', `/exams/${exam.id}/to-task`, {});
    } catch (err) {
      caught = err as ApiError;
    }
    expect(caught?.status).toBe(409);
    expect(caught?.code).toBe('already_converted');
  });

  it('列表按 type / q / status 过滤', () => {
    const store = newStore();
    store.request('POST', '/exams', { title: 'ACME 笔试', type: 'exam', company: 'ACME' });
    store.request('POST', '/exams', { title: 'Beta 一面', type: 'interview', company: 'Beta' });

    const interviews = store.request<ExamInfo[]>('GET', '/exams?type=interview');
    expect(interviews).toHaveLength(1);
    expect(interviews[0].title).toBe('Beta 一面');

    const byQ = store.request<ExamInfo[]>('GET', '/exams?q=acme');
    expect(byQ).toHaveLength(1);
  });
});

describe('LocalStore：持久化', () => {
  it('写入后同一 storage 重新实例化仍能读回，且无 tmp 残留', () => {
    const storage = memoryStorage();
    const first = newStore(storage);
    first.request<Task>('POST', '/tasks', createTaskBody());
    first.request('POST', '/statuses', { name: '已挂', color: '#f57c00' });

    const second = new LocalStore(storage);
    expect(second.request<Task[]>('GET', '/tasks')).toHaveLength(1);
    expect(second.request<StatusCategory[]>('GET', '/statuses')).toHaveLength(4);

    const dump = storage.dump();
    expect(Object.keys(dump)).toEqual([STORAGE_KEY]);
  });

  it('损坏数据回退 seed，不抛错', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, '{ not-valid json');
    const store = new LocalStore(storage);
    expect(store.request<StatusCategory[]>('GET', '/statuses')).toHaveLength(3);
  });
});

describe('LocalStore：备份导出/导入', () => {
  it('exportSnapshot 输出完整 JSON；importSnapshot 覆盖现有数据', () => {
    const store = newStore();
    store.request<Task>('POST', '/tasks', createTaskBody());
    store.request('POST', '/statuses', { name: '已挂', color: '#f57c00' });

    const parsed = JSON.parse(store.exportSnapshot());
    expect(parsed.version).toBe(1);
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.statusCategories).toHaveLength(4);

    store.importSnapshot(createSeedSnapshot());
    expect(store.request<Task[]>('GET', '/tasks')).toEqual([]);
    expect(store.request<StatusCategory[]>('GET', '/statuses')).toHaveLength(3);
  });

  it('导出 → 新实例导入往返，数据经 storage 完整保留', () => {
    const storage = memoryStorage();
    const a = new LocalStore(storage);
    a.request('POST', '/statuses', { name: '已挂', color: '#f57c00' });
    const json = a.exportSnapshot();

    const b = new LocalStore(storage);
    b.importSnapshot(parseBackupJson(json));
    expect(b.request<StatusCategory[]>('GET', '/statuses')).toHaveLength(4);
  });

  it('parseBackupJson：非法 JSON 抛 invalid_backup', () => {
    let caught: ApiError | null = null;
    try {
      parseBackupJson('not json');
    } catch (err) {
      caught = err as ApiError;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught?.status).toBe(400);
    expect(caught?.code).toBe('invalid_backup');
  });

  it('parseBackupJson：结构不符（缺字段）抛 invalid_backup', () => {
    expect(() => parseBackupJson('{"version":1}')).toThrow(ApiError);
  });

  it('parseBackupJson：合法快照原样返回', () => {
    const snap = parseBackupJson(JSON.stringify(createSeedSnapshot()));
    expect(snap.statusCategories.map((s) => s.id)).toEqual([
      'status-todo',
      'status-in-progress',
      'status-done',
    ]);
  });
});

describe('LocalStore：GET /api/progress 跨任务聚合读', () => {
  it('跨任务按 at 倒序聚合、联出 taskTitle、limit 切片', () => {
    // 用假时钟固定先后，保证 at 严格递增，倒序断言确定。
    vi.useFakeTimers();
    try {
      const store = newStore();
      vi.setSystemTime(new Date('2026-09-10T10:00:00.000Z'));
      const a = store.request<Task>('POST', '/tasks', createTaskBody({ title: '任务A' }));
      const b = store.request<Task>('POST', '/tasks', createTaskBody({ title: '任务B' }));

      vi.setSystemTime(new Date('2026-09-10T10:00:01.000Z'));
      store.request('POST', `/tasks/${a.id}/progress`, { summary: 'A 第一条' });
      vi.setSystemTime(new Date('2026-09-10T10:00:02.000Z'));
      store.request('POST', `/tasks/${b.id}/progress`, { summary: 'B 第一条' });
      vi.setSystemTime(new Date('2026-09-10T10:00:03.000Z'));
      store.request('POST', `/tasks/${a.id}/progress`, { summary: 'A 第二条' });

      const all = store.request<RecentProgressEntry[]>('GET', '/progress');
      expect(all).toHaveLength(3);
      expect(all[0].summary).toBe('A 第二条'); // 最新的在前
      expect(all[0].taskTitle).toBe('任务A');
      expect(all.some((e) => e.taskTitle === '任务B')).toBe(true);

      const limited = store.request<RecentProgressEntry[]>('GET', '/progress?limit=2');
      expect(limited).toHaveLength(2);
      expect(limited[0].summary).toBe('A 第二条');
      expect(limited[1].summary).toBe('B 第一条');
    } finally {
      vi.useRealTimers();
    }
  });

  it('空库 → 200 []；缺省 limit=10', () => {
    const store = newStore();
    expect(store.request<RecentProgressEntry[]>('GET', '/progress')).toEqual([]);
  });

  it('limit 非法 → 400 validation_error', () => {
    const store = newStore();
    let caught: ApiError | null = null;
    try {
      store.request('GET', '/progress?limit=abc');
    } catch (err) {
      caught = err as ApiError;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught?.status).toBe(400);
    expect(caught?.code).toBe('validation_error');
  });

  it('limit=0 / 负数 → 400 validation_error（正整数语义）', () => {
    const store = newStore();
    for (const q of ['0', '-1']) {
      let caught: ApiError | null = null;
      try {
        store.request('GET', `/progress?limit=${q}`);
      } catch (err) {
        caught = err as ApiError;
      }
      expect(caught).toBeInstanceOf(ApiError);
      expect(caught?.status).toBe(400);
      expect(caught?.code).toBe('validation_error');
    }
  });
});