import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../http-error';

/**
 * 统一 JSON 错误响应：`{ code: string, message: string, details?: unknown }`。
 *
 * - zod 校验失败（ZodError）→ 400，code 为校验类错误。
 * - 业务错误（HttpError）→ 对应状态码与 code。
 * - 请求体不是合法 JSON（express.json 抛 SyntaxError）→ 400。
 * - 其余未知错误 → 500。
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      code: 'validation_error',
      message: '请求校验失败',
      details: err.issues,
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      code: err.code,
      message: err.message,
      details: err.details,
    });
    return;
  }

  if (err instanceof SyntaxError) {
    res.status(400).json({
      code: 'invalid_json',
      message: '请求体不是合法 JSON',
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    code: 'internal_error',
    message: '服务器内部错误',
  });
}

/** 兜底 404（未匹配到任何路由）。 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    code: 'not_found',
    message: `未找到路由：${req.method} ${req.path}`,
  });
}