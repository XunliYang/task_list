import { Router } from 'express';
import type { DataSnapshot } from '@task-list/shared';
import { JsonStore } from '../../store/json-store';
import { HttpError } from '../../http-error';
import { DEFAULT_PROGRESS_LIMIT, listRecentProgress } from './service';

/**
 * 解析可选 `?limit=N` 查询参数：缺省 DEFAULT_PROGRESS_LIMIT；
 * 非法（非正整数）→ 400 validation_error。
 */
export function parseLimit(raw: unknown): number {
  if (raw === undefined) {
    return DEFAULT_PROGRESS_LIMIT;
  }
  const text = Array.isArray(raw) ? String(raw[0]) : String(raw);
  if (!/^\d+$/.test(text)) {
    throw new HttpError(400, 'validation_error', `limit 必须为正整数，收到：${text}`);
  }
  return Number(text);
}

/** GET /api/progress：跨任务聚合最近进展。 */
export function createProgressRouter(store: JsonStore<DataSnapshot>): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const limit = parseLimit(req.query.limit);
    const snapshot = await store.read();
    res.json(listRecentProgress(snapshot, limit));
  });

  return router;
}