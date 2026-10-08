import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StatusCategory } from '@task-list/shared';
import { http, resetDataSource } from './client';
import { ApiError } from './errors';

/** 构造一个最小 fetch 响应 mock。 */
function stubFetch(status: number, body: { jsonBody?: unknown; nonJson?: boolean } = {}) {
  const fn = vi.fn(async () => {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (body.nonJson) {
          throw new Error('not json');
        }
        return body.jsonBody;
      },
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('client 数据源判定与降级', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetDataSource();
    localStorage.clear();
  });

  it('后端可用时走 fetch，正常返回数据', async () => {
    const fetchMock = stubFetch(200, {
      jsonBody: [{ id: 's1', name: '进行中', color: '#000', order: 0 }],
    });
    const statuses = await http.get<StatusCategory[]>('/statuses');
    expect(statuses).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // 未降级：数据源仍是 api，下一次请求继续走 fetch。
    stubFetch(200, { jsonBody: [] });
    await http.get<StatusCategory[]>('/statuses');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('首次非结构化 404 → 降级到 LocalStore，本次与后续请求都不再走 fetch', async () => {
    const fetchMock = stubFetch(404, { nonJson: true });

    const statuses = await http.get<StatusCategory[]>('/statuses');
    // 降级后本次请求仍返回 seed 数据（而非抛错）。
    expect(statuses.map((s) => s.id)).toEqual([
      'status-todo',
      'status-in-progress',
      'status-done',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 后续请求直接走 LocalStore，不再触发 fetch。
    const again = await http.get<StatusCategory[]>('/statuses');
    expect(again).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('非 404 错误（500）不降级，原样抛出', async () => {
    stubFetch(500, { jsonBody: { code: 'internal_error', message: '服务器内部错误' } });

    let caught: ApiError | null = null;
    try {
      await http.get('/statuses');
    } catch (err) {
      caught = err as ApiError;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught?.status).toBe(500);
    expect(caught?.code).toBe('internal_error');

    // 仍是 api 模式：下一次请求仍走 fetch。
    const fetchMock = stubFetch(200, { jsonBody: [] });
    await http.get('/statuses');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('结构化 404（业务 not_found）不触发降级', async () => {
    stubFetch(404, { jsonBody: { code: 'not_found', message: '任务不存在：x' } });

    let caught: ApiError | null = null;
    try {
      await http.get('/tasks/x');
    } catch (err) {
      caught = err as ApiError;
    }
    expect(caught?.status).toBe(404);
    expect(caught?.code).toBe('not_found');

    // 未降级：下一次请求仍走 fetch。
    const fetchMock = stubFetch(200, { jsonBody: [] });
    await http.get('/statuses');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('VITE_DATA_SOURCE=local 时完全不发 fetch，直接走 LocalStore', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'local');
    resetDataSource();
    const fetchMock = stubFetch(200, { jsonBody: [] });

    const statuses = await http.get<StatusCategory[]>('/statuses');
    expect(statuses).toHaveLength(3);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resetDataSource 恢复 api 模式后可再次走 fetch', async () => {
    stubFetch(404, { nonJson: true });
    await http.get('/statuses'); // 触发降级

    resetDataSource();
    const fetchMock = stubFetch(200, { jsonBody: [{ id: 's1', name: 'x', color: '#000', order: 0 }] });
    const statuses = await http.get<StatusCategory[]>('/statuses');
    expect(statuses).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});