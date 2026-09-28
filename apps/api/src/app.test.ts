import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DataSnapshot, Task } from '@task-list/shared';
import { createApp } from './app';
import { JsonStore } from './store/json-store';
import { createSeedSnapshot } from './store/seed';

const SEED_STATUS_ID = 'status-in-progress';

let dataDir: string;
let app: Express;

beforeEach(async () => {
  // 每个用例使用 os.tmpdir() 下的独立目录，绝不污染仓库 data/。
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'task-list-api-'));
  const store = new JsonStore<DataSnapshot>(path.join(dataDir, 'store.json'), createSeedSnapshot);
  app = createApp({ store });
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

function validTaskPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: '投递 ACME',
    statusId: SEED_STATUS_ID,
    tags: ['后端'],
    notes: '',
    stages: [
      { name: '笔试', dueDate: null },
      { name: '一面', dueDate: null },
    ],
    ...overrides,
  };
}

async function createTaskViaApi(payload: Record<string, unknown> = {}): Promise<Task> {
  const res = await request(app).post('/api/tasks').send(validTaskPayload(payload));
  expect(res.status).toBe(201);
  return res.body as Task;
}

describe('GET /api/health', () => {
  it('返回 200 与 { status: "ok" }', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('状态分类', () => {
  it('GET /api/statuses 返回种子分类', async () => {
    const res = await request(app).get('/api/statuses');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body.map((c: { name: string }) => c.name)).toContain('进行中');
  });

  it('POST 创建 → 201；PATCH → 200；DELETE 未被引用 → 204', async () => {
    const created = await request(app).post('/api/statuses').send({ name: '已挂', color: '#f44336' });
    expect(created.status).toBe(201);
    expect(created.body.id).toBeTruthy();
    const id = created.body.id as string;

    const patched = await request(app)
      .patch(`/api/statuses/${id}`)
      .send({ name: '已放弃' });
    expect(patched.status).toBe(200);
    expect(patched.body.name).toBe('已放弃');

    const del = await request(app).delete(`/api/statuses/${id}`);
    expect(del.status).toBe(204);
  });

  it('DELETE 被任务引用的分类 → 409 status_in_use', async () => {
    const category = await request(app).post('/api/statuses').send({ name: '已挂', color: '#f44336' });
    await createTaskViaApi({ statusId: category.body.id });

    const del = await request(app).delete(`/api/statuses/${category.body.id}`);
    expect(del.status).toBe(409);
    expect(del.body.code).toBe('status_in_use');
    expect(del.body.taskIds).toHaveLength(1);
  });

  it('DELETE 不存在的分类 → 404', async () => {
    const res = await request(app).delete('/api/statuses/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
  });
});

describe('任务', () => {
  it('POST /api/tasks 创建 → 201 且派生阶段/当前阶段', async () => {
    const res = await request(app).post('/api/tasks').send(validTaskPayload());
    expect(res.status).toBe(201);
    expect(res.body.stages).toHaveLength(2);
    expect(res.body.stages[0].order).toBe(0);
    expect(res.body.stages[0].status).toBe('in_progress');
    expect(res.body.currentStageId).toBe(res.body.stages[0].id);
  });

  it('POST /api/tasks 缺 title → 400 且 code 为校验类错误', async () => {
    const res = await request(app).post('/api/tasks').send({
      statusId: SEED_STATUS_ID,
      tags: [],
      notes: '',
      stages: [],
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation_error');
  });

  it('POST /api/tasks 传不存在的 statusId → 400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send(validTaskPayload({ statusId: 'status-does-not-exist' }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation_error');
  });

  it('GET /api/tasks 列表与 GET /api/tasks/:id 详情', async () => {
    const task = await createTaskViaApi();
    const list = await request(app).get('/api/tasks');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const detail = await request(app).get(`/api/tasks/${task.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.id).toBe(task.id);
  });

  it('GET /api/tasks/:missing → 404 not_found', async () => {
    const res = await request(app).get('/api/tasks/nope');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
  });

  it('PATCH /api/tasks/:id → 200', async () => {
    const task = await createTaskViaApi();
    const res = await request(app).patch(`/api/tasks/${task.id}`).send({ title: '改名' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('改名');
  });

  it('PATCH 带 stages 不会重建阶段（阶段由独立端点管理，stage id 保持不变）', async () => {
    const task = await createTaskViaApi();
    const res = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .send({ title: '改名', stages: [{ name: '不应生效' }] });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('改名');
    expect(res.body.stages).toHaveLength(2);
    expect(res.body.stages[0].id).toBe(task.stages[0].id);
    expect(res.body.stages[1].id).toBe(task.stages[1].id);
  });

  it('DELETE /api/tasks/:id → 204 且级联删除 progressEntries', async () => {
    const task = await createTaskViaApi();
    await request(app).post(`/api/tasks/${task.id}/progress`).send({ summary: '进展' });
    const del = await request(app).delete(`/api/tasks/${task.id}`);
    expect(del.status).toBe(204);

    const list = await request(app).get('/api/tasks');
    expect(list.body).toHaveLength(0);
  });

  it('按 statusId / q / stageStatus 筛选', async () => {
    const a = await createTaskViaApi({ title: '投递 Alpha', tags: ['后端'] });
    await createTaskViaApi({ title: '投递 Beta', tags: ['前端'], statusId: 'status-done' });

    const byStatus = await request(app).get(`/api/tasks?statusId=${a.statusId}`);
    expect(byStatus.body).toHaveLength(1);

    const byKeyword = await request(app).get('/api/tasks?q=Alpha');
    expect(byKeyword.body).toHaveLength(1);
    expect(byKeyword.body[0].title).toBe('投递 Alpha');

    const pending = await request(app).get('/api/tasks?stageStatus=pending');
    expect(pending.body.length).toBeGreaterThanOrEqual(1);
  });
});

describe('进展记录', () => {
  it('GET 空 → 200 []；POST → 201；GET → 倒序', async () => {
    const task = await createTaskViaApi();

    const empty = await request(app).get(`/api/tasks/${task.id}/progress`);
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual([]);

    await request(app)
      .post(`/api/tasks/${task.id}/progress`)
      .send({ summary: '第一条进展', stageId: task.stages[0].id });
    const second = await request(app)
      .post(`/api/tasks/${task.id}/progress`)
      .send({ summary: '第二条进展' });
    expect(second.status).toBe(201);

    const list = await request(app).get(`/api/tasks/${task.id}/progress`);
    expect(list.body).toHaveLength(2);
    expect(list.body[0].summary).toBe('第二条进展');
  });

  it('GET 不存在的任务的进展 → 404', async () => {
    const res = await request(app).get('/api/tasks/nope/progress');
    expect(res.status).toBe(404);
  });
});

describe('阶段增删改', () => {
  it('POST stages → 201；PATCH stage → 200；DELETE stage → 200', async () => {
    const task = await createTaskViaApi();

    const added = await request(app)
      .post(`/api/tasks/${task.id}/stages`)
      .send({ name: '二面', dueDate: null });
    expect(added.status).toBe(201);
    expect(added.body.stages).toHaveLength(3);

    const stageId = added.body.stages[2].id as string;
    const patched = await request(app)
      .patch(`/api/tasks/${task.id}/stages/${stageId}`)
      .send({ name: '终面', dueDate: '2026-11-01' });
    expect(patched.status).toBe(200);
    expect(patched.body.stages[2].name).toBe('终面');

    const deleted = await request(app).delete(`/api/tasks/${task.id}/stages/${stageId}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.stages).toHaveLength(2);
  });

  it('0 阶段任务 POST stages 首个阶段后 currentStageId 非空', async () => {
    const task = await createTaskViaApi({ stages: [] });
    expect(task.currentStageId).toBeNull();

    const res = await request(app)
      .post(`/api/tasks/${task.id}/stages`)
      .send({ name: '笔试', dueDate: null });
    expect(res.status).toBe(201);
    expect(res.body.stages).toHaveLength(1);
    expect(res.body.currentStageId).toBe(res.body.stages[0].id);
  });
});

describe('阶段重排', () => {
  it('PATCH /:id/stages/order 三阶段反转 → order 0/1/2、顺序已变、GET 一致', async () => {
    const task = await createTaskViaApi();
    const added = await request(app)
      .post(`/api/tasks/${task.id}/stages`)
      .send({ name: '二面', dueDate: null });
    const ids = (added.body.stages as { id: string }[]).map((s) => s.id);
    const reversed = [...ids].reverse();

    const res = await request(app)
      .patch(`/api/tasks/${task.id}/stages/order`)
      .send({ stageIds: reversed });
    expect(res.status).toBe(200);
    expect(res.body.stages.map((s: { order: number }) => s.order)).toEqual([0, 1, 2]);
    expect(res.body.stages.map((s: { id: string }) => s.id)).toEqual(reversed);

    const detail = await request(app).get(`/api/tasks/${task.id}`);
    expect(detail.body.stages.map((s: { id: string }) => s.id)).toEqual(reversed);
  });

  it('PATCH /:id/stages/order 缺 id → 400 invalid_stage_order', async () => {
    const task = await createTaskViaApi();
    const res = await request(app)
      .patch(`/api/tasks/${task.id}/stages/order`)
      .send({ stageIds: [task.stages[0].id] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_stage_order');
  });
});

describe('阶段流转 advance', () => {
  it('连续调用两次：第一次推进，第二次在末阶段不报错且 progressEntries 不重复增长', async () => {
    const task = await createTaskViaApi();

    const first = await request(app).post(`/api/tasks/${task.id}/advance`);
    expect(first.status).toBe(200);
    expect(first.body.nextStage).not.toBeNull();
    expect(first.body.nextStage.status).toBe('in_progress');
    expect(first.body.task.currentStageId).toBe(first.body.nextStage.id);

    const second = await request(app).post(`/api/tasks/${task.id}/advance`);
    expect(second.status).toBe(200);
    expect(second.body.nextStage).toBeNull();
    // 两个阶段各完成一次 → 2 条进展。
    expect(second.body.task.stages.every((s: { status: string }) => s.status === 'done')).toBe(true);

    const progress = await request(app).get(`/api/tasks/${task.id}/progress`);
    expect(progress.body).toHaveLength(2);

    // 第三次：已完成，幂等，不重复追加。
    const third = await request(app).post(`/api/tasks/${task.id}/advance`);
    expect(third.status).toBe(200);
    const progressAfter = await request(app).get(`/api/tasks/${task.id}/progress`);
    expect(progressAfter.body).toHaveLength(2);
  });

  it('PATCH current-stage 手动切换', async () => {
    const task = await createTaskViaApi();
    const res = await request(app)
      .patch(`/api/tasks/${task.id}/current-stage`)
      .send({ stageId: task.stages[1].id });
    expect(res.status).toBe(200);
    expect(res.body.currentStageId).toBe(task.stages[1].id);
  });
});

describe('考试/面试信息', () => {
  it('POST → 201；GET 列表；PATCH → 200；DELETE → 204', async () => {
    const created = await request(app).post('/api/exams').send({
      title: 'ACME 笔试',
      type: 'exam',
      company: 'ACME',
      status: '待报名',
    });
    expect(created.status).toBe(201);
    expect(created.body.source).toBe('manual');
    const id = created.body.id as string;

    const list = await request(app).get('/api/exams');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const patched = await request(app).patch(`/api/exams/${id}`).send({ status: '已报名' });
    expect(patched.status).toBe(200);
    expect(patched.body.status).toBe('已报名');

    const del = await request(app).delete(`/api/exams/${id}`);
    expect(del.status).toBe(204);
  });

  it('PATCH 不存在的考试 → 404', async () => {
    const res = await request(app).patch('/api/exams/nope').send({ status: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
  });

  it('POST /api/exams/import：含 1 行非法数据的 CSV → imported=1, skipped=1', async () => {
    const content = [
      'title,type,company,deadline,url,location,status,notes',
      'ACME 笔试,exam,ACME,2026-10-01,https://acme.com,北京,待报名,备注',
      ',interview,,,,,,',
      '',
    ].join('\n');

    const res = await request(app).post('/api/exams/import').send({ format: 'csv', content });
    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(1);
    expect(res.body.skipped).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].source).toBe('import');
  });

  it('POST /api/exams/:id/to-task 二次调用 → 409 already_converted', async () => {
    const exam = await request(app).post('/api/exams').send({
      title: 'ACME 一面',
      type: 'interview',
      company: 'ACME',
      notes: '准备算法',
      url: 'https://acme.com/meet',
    });

    const first = await request(app)
      .post(`/api/exams/${exam.body.id}/to-task`)
      .send({ statusId: SEED_STATUS_ID, stages: [{ name: '准备' }] });
    expect(first.status).toBe(201);
    expect(first.body.task.title).toBe('ACME 一面');
    expect(first.body.exam.taskId).toBe(first.body.task.id);

    const second = await request(app)
      .post(`/api/exams/${exam.body.id}/to-task`)
      .send({});
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('already_converted');
    expect(second.body.details.taskId).toBe(first.body.task.id);
  });
});
