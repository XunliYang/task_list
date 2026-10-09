export interface ApiErrorBody {
  code?: string;
  message?: string;
  details?: unknown;
}

/** 非 2xx 时抛出的错误：携带 HTTP 状态码与后端统一错误体中的 code/message。 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}
