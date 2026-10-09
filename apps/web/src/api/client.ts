import { ApiError } from './errors';
import { localStore, type Method } from './local-store';

export type { ApiErrorBody } from './errors';
export { ApiError } from './errors';

/** 后端基地址取自 VITE_API_BASE_URL，缺省为空串（同源，由 dev 代理 / 同域部署兜底）。 */
const BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

type DataSource = 'api' | 'local';

/** 显式模式：`VITE_DATA_SOURCE=local` 强制走 LocalStore（Netlify 静态托管）。 */
function initialDataSource(): DataSource {
  return import.meta.env.VITE_DATA_SOURCE === 'local' ? 'local' : 'api';
}

let dataSource: DataSource = initialDataSource();

/**
 * 标记后端不可用：首次请求 `/api/*` 收到「非结构化 404」（Netlify 静态托管
 * 无 Express 后端时的响应）后置为 local，后续请求直接路由到 LocalStore，
 * 避免每次先打一次 404。
 */
function markBackendUnavailable(): void {
  dataSource = 'local';
}

/** 仅供测试：把数据源恢复为按环境变量推导的初始值。 */
export function resetDataSource(): void {
  dataSource = initialDataSource();
}

/**
 * fetch 封装：统一 JSON 序列化、content-type 头、非 2xx 抛 ApiError。
 * 204 无响应体时返回 undefined。
 */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    let body: { code?: string; message?: string; details?: unknown } = {};
    try {
      body = (await res.json()) as { code?: string; message?: string; details?: unknown };
    } catch {
      // 非 JSON 错误体（网关 / 代理 / 静态 404 页）时忽略，走 statusText。
    }
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

/**
 * 按当前数据源分发：local 模式直接走 LocalStore；api 模式走 fetch，
 * 首次碰到「后端整体缺失」的非结构化 404 时降级并重试本次请求。
 */
async function dispatch<T>(method: Method, path: string, body?: unknown): Promise<T> {
  if (dataSource === 'local') {
    return localStore.request<T>(method, path, body);
  }

  const init: RequestInit = {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  };

  try {
    return await request<T>(path, init);
  } catch (err) {
    // 仅当 404 且非业务层结构化错误（无 code，如 not_found/status_in_use）
    // 才判定为「后端缺失」，避免把真实 API 的资源 404 误判为降级信号。
    if (err instanceof ApiError && err.status === 404 && !err.code) {
      markBackendUnavailable();
      return localStore.request<T>(method, path, body);
    }
    throw err;
  }
}

export const http = {
  get: <T>(path: string) => dispatch<T>('GET', path),
  post: <T>(path: string, body?: unknown) => dispatch<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => dispatch<T>('PATCH', path, body),
  delete: <T = void>(path: string) => dispatch<T>('DELETE', path),
};
