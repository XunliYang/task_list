import express from 'express';
import type { Express } from 'express';
import type { DataSnapshot } from '@task-list/shared';
import { JsonStore } from './store/json-store';
import { createTasksRouter } from './modules/tasks/router';
import { createStatusesRouter } from './modules/statuses/router';
import { createExamsRouter } from './modules/exams/router';
import { errorHandler, notFoundHandler } from './middleware/error';

export interface AppOptions {
  /** 数据快照存储（由调用方构造并注入 DATA_DIR）。 */
  store: JsonStore<DataSnapshot>;
}

export function createApp(options: AppOptions): Express {
  const app = express();

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/statuses', createStatusesRouter(options.store));
  app.use('/api/tasks', createTasksRouter(options.store));
  app.use('/api/exams', createExamsRouter(options.store));

  // 兜底 404 与统一错误响应（放在所有路由之后）。
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}