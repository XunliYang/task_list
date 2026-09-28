/**
 * 领域/路由层统一抛出的 HTTP 错误。
 *
 * 由 `middleware/error.ts` 映射为统一响应形状：
 * `{ code, message, details? }`。
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(message = '资源不存在'): HttpError {
  return new HttpError(404, 'not_found', message);
}